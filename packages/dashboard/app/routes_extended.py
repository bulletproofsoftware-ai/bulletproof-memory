"""Read-only browse, discovery, and curated-aggregation endpoints.

Coverage is discovered at runtime (see discovery.py): the generic browse routes
list whatever Qdrant/claude-memory-postgres actually hold, so new collections and
tables appear automatically. All routes here are READ-ONLY. Auth is inherited
from main's auth_middleware (every path starts with /api/).

main wires its helpers in via bind() to avoid a circular import.
"""
import time

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

import discovery

router = APIRouter()

# Injected by main.bind(): qdrant_request, scroll_points, ensure_mempg_pool, get_config
_deps: dict = {}


def bind(deps: dict) -> None:
    _deps.update(deps)


# ---- live collection cache (kills config drift; ~60s TTL) -------------------
_col_cache: dict = {"data": None, "ts": 0.0}
_COL_TTL = 60


async def _collections() -> list[dict]:
    now = time.time()
    if _col_cache["data"] is not None and now - _col_cache["ts"] < _COL_TTL:
        return _col_cache["data"]
    cfg = _deps["get_config"]()
    data = await discovery.list_collections(_deps["qdrant_request"], cfg.get("categories", {}))
    _col_cache["data"] = data
    _col_cache["ts"] = now
    return data


def _coerce(v):
    """Make any Postgres value JSON-serializable."""
    if v is None or isinstance(v, (str, int, float, bool)):
        return v
    return str(v)


async def _scroll_to_page(name: str, page: int, page_size: int) -> list:
    """Scroll a Qdrant collection to the requested page (read-only)."""
    scroll = _deps["scroll_points"]
    needed = page * page_size
    points: list = []
    offset = None
    while len(points) < needed:
        batch, offset = await scroll(name, limit=min(200, needed - len(points)), offset=offset)
        points.extend(batch)
        if offset is None:
            break
    start = (page - 1) * page_size
    return points[start:start + page_size]


# ---- generic discovery / browse --------------------------------------------
@router.get("/api/collections")
async def api_collections():
    cols = await _collections()
    groups: dict = {}
    for c in cols:
        groups[c["group"]] = groups.get(c["group"], 0) + 1
    return {"collections": cols, "groups": groups, "total": len(cols)}


@router.get("/api/collection/{name}")
async def api_collection(
    name: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    cols = await _collections()
    if name not in {c["name"] for c in cols}:
        return JSONResponse({"error": "Unknown collection"}, status_code=404)
    qreq = _deps["qdrant_request"]
    try:
        cr = await qreq("POST", f"/collections/{name}/points/count", {"exact": True})
        total = cr.get("result", {}).get("count", 0)
    except Exception:
        total = 0
    page_points = await _scroll_to_page(name, page, page_size)
    return {
        "name": name,
        "page": page,
        "page_size": page_size,
        "total": total,
        "points": [
            {"id": p.get("id"), "payload": p.get("payload", {})} for p in page_points
        ],
    }


@router.get("/api/pg2/tables")
async def api_pg2_tables():
    pool = await _deps["ensure_mempg_pool"]()
    if pool is None:
        return JSONResponse(
            {"error": "claude-memory-postgres not connected", "tables": []},
            status_code=503,
        )
    return {"tables": await discovery.list_pg_tables(pool)}


@router.get("/api/pg2/table/{schema}/{table}")
async def api_pg2_table(
    schema: str,
    table: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    if not (discovery.validate_pg_identifier(schema) and discovery.validate_pg_identifier(table)):
        return JSONResponse({"error": "Invalid identifier"}, status_code=400)
    pool = await _deps["ensure_mempg_pool"]()
    if pool is None:
        return JSONResponse({"error": "claude-memory-postgres not connected"}, status_code=503)
    if not await discovery.pg_table_exists(pool, schema, table):
        return JSONResponse({"error": "Unknown table"}, status_code=404)
    offset = (page - 1) * page_size
    # identifiers validated by regex AND existence-checked against information_schema
    sql = f'SELECT * FROM "{schema}"."{table}" LIMIT $1 OFFSET $2'
    count_sql = f'SELECT count(*) FROM "{schema}"."{table}"'
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, page_size, offset)
        total = await conn.fetchval(count_sql)
    return {
        "schema": schema,
        "table": table,
        "page": page,
        "page_size": page_size,
        "total": total,
        "rows": [{k: _coerce(v) for k, v in dict(r).items()} for r in rows],
    }


# ---- curated aggregations --------------------------------------------------
_TS_KEYS = ("created_at", "timestamp", "indexed_at", "decided_at", "last_updated",
            "last_accessed_at", "tiered_at")
_RECENT_SCAN_CAP = 500


async def _summary(names: list[str], recent: int = 5) -> dict:
    """Counts (exact) + a small best-effort 'recent' sample for each collection."""
    scroll = _deps["scroll_points"]
    cols = {c["name"]: c for c in await _collections()}
    cards, sections = [], []
    for name in names:
        meta = cols.get(name)
        if meta is None:
            cards.append({"key": name, "label": name.replace("_", " ").title(),
                          "count": 0, "present": False})
            sections.append({"key": name, "label": name.replace("_", " ").title(),
                             "count": 0, "recent": []})
            continue
        cards.append({"key": name, "label": meta["label"], "count": meta["count"],
                      "present": True})
        pts: list = []
        offset = None
        while len(pts) < _RECENT_SCAN_CAP:
            batch, offset = await scroll(name, limit=200, offset=offset)
            pts.extend(batch)
            if offset is None:
                break

        def _keyf(p):
            pl = p.get("payload", {}) or {}
            for k in _TS_KEYS:
                if pl.get(k):
                    return str(pl.get(k))
            return ""

        pts.sort(key=_keyf, reverse=True)
        sections.append({
            "key": name, "label": meta["label"], "count": meta["count"],
            "recent": [
                {"id": p.get("id"),
                 "payload": {k: _coerce(v) for k, v in (p.get("payload", {}) or {}).items()}}
                for p in pts[:recent]
            ],
        })
    return {"cards": cards, "sections": sections}


@router.get("/api/tiers")
async def api_tiers():
    cfg = _deps["get_config"]()
    names = cfg.get("tiers_collections", [
        "memories_hot", "memories_warm", "memories_cold",
        "claude_memories", "short_term_memory", "working_memory",
    ]) + ["consolidation_cycles", "tier_transitions"]
    return await _summary(names)


@router.get("/api/knowledge")
async def api_knowledge():
    cfg = _deps["get_config"]()
    names = cfg.get("knowledge_collections", [
        "episodes", "learnings", "procedures", "trajectories",
        "heuristics", "process_knowledge", "world_model",
    ])
    return await _summary(names)


@router.get("/api/governance")
async def api_governance():
    cfg = _deps["get_config"]()
    names = cfg.get("governance_collections", [
        "constitutional_assessments", "self_assessments", "agent_behavioral_baselines",
        "red_team_campaigns", "compliance_dashboard", "compliance_trends",
    ])
    return await _summary(names)


@router.get("/api/sessions")
async def api_sessions():
    cfg = _deps["get_config"]()
    names = cfg.get("session_collections", ["tg_sessions", "session_recordings"])
    data = await _summary(names)
    # session_transcripts live in claude-memory-postgres (memory schema)
    transcripts = {"count": 0, "recent": [], "available": False}
    pool = await _deps["ensure_mempg_pool"]()
    if pool is not None:
        try:
            async with pool.acquire() as conn:
                cnt = await conn.fetchval("SELECT count(*) FROM memory.session_transcripts")
                rows = await conn.fetch("SELECT * FROM memory.session_transcripts LIMIT 10")
            transcripts = {
                "count": int(cnt),
                "available": True,
                "recent": [{k: _coerce(v) for k, v in dict(r).items()} for r in rows],
            }
        except Exception as e:
            transcripts = {"count": 0, "recent": [], "available": False, "error": str(e)}
    data["transcripts"] = transcripts
    return data
