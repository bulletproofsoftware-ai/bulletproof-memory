"""Memory Dashboard — Visual interface for the Claude memory system."""

import asyncio
import hashlib
import logging
import os
import secrets
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import asyncpg
import httpx
import yaml
from fastapi import FastAPI, Query, Request, Form, Depends
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from itsdangerous import URLSafeTimedSerializer

import discovery

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("memory-dashboard")

config = {}
qdrant_url = ""
qdrant_api_key = ""
ollama_url = ""
pg_pool: asyncpg.Pool | None = None
http_client: httpx.AsyncClient | None = None

# Decisions-log Postgres connection params (set during lifespan startup)
_pg_params: dict = {}

# claude-memory-postgres pool (COLD tier, episodes, session_transcripts, operational)
mempg_pool: asyncpg.Pool | None = None
_mempg_params: dict = {}

# Auth config
DASH_USER = os.environ.get("DASHBOARD_USER", "admin")
DASH_PASS_HASH = os.environ.get("DASHBOARD_PASS_HASH", "")
SESSION_SECRET = os.environ.get("SESSION_SECRET", secrets.token_hex(32))
_signer = URLSafeTimedSerializer(SESSION_SECRET)
SESSION_MAX_AGE = 86400 * 7  # 7 days


def verify_password(password: str) -> bool:
    h = hashlib.sha256(password.encode()).hexdigest()
    return h == DASH_PASS_HASH


def create_session_token(username: str) -> str:
    return _signer.dumps(username)


def get_session_user(request: Request) -> str | None:
    token = request.cookies.get("session")
    if not token:
        return None
    try:
        return _signer.loads(token, max_age=SESSION_MAX_AGE)
    except Exception:
        return None


def load_config() -> dict:
    config_path = os.environ.get("CONFIG_PATH", "/app/config.yaml")
    with open(config_path) as f:
        return yaml.safe_load(f)


async def qdrant_request(
    method: str, path: str, body: dict | None = None, timeout: float = 10
) -> dict:
    """Make a request to the Qdrant REST API using persistent client."""
    client = http_client
    if client is None:
        # Fallback if called before lifespan (shouldn't happen)
        async with httpx.AsyncClient(timeout=timeout) as c:
            resp = await c.request(
                method,
                f"{qdrant_url}{path}",
                headers={"api-key": qdrant_api_key, "Content-Type": "application/json"},
                json=body,
            )
            return resp.json()
    resp = await client.request(
        method,
        f"{qdrant_url}{path}",
        headers={"api-key": qdrant_api_key, "Content-Type": "application/json"},
        json=body,
        timeout=timeout,
    )
    return resp.json()


async def get_collection_count(collection: str, filter_: dict | None = None) -> int:
    """Get point count for a collection with optional filter."""
    body = {"exact": True}
    if filter_:
        body["filter"] = filter_
    result = await qdrant_request("POST", f"/collections/{collection}/points/count", body)
    return result.get("result", {}).get("count", 0)


async def scroll_points(
    collection: str,
    limit: int = 100,
    offset: str | None = None,
    filter_: dict | None = None,
    with_vector: bool = False,
    order_by: dict | None = None,
) -> tuple[list, str | None]:
    """Scroll through collection points."""
    body = {"limit": limit, "with_payload": True, "with_vector": with_vector}
    if offset is not None:
        body["offset"] = offset
    if filter_:
        body["filter"] = filter_
    if order_by:
        body["order_by"] = order_by
    result = await qdrant_request("POST", f"/collections/{collection}/points/scroll", body)
    res = result.get("result", {})
    return res.get("points", []), res.get("next_page_offset")


async def search_points(
    collection: str,
    vector: list,
    limit: int = 20,
    score_threshold: float = 0.5,
    filter_: dict | None = None,
) -> list:
    """Search collection by vector similarity."""
    body = {
        "vector": vector,
        "limit": limit,
        "score_threshold": score_threshold,
        "with_payload": True,
    }
    if filter_:
        body["filter"] = filter_
    result = await qdrant_request("POST", f"/collections/{collection}/points/search", body)
    return result.get("result", [])


async def embed_text(text: str) -> list | None:
    """Embed text via Ollama using persistent client."""
    model = config.get("embed_model", "nomic-embed-text")
    try:
        client = http_client
        if client is None:
            return None
        resp = await client.post(
            f"{ollama_url}/api/embed",
            json={"model": model, "input": text},
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            embeddings = data.get("embeddings", [])
            if embeddings:
                return embeddings[0]
    except Exception as e:
        log.warning("Embed failed: %s", e)
    return None


async def ensure_pg_pool() -> asyncpg.Pool | None:
    """Return the pg_pool, reconnecting if it's dead or None."""
    global pg_pool
    if pg_pool is not None:
        try:
            async with pg_pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return pg_pool
        except Exception:
            log.warning("Decisions DB pool health check failed, reconnecting")
            try:
                await pg_pool.close()
            except Exception:
                pass
            pg_pool = None

    if not _pg_params:
        return None

    try:
        pg_pool = await asyncpg.create_pool(**_pg_params)
        log.info("Decisions DB pool reconnected")
        return pg_pool
    except Exception as e:
        log.warning("Decisions DB reconnect failed: %s", e)
        pg_pool = None
        return None


async def ensure_mempg_pool() -> asyncpg.Pool | None:
    """Return the claude-memory-postgres pool, reconnecting if dead or None."""
    global mempg_pool
    if mempg_pool is not None:
        try:
            async with mempg_pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return mempg_pool
        except Exception:
            log.warning("claude-memory-postgres pool health check failed, reconnecting")
            try:
                await mempg_pool.close()
            except Exception:
                pass
            mempg_pool = None

    if not _mempg_params:
        return None

    try:
        mempg_pool = await asyncpg.create_pool(**_mempg_params)
        log.info("claude-memory-postgres pool reconnected")
        return mempg_pool
    except Exception as e:
        log.warning("claude-memory-postgres reconnect failed: %s", e)
        mempg_pool = None
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global config, qdrant_url, qdrant_api_key, ollama_url, pg_pool, http_client, mempg_pool
    config = load_config()
    qdrant_url = os.environ.get("QDRANT_URL", config.get("qdrant_url", "http://qdrant:6333"))
    qdrant_api_key = os.environ.get("QDRANT_API_KEY", "")
    ollama_url = os.environ.get("OLLAMA_URL", config.get("ollama_url", "http://host.docker.internal:11434"))
    log.info("Dashboard starting — Qdrant: %s, Ollama: %s", qdrant_url.split("@")[-1], ollama_url)
    http_client = httpx.AsyncClient(timeout=30)

    # Store connection params for reconnect and create initial pool
    _pg_params.update(
        host=os.environ.get("DECISIONS_PG_HOST", "localhost"),
        port=int(os.environ.get("DECISIONS_PG_PORT", "5432")),
        user=os.environ.get("DECISIONS_PG_USER", "postgres"),
        password=os.environ.get("DECISIONS_PG_PASSWORD", ""),
        database=os.environ.get("DECISIONS_PG_DB", "postgres"),
        min_size=1,
        max_size=3,
    )
    try:
        pg_pool = await asyncpg.create_pool(**_pg_params)
        log.info("Decisions DB pool created")
    except Exception as e:
        log.warning("Decisions DB connection failed: %s", e)
        pg_pool = None

    # claude-memory-postgres (memory system relational backend)
    _mempg_params.update(
        host=os.environ.get("MEMPG_HOST", "claude-memory-postgres"),
        port=int(os.environ.get("MEMPG_PORT", "5432")),
        user=os.environ.get("MEMPG_USER", "claude_memory"),
        password=os.environ.get("MEMPG_PASSWORD", ""),
        database=os.environ.get("MEMPG_DB", "claude_memory"),
        min_size=1,
        max_size=3,
    )
    try:
        mempg_pool = await asyncpg.create_pool(**_mempg_params)
        log.info("claude-memory-postgres pool created")
    except Exception as e:
        log.warning("claude-memory-postgres connection failed: %s", e)
        mempg_pool = None

    yield

    if http_client:
        await http_client.aclose()
    if pg_pool:
        await pg_pool.close()
    if mempg_pool:
        await mempg_pool.close()
    log.info("Dashboard shutting down")


app = FastAPI(docs_url=None, redoc_url=None, lifespan=lifespan)
templates = Jinja2Templates(directory="/app/templates")

# Public paths that don't require auth
_PUBLIC_PATHS = {"/health", "/login", "/logout"}


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if path in _PUBLIC_PATHS or path.startswith("/static"):
        return await call_next(request)
    user = get_session_user(request)
    if not user:
        if path.startswith("/api/"):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        return RedirectResponse("/login", status_code=307)
    return await call_next(request)


# ---------------------------------------------------------------------------
# Auth: Login / Logout
# ---------------------------------------------------------------------------
@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, error: str = Query(None)):
    if get_session_user(request):
        return RedirectResponse("/", status_code=307)
    return templates.TemplateResponse("login.html", {"request": request, "error": error})


@app.post("/login")
async def login_submit(username: str = Form(...), password: str = Form(...)):
    if username == DASH_USER and verify_password(password):
        token = create_session_token(username)
        response = RedirectResponse("/", status_code=303)
        response.set_cookie(
            "session", token,
            httponly=True,
            samesite="strict",
            max_age=SESSION_MAX_AGE,
        )
        log.info("Login successful for %s", username)
        return response
    log.warning("Login failed for %s", username)
    return RedirectResponse("/login?error=invalid", status_code=303)


@app.get("/logout")
async def logout():
    response = RedirectResponse("/login", status_code=303)
    response.delete_cookie("session")
    return response


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    qdrant_ok = False
    try:
        result = await qdrant_request("GET", "/collections")
        qdrant_ok = "error" not in result and result.get("status") == "ok"
    except Exception:
        pass

    ollama_ok = False
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{ollama_url}/api/tags")
            ollama_ok = resp.status_code == 200
    except Exception:
        pass

    pool = await ensure_pg_pool()
    decisions_ok = pool is not None

    # Optional n8n health probe. Disabled unless N8N_HEALTH_URL is set.
    n8n_ok = False
    n8n_health_url = os.environ.get("N8N_HEALTH_URL", "")
    if n8n_health_url:
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                resp = await client.get(n8n_health_url)
                n8n_ok = resp.status_code == 200
        except Exception:
            pass

    # claude-memory-postgres + DRM canary
    mempg_ok = (await ensure_mempg_pool()) is not None
    canary_ok = False
    if mempg_ok and mempg_pool is not None:
        try:
            async with mempg_pool.acquire() as conn:
                await conn.fetchval("SELECT count(*) FROM audit.memory_health")
            canary_ok = True
        except Exception:
            canary_ok = False

    # Memgraph (bolt) reachability — TCP connect only
    memgraph_ok = False
    memgraph_host = os.environ.get("MEMGRAPH_HOST", "host.docker.internal")
    memgraph_port = int(os.environ.get("MEMGRAPH_PORT", "7687"))
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(memgraph_host, memgraph_port), timeout=2
        )
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        memgraph_ok = True
    except Exception:
        memgraph_ok = False

    all_ok = qdrant_ok and decisions_ok and mempg_ok
    return {
        "status": "ok" if all_ok else "degraded",
        "qdrant": "ok" if qdrant_ok else "unreachable",
        "ollama": "ok" if ollama_ok else "unreachable",
        "decisions_db": "ok" if decisions_ok else "unreachable",
        "claude_memory_pg": "ok" if mempg_ok else "unreachable",
        "drm_canary": "ok" if canary_ok else "unreachable",
        "memgraph": "ok" if memgraph_ok else "unreachable",
        "n8n": "ok" if n8n_ok else "unreachable",
    }


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------
@app.get("/", response_class=HTMLResponse)
async def home_page(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/memories", response_class=HTMLResponse)
async def memories_page(request: Request):
    return templates.TemplateResponse("memories.html", {"request": request})


@app.get("/search", response_class=HTMLResponse)
async def search_page(request: Request):
    return templates.TemplateResponse("search.html", {"request": request})


@app.get("/graph", response_class=HTMLResponse)
async def graph_page(request: Request):
    return templates.TemplateResponse("graph.html", {"request": request})


@app.get("/decisions", response_class=HTMLResponse)
async def decisions_page(request: Request):
    return templates.TemplateResponse("decisions.html", {"request": request})


@app.get("/analytics", response_class=HTMLResponse)
async def analytics_page(request: Request):
    return templates.TemplateResponse("analytics.html", {"request": request})


@app.get("/tiers", response_class=HTMLResponse)
async def tiers_page(request: Request):
    return templates.TemplateResponse(
        "summary.html",
        {"request": request, "active": "tiers", "page_title": "Tiers",
         "api_endpoint": "/api/tiers"},
    )


@app.get("/knowledge", response_class=HTMLResponse)
async def knowledge_page(request: Request):
    return templates.TemplateResponse(
        "summary.html",
        {"request": request, "active": "knowledge", "page_title": "Knowledge",
         "api_endpoint": "/api/knowledge"},
    )


@app.get("/governance", response_class=HTMLResponse)
async def governance_page(request: Request):
    return templates.TemplateResponse(
        "summary.html",
        {"request": request, "active": "governance", "page_title": "Governance",
         "api_endpoint": "/api/governance"},
    )


@app.get("/sessions", response_class=HTMLResponse)
async def sessions_page(request: Request):
    return templates.TemplateResponse("sessions.html", {"request": request})


@app.get("/explorer", response_class=HTMLResponse)
async def explorer_page(request: Request):
    return templates.TemplateResponse("explorer.html", {"request": request})


@app.get("/system", response_class=HTMLResponse)
async def system_page(request: Request):
    return templates.TemplateResponse("system.html", {"request": request})


# ---------------------------------------------------------------------------
# API: Stats
# ---------------------------------------------------------------------------
# Stats scrolls all of claude_memories (~22k points), so cache the result
# briefly — Analytics + Dashboard both poll this on load.
_stats_cache: dict = {"data": None, "ts": 0.0}
_STATS_TTL = 60  # seconds


@app.get("/api/stats")
async def api_stats():
    now = time.time()
    if _stats_cache["data"] is not None and now - _stats_cache["ts"] < _STATS_TTL:
        return _stats_cache["data"]
    collections = config.get("collections", {})
    counts = {}
    for key, name in collections.items():
        try:
            counts[key] = await get_collection_count(name)
        except Exception:
            counts[key] = 0

    # Merge in every live-discovered Qdrant collection keyed by its own name,
    # so counts[<collection_name>] resolves for cards beyond the 5-key shim above.
    try:
        for col in await discovery.list_collections(qdrant_request, config.get("categories", {})):
            if col["count"] >= 0:
                counts.setdefault(col["name"], col["count"])
    except Exception:
        pass

    # Type breakdown
    long_term = collections.get("long_term", "claude_memories")
    type_counts = {}
    for mem_type in config.get("memory_types", []):
        try:
            type_counts[mem_type] = await get_collection_count(
                long_term,
                filter_={"must": [{"key": "type", "match": {"value": mem_type}}]},
            )
        except Exception:
            type_counts[mem_type] = 0

    # Top projects
    project_counts = {}
    points, offset = await scroll_points(long_term, limit=100)
    all_points = list(points)
    while offset is not None:
        points, offset = await scroll_points(long_term, limit=100, offset=offset)
        all_points.extend(points)

    for pt in all_points:
        project = pt.get("payload", {}).get("project", "unknown")
        project_counts[project] = project_counts.get(project, 0) + 1

    top_projects = sorted(project_counts.items(), key=lambda x: x[1], reverse=True)[:15]

    # Sensitivity breakdown
    sensitivity_counts = {}
    for level in ["public", "internal", "sensitive", "restricted"]:
        try:
            sensitivity_counts[level] = await get_collection_count(
                long_term,
                filter_={"must": [{"key": "sensitivity", "match": {"value": level}}]},
            )
        except Exception:
            sensitivity_counts[level] = 0

    # Timeline (group by date from created_at)
    timeline = {}
    for pt in all_points:
        payload = pt.get("payload", {})
        created = payload.get("created_at", "")
        if created:
            try:
                day = created[:10]
                timeline[day] = timeline.get(day, 0) + 1
            except Exception:
                pass

    timeline_sorted = sorted(timeline.items())[-30:]  # Last 30 days with data

    # PRTM metrics: meta-memories, top accessed, stale, pipeline
    meta_count = 0
    stale_count = 0
    conflict_count = 0
    top_accessed = []
    thirty_days_ago = datetime.now(timezone.utc).timestamp() - 30 * 86400
    for pt in all_points:
        payload = pt.get("payload", {})
        if payload.get("is_meta_memory"):
            meta_count += 1
        cs = payload.get("conflict_status")
        if cs and cs not in ("none", "resolved", "clear", ""):
            conflict_count += 1
        ac = payload.get("access_count", 0)
        if ac > 0:
            top_accessed.append({
                "content": (payload.get("content", "") or "")[:150],
                "type": payload.get("type", "fact"),
                "project": payload.get("project", "global"),
                "access_count": ac,
                "is_meta": bool(payload.get("is_meta_memory")),
            })
        if ac == 0:
            created_ts = 0
            try:
                created_ts = datetime.fromisoformat(
                    payload.get("created_at", "2099-01-01").replace("Z", "+00:00")
                ).timestamp()
            except Exception:
                pass
            if created_ts < thirty_days_ago:
                stale_count += 1

    top_accessed.sort(key=lambda x: x["access_count"], reverse=True)
    top_accessed = top_accessed[:15]

    # Pipeline: unprocessed/processed transcript counts.
    # session_transcripts lives in claude-memory-postgres (memory.session_transcripts),
    # not Qdrant. "Processed" = extraction_tier has been assigned.
    unprocessed = 0
    processed = 0
    try:
        mempg = await ensure_mempg_pool()
        if mempg:
            async with mempg.acquire() as conn:
                unprocessed = await conn.fetchval(
                    "SELECT count(*) FROM memory.session_transcripts WHERE extraction_tier IS NULL"
                )
                processed = await conn.fetchval(
                    "SELECT count(*) FROM memory.session_transcripts WHERE extraction_tier IS NOT NULL"
                )
    except Exception:
        pass

    # Tier counts (live, across the hot/warm/cold pipeline)
    tier_counts = {}
    for key, col in [
        ("hot", "memories_hot"), ("warm", "memories_warm"), ("cold", "memories_cold"),
        ("long_term", long_term), ("short_term", "short_term_memory"),
        ("working", "working_memory"),
    ]:
        try:
            tier_counts[key] = await get_collection_count(col)
        except Exception:
            tier_counts[key] = 0
    hot_count = tier_counts.get("hot", 0)

    # RAG corpora (large document stores)
    corpora = {}
    for col in ["obsidian_docs", "file_search"]:
        try:
            corpora[col] = await get_collection_count(col)
        except Exception:
            corpora[col] = 0

    result = {
        "counts": counts,
        "type_breakdown": type_counts,
        "top_projects": top_projects,
        "sensitivity": sensitivity_counts,
        "timeline": timeline_sorted,
        "meta_count": meta_count,
        "stale_count": stale_count,
        "conflict_count": conflict_count,
        "hot_count": hot_count,
        "tier_counts": tier_counts,
        "corpora": corpora,
        "top_accessed": top_accessed,
        "pipeline": {
            "unprocessed": unprocessed,
            "processed": processed,
        },
    }
    _stats_cache["data"] = result
    _stats_cache["ts"] = time.time()
    return result


# ---------------------------------------------------------------------------
# API: Memories (paginated)
# ---------------------------------------------------------------------------
@app.get("/api/memories")
async def api_memories(
    page: int = Query(1, ge=1),
    mem_type: str = Query(None),
    project: str = Query(None),
    tag: str = Query(None),
    temporal_class: str = Query(None),
    sensitivity: str = Query(None),
    sort: str = Query("created_at", pattern="^(created_at|type|project|temporal_class|sensitivity|access_count)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
):
    collections = config.get("collections", {})
    long_term = collections.get("long_term", "claude_memories")
    page_size = config.get("page_size", 25)

    must_filters = []
    if mem_type:
        must_filters.append({"key": "type", "match": {"value": mem_type}})
    if project:
        must_filters.append({"key": "project", "match": {"value": project}})
    if tag:
        must_filters.append({"key": "tags", "match": {"value": tag}})
    if temporal_class:
        must_filters.append({"key": "temporal_class", "match": {"value": temporal_class}})
    if sensitivity:
        must_filters.append({"key": "sensitivity", "match": {"value": sensitivity}})

    filter_ = {"must": must_filters} if must_filters else None

    total = await get_collection_count(long_term, filter_=filter_)

    # Use order_by for timestamp sorting at Qdrant level when possible
    order_by = None
    if sort == "created_at":
        order_by = {"key": "created_at", "direction": "desc" if order == "desc" else "asc"}

    # Scroll to the right page offset
    all_points = []
    offset = None
    needed = page * page_size
    while len(all_points) < needed:
        batch_size = min(100, needed - len(all_points))
        points, next_offset = await scroll_points(
            long_term, limit=batch_size, offset=offset, filter_=filter_,
            order_by=order_by,
        )
        all_points.extend(points)
        offset = next_offset
        if offset is None:
            break

    # For non-timestamp sorts, do in-memory sort on the fetched page
    if sort != "created_at" and all_points:
        reverse = order == "desc"
        if sort == "access_count":
            all_points.sort(
                key=lambda pt: pt.get("payload", {}).get("access_count", 0) or 0,
                reverse=reverse,
            )
        else:
            all_points.sort(
                key=lambda pt: (pt.get("payload", {}).get(sort, "") or "").lower(),
                reverse=reverse,
            )

    start = (page - 1) * page_size
    page_points = all_points[start : start + page_size]

    memories = []
    for pt in page_points:
        payload = pt.get("payload", {})
        memories.append({
            "id": pt.get("id"),
            "content": payload.get("content", payload.get("text", ""))[:200],
            "full_content": payload.get("content", payload.get("text", "")),
            "type": payload.get("type", "unknown"),
            "project": payload.get("project", ""),
            "tags": payload.get("tags", []),
            "sensitivity": payload.get("sensitivity", ""),
            "created_at": payload.get("created_at", ""),
            "temporal_class": payload.get("temporal_class", "permanent"),
            "decay_halflife_days": payload.get("decay_halflife_days"),
            "deadline_date": payload.get("deadline_date"),
            "last_verified_date": payload.get("last_verified_date"),
            "provenance_hash": payload.get("provenance_hash"),
            "confidence_basis": payload.get("confidence_basis"),
            "status": payload.get("status", "active"),
            "jurisdiction": payload.get("jurisdiction"),
            "access_count": payload.get("access_count", 0),
            "is_meta_memory": bool(payload.get("is_meta_memory")),
            "last_accessed_at": payload.get("last_accessed_at"),
            "tier": payload.get("tier"),
            "recall_count": payload.get("recall_count", 0),
            "conflict_status": payload.get("conflict_status"),
            "conflict_reason": payload.get("conflict_reason"),
            "verification_count": len(payload.get("verification_history") or []),
        })

    total_pages = max(1, (total + page_size - 1) // page_size)

    return {
        "memories": memories,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "sort": sort,
        "order": order,
    }


# ---------------------------------------------------------------------------
# API: Recent (last N memories)
# ---------------------------------------------------------------------------
@app.get("/api/recent")
async def api_recent(limit: int = Query(10, ge=1, le=50)):
    collections = config.get("collections", {})
    long_term = collections.get("long_term", "claude_memories")

    # Scroll all and sort by created_at descending
    all_points = []
    offset = None
    while True:
        points, offset = await scroll_points(long_term, limit=100, offset=offset)
        all_points.extend(points)
        if offset is None:
            break

    # Sort by created_at descending
    def sort_key(pt):
        return pt.get("payload", {}).get("created_at", "")

    all_points.sort(key=sort_key, reverse=True)
    recent = all_points[:limit]

    return {
        "memories": [
            {
                "id": pt.get("id"),
                "content": pt.get("payload", {}).get(
                    "content", pt.get("payload", {}).get("text", "")
                )[:200],
                "type": pt.get("payload", {}).get("type", "unknown"),
                "project": pt.get("payload", {}).get("project", ""),
                "created_at": pt.get("payload", {}).get("created_at", ""),
            }
            for pt in recent
        ]
    }


# ---------------------------------------------------------------------------
# API: Search
# ---------------------------------------------------------------------------
@app.post("/api/search")
async def api_search(request: Request):
    body = await request.json()
    query = body.get("query", "").strip()
    if not query:
        return JSONResponse({"error": "Query required"}, status_code=400)

    limit = body.get("limit", config.get("search_limit", 20))
    threshold = body.get("threshold", config.get("search_threshold", 0.5))
    default_col = config.get("collections", {}).get("long_term", "claude_memories")
    req_collection = body.get("collection", default_col)
    # Validate against the LIVE collection list (auto-updating; any real
    # collection is searchable, including obsidian_docs / file_search).
    try:
        cols_res = await qdrant_request("GET", "/collections")
        allowed_collections = {
            c["name"] for c in cols_res.get("result", {}).get("collections", [])
        }
    except Exception:
        allowed_collections = set()
    if not allowed_collections:
        allowed_collections = set(config.get("collections", {}).values()) or {default_col}
    collection = req_collection if req_collection in allowed_collections else default_col

    vector = await embed_text(query)
    if not vector:
        return JSONResponse({"error": "Embedding failed"}, status_code=503)

    results = await search_points(collection, vector, limit=limit, score_threshold=threshold)

    return {
        "query": query,
        "collection": collection,
        "count": len(results),
        "results": [
            {
                "id": r.get("id"),
                "score": round(r.get("score", 0), 4),
                "content": r.get("payload", {}).get(
                    "content", r.get("payload", {}).get("text", "")
                ),
                "type": r.get("payload", {}).get("type", "unknown"),
                "project": r.get("payload", {}).get("project", ""),
                "tags": r.get("payload", {}).get("tags", []),
                "created_at": r.get("payload", {}).get("created_at", ""),
            }
            for r in results
        ],
    }


# ---------------------------------------------------------------------------
# API: Graph data
# ---------------------------------------------------------------------------
# Simple in-process cache for project view (data changes slowly)
_project_graph_cache: dict = {"data": None, "key": None, "ts": 0.0}
_PROJECT_CACHE_TTL = 300  # 5 minutes


async def _build_memory_view(
    links_collection: str, long_term: str, min_strength: float, limit: int
) -> dict:
    strength_filter = {"must": [{"key": "strength", "range": {"gte": min_strength}}]}
    all_links: list = []
    offset = None
    max_scroll = max(limit * 3, 5000)
    while len(all_links) < max_scroll:
        points, offset = await scroll_points(
            links_collection, limit=200, offset=offset, filter_=strength_filter
        )
        all_links.extend(points)
        if offset is None:
            break

    if not all_links:
        return {"nodes": [], "edges": [], "count": 0, "view": "memory"}

    edges = []
    for link in all_links:
        payload = link.get("payload", {})
        src = payload.get("source_id", "")
        tgt = payload.get("target_id", "")
        if src and tgt:
            edges.append({
                "source": src,
                "target": tgt,
                "relationship": payload.get("relationship", "related"),
                "strength": payload.get("strength", 0.5),
            })
    edges.sort(key=lambda e: e["strength"], reverse=True)
    edges = edges[:limit]

    memory_ids = set()
    for e in edges:
        memory_ids.add(e["source"])
        memory_ids.add(e["target"])

    nodes: list = []
    id_list = list(memory_ids)
    for i in range(0, len(id_list), 200):
        chunk = id_list[i : i + 200]
        result = await qdrant_request(
            "POST",
            f"/collections/{long_term}/points",
            {"ids": chunk, "with_payload": True, "with_vector": False},
        )
        for pt in result.get("result", []) or []:
            payload = pt.get("payload", {}) or {}
            content = payload.get("content") or payload.get("text") or ""
            nodes.append({
                "id": str(pt.get("id", "")),
                "type": payload.get("type", "unknown"),
                "project": payload.get("project", ""),
                "content": content[:100],
            })

    returned = {n["id"] for n in nodes}
    for mid in memory_ids:
        if mid not in returned:
            nodes.append({"id": mid, "type": "unknown", "project": "", "content": ""})

    # Collapse exact-duplicate memories (same project + content) into one canonical
    # node so duplication in the store doesn't render as a wall of identical nodes.
    # Edges are remapped to the canonical id, with self-loops and duplicate pairs
    # removed (keeping the strongest link). dup_count exposes how many copies merged.
    canonical: dict[tuple, str] = {}
    remap: dict[str, str] = {}
    dup_count: dict[str, int] = {}
    collapsed_nodes: list = []
    for n in nodes:
        nid = n["id"]
        if n["content"]:
            key = (n["project"], n["content"])
            cid = canonical.get(key)
            if cid is None:
                canonical[key] = nid
                remap[nid] = nid
                dup_count[nid] = 1
                collapsed_nodes.append(n)
            else:
                remap[nid] = cid
                dup_count[cid] += 1
        else:
            remap[nid] = nid
            dup_count[nid] = 1
            collapsed_nodes.append(n)
    for n in collapsed_nodes:
        n["dup_count"] = dup_count.get(n["id"], 1)

    seen_edges: dict[tuple, dict] = {}
    for e in edges:
        s = remap.get(e["source"], e["source"])
        t = remap.get(e["target"], e["target"])
        if s == t:
            continue
        pair = (s, t) if s < t else (t, s)
        cur = seen_edges.get(pair)
        if cur is None or e["strength"] > cur["strength"]:
            seen_edges[pair] = {
                "source": s,
                "target": t,
                "relationship": e.get("relationship", "related"),
                "strength": e["strength"],
            }
    collapsed_edges = list(seen_edges.values())

    return {
        "nodes": collapsed_nodes,
        "edges": collapsed_edges,
        "count": len(collapsed_edges),
        "view": "memory",
    }


async def _build_project_view(
    links_collection: str, long_term: str, min_strength: float
) -> dict:
    """Aggregate links by (source_project, target_project) for a project-level graph.

    Returns project nodes (sized by memory count) and cross-project edges
    (weighted by link count). Same-project links are counted as internal_links
    on each node, not rendered as edges.
    """
    cache_key = (links_collection, long_term, round(min_strength, 3))
    if (
        _project_graph_cache["data"] is not None
        and _project_graph_cache["key"] == cache_key
        and time.time() - _project_graph_cache["ts"] < _PROJECT_CACHE_TTL
    ):
        return _project_graph_cache["data"]

    # 1) Build memory_id -> project map by scrolling all memories
    id_project: dict[str, str] = {}
    project_counts: dict[str, int] = {}
    offset = None
    while True:
        points, offset = await scroll_points(long_term, limit=1000, offset=offset)
        for pt in points:
            payload = pt.get("payload", {}) or {}
            proj = payload.get("project") or "(none)"
            mid = str(pt.get("id", ""))
            if mid:
                id_project[mid] = proj
                project_counts[proj] = project_counts.get(proj, 0) + 1
        if offset is None:
            break

    # 2) Scroll links with strength filter, aggregate by project pair
    strength_filter = {"must": [{"key": "strength", "range": {"gte": min_strength}}]}
    pair_counts: dict[tuple[str, str], dict] = {}
    internal_links: dict[str, int] = {}
    offset = None
    while True:
        points, offset = await scroll_points(
            links_collection, limit=1000, offset=offset, filter_=strength_filter
        )
        for link in points:
            payload = link.get("payload", {}) or {}
            src = payload.get("source_id", "")
            tgt = payload.get("target_id", "")
            if not (src and tgt):
                continue
            sp = id_project.get(src)
            tp = id_project.get(tgt)
            if not sp or not tp:
                continue
            if sp == tp:
                internal_links[sp] = internal_links.get(sp, 0) + 1
                continue
            # Order pair canonically so each edge counted once
            a, b = (sp, tp) if sp < tp else (tp, sp)
            key = (a, b)
            entry = pair_counts.get(key)
            strength = payload.get("strength", 0.0) or 0.0
            if entry is None:
                pair_counts[key] = {"count": 1, "max_strength": strength}
            else:
                entry["count"] += 1
                if strength > entry["max_strength"]:
                    entry["max_strength"] = strength
        if offset is None:
            break

    nodes = [
        {
            "id": proj,
            "project": proj,
            "type": "project",
            "memory_count": count,
            "internal_links": internal_links.get(proj, 0),
            "content": f"{count} memories · {internal_links.get(proj, 0)} internal links",
        }
        for proj, count in project_counts.items()
    ]
    edges = [
        {
            "source": a,
            "target": b,
            "relationship": "related",
            "strength": data["max_strength"],
            "count": data["count"],
        }
        for (a, b), data in pair_counts.items()
    ]

    result = {"nodes": nodes, "edges": edges, "count": len(edges), "view": "project"}
    _project_graph_cache["data"] = result
    _project_graph_cache["key"] = cache_key
    _project_graph_cache["ts"] = time.time()
    return result


@app.get("/api/graph-data")
async def api_graph_data(
    view: str = Query("project", pattern="^(project|memory)$"),
    min_strength: float = Query(0.8, ge=0.0, le=1.0),
    limit: int = Query(2500, ge=1, le=10000),
):
    collections = config.get("collections", {})
    links_collection = collections.get("links", "memory_links")
    long_term = collections.get("long_term", "claude_memories")

    if view == "project":
        return await _build_project_view(links_collection, long_term, min_strength)
    return await _build_memory_view(links_collection, long_term, min_strength, limit)


# ---------------------------------------------------------------------------
# API: Projects list (for filters)
# ---------------------------------------------------------------------------
@app.get("/api/projects")
async def api_projects():
    collections = config.get("collections", {})
    long_term = collections.get("long_term", "claude_memories")

    projects = set()
    offset = None
    while True:
        points, offset = await scroll_points(long_term, limit=100, offset=offset)
        for pt in points:
            p = pt.get("payload", {}).get("project", "")
            if p:
                projects.add(p)
        if offset is None:
            break

    return {"projects": sorted(projects)}


# ---------------------------------------------------------------------------
# API: Tags list (for filters)
# ---------------------------------------------------------------------------
@app.get("/api/tags")
async def api_tags():
    collections = config.get("collections", {})
    long_term = collections.get("long_term", "claude_memories")

    tags = set()
    offset = None
    while True:
        points, offset = await scroll_points(long_term, limit=100, offset=offset)
        for pt in points:
            for t in pt.get("payload", {}).get("tags", []):
                if isinstance(t, str):
                    tags.add(t)
        if offset is None:
            break

    return {"tags": sorted(tags)}


# ---------------------------------------------------------------------------
# API: Decisions (Postgres decisions log)
# ---------------------------------------------------------------------------
@app.get("/api/decisions")
async def api_decisions(
    project: str = Query(None),
    status: str = Query(None),
):
    pool = await ensure_pg_pool()
    if not pool:
        return JSONResponse({"error": "Decisions DB not connected"}, status_code=503)
    conditions = []
    params = []
    idx = 1
    if project:
        conditions.append(f"project = ${idx}")
        params.append(project)
        idx += 1
    if status:
        conditions.append(f"status = ${idx}")
        params.append(status)
        idx += 1
    where = " WHERE " + " AND ".join(conditions) if conditions else ""
    query = f"SELECT * FROM memory_decisions{where} ORDER BY decided_at DESC LIMIT 1000"
    count_query = f"SELECT count(*) FROM memory_decisions{where}"
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        total = await conn.fetchval(count_query, *params)
    return {
        "decisions": [
            {
                "id": r["id"],
                "project": r["project"],
                "title": r["title"],
                "decision": r["decision"],
                "rationale": r["rationale"],
                "alternatives_considered": r["alternatives_considered"] or [],
                "impact": r["impact"],
                "status": r["status"],
                "tags": r["tags"] or [],
                "decided_at": r["decided_at"].isoformat() if r["decided_at"] else None,
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ],
        "total": total,
    }


# ---------------------------------------------------------------------------
# API: Edit Memory
# ---------------------------------------------------------------------------
@app.put("/api/memories/{memory_id}")
async def api_edit_memory(memory_id: str, request: Request):
    body = await request.json()
    collections = config.get("collections", {})
    long_term = collections.get("long_term", "claude_memories")

    # Fetch current state for audit trail
    try:
        current = await qdrant_request("GET", f"/collections/{long_term}/points/{memory_id}")
        old_payload = current.get("result", {}).get("payload", {})
    except Exception:
        return JSONResponse({"error": "Memory not found"}, status_code=404)

    # Build update payload from allowed fields
    allowed = {"content", "type", "project", "tags", "sensitivity", "temporal_class", "status"}
    update = {k: v for k, v in body.items() if k in allowed}
    if not update:
        return JSONResponse({"error": "No valid fields to update"}, status_code=400)

    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Apply update to Qdrant
    await qdrant_request(
        "POST",
        f"/collections/{long_term}/points/payload",
        {"payload": update, "points": [memory_id]},
    )

    # If content changed, regenerate embedding
    if "content" in update and update["content"] != old_payload.get("content"):
        new_vector = await embed_text(update["content"])
        if new_vector:
            await qdrant_request(
                "PUT",
                f"/collections/{long_term}/points/vectors",
                {"points": [{"id": memory_id, "vector": new_vector}]},
            )

    # Audit trail
    await _log_audit("edit", memory_id, long_term, old_payload, update)

    return {"status": "ok", "updated_fields": list(update.keys())}


# ---------------------------------------------------------------------------
# API: Delete Memory
# ---------------------------------------------------------------------------
@app.delete("/api/memories/{memory_id}")
async def api_delete_memory(memory_id: str):
    collections = config.get("collections", {})
    long_term = collections.get("long_term", "claude_memories")

    # Fetch current state for audit trail
    try:
        current = await qdrant_request("GET", f"/collections/{long_term}/points/{memory_id}")
        old_payload = current.get("result", {}).get("payload", {})
    except Exception:
        return JSONResponse({"error": "Memory not found"}, status_code=404)

    # Delete from Qdrant
    await qdrant_request(
        "POST",
        f"/collections/{long_term}/points/delete",
        {"points": [memory_id]},
    )

    # Audit trail
    await _log_audit("delete", memory_id, long_term, old_payload, None)

    return {"status": "ok", "deleted": memory_id}


# ---------------------------------------------------------------------------
# API: Audit Log
# ---------------------------------------------------------------------------
@app.get("/api/audit")
async def api_audit(
    memory_id: str = Query(None),
    action: str = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    audit_collection = config.get("collections", {}).get("audit_log", "audit_log")

    must = []
    if memory_id:
        must.append({"key": "details.memory_id", "match": {"value": memory_id}})
    if action:
        must.append({"key": "action", "match": {"value": action}})

    filter_ = {"must": must} if must else None
    points, _ = await scroll_points(audit_collection, limit=limit, filter_=filter_)

    # Sort by timestamp descending
    points.sort(key=lambda p: p.get("payload", {}).get("timestamp", ""), reverse=True)

    return {
        "entries": [
            {
                "id": p.get("id"),
                "action": p.get("payload", {}).get("action"),
                "timestamp": p.get("payload", {}).get("timestamp"),
                "details": p.get("payload", {}).get("details", {}),
            }
            for p in points
        ],
        "count": len(points),
    }


# ---------------------------------------------------------------------------
# Internal: Audit logging
# ---------------------------------------------------------------------------
async def _log_audit(
    action: str,
    memory_id: str,
    collection: str,
    old_payload: dict,
    new_payload: dict | None,
) -> None:
    """Write an audit entry to the audit_log collection."""
    audit_collection = config.get("collections", {}).get("audit_log", "audit_log")
    now = datetime.now(timezone.utc).isoformat()

    details = {
        "memory_id": memory_id,
        "collection": collection,
        "content_preview": (old_payload.get("content", "") or "")[:200],
    }

    if action == "edit" and new_payload:
        details["changes"] = {}
        for key, new_val in new_payload.items():
            if key == "updated_at":
                continue
            old_val = old_payload.get(key)
            if old_val != new_val:
                details["changes"][key] = {"from": old_val, "to": new_val}

    if action == "delete":
        details["deleted_payload"] = {
            k: v for k, v in old_payload.items()
            if k in ("content", "type", "project", "tags", "sensitivity", "created_at")
        }

    # Embed the audit text for searchability
    audit_text = f"dashboard_{action} {memory_id} {details.get('content_preview', '')[:100]}"
    vector = await embed_text(audit_text)
    if not vector:
        log.warning("Failed to embed audit entry for %s/%s", action, memory_id)
        return

    point_id = str(uuid.uuid4())
    try:
        await qdrant_request(
            "PUT",
            f"/collections/{audit_collection}/points",
            {
                "points": [{
                    "id": point_id,
                    "vector": vector,
                    "payload": {
                        "action": f"dashboard_{action}",
                        "timestamp": now,
                        "session_id": "dashboard",
                        "details": details,
                    },
                }]
            },
        )
    except Exception as e:
        log.warning("Audit log write failed: %s", e)


# ---------------------------------------------------------------------------
# Extended read-only routes (runtime discovery, generic browse, curated views)
# ---------------------------------------------------------------------------
import routes_extended  # noqa: E402

routes_extended.bind({
    "qdrant_request": qdrant_request,
    "scroll_points": scroll_points,
    "ensure_mempg_pool": ensure_mempg_pool,
    "get_config": lambda: config,
})
app.include_router(routes_extended.router)
