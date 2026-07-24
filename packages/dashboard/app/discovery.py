"""Runtime discovery of live Qdrant collections and Postgres tables.

This module replaces the previously-hardcoded `collections:` list in config.yaml.
The dashboard now lists whatever Qdrant and claude-memory-postgres actually hold,
so new collections/tables appear automatically and the UI never silently drifts.
"""
import re

_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _titleize(name: str) -> str:
    return name.replace("_", " ").title()


def categorize(name: str, cat_map: dict) -> tuple[str, str]:
    """Map a collection/table name to (group, human_label).

    cat_map = {"groups": {group: [names]}, "prefixes": {prefix: group},
               "labels": {name: label}}. Unknown names fall into "other"
    so newly-created collections still render somewhere.
    """
    cat_map = cat_map or {}
    label = (cat_map.get("labels") or {}).get(name) or _titleize(name)
    for group, names in (cat_map.get("groups") or {}).items():
        if name in names:
            return group, label
    for prefix, group in (cat_map.get("prefixes") or {}).items():
        if name.startswith(prefix):
            return group, label
    return "other", label


def validate_pg_identifier(name: str) -> bool:
    """True only for a safe, unquoted SQL identifier (schema/table name)."""
    return bool(name) and len(name) <= 63 and bool(_IDENT_RE.match(name))


async def list_collections(qreq, cat_map: dict) -> list[dict]:
    """List live Qdrant collections with counts, vector size, and category.

    qreq: async callable(method, path, body=None) -> dict  (main.qdrant_request)
    Returns dicts sorted by (group, -count).
    """
    res = await qreq("GET", "/collections")
    cols = (res.get("result", {}) or {}).get("collections", []) or []
    out = []
    for c in cols:
        name = c.get("name")
        if not name:
            continue
        try:
            cr = await qreq("POST", f"/collections/{name}/points/count", {"exact": True})
            count = cr.get("result", {}).get("count", 0)
        except Exception:
            count = -1
        vsize = None
        try:
            info = await qreq("GET", f"/collections/{name}")
            vparams = (
                info.get("result", {}).get("config", {})
                .get("params", {}).get("vectors", {})
            )
            if isinstance(vparams, dict):
                # single-vector: {"size": N, ...}; named-vectors: {name: {"size": N}}
                vsize = vparams.get("size")
                if vsize is None:
                    for v in vparams.values():
                        if isinstance(v, dict) and "size" in v:
                            vsize = v["size"]
                            break
        except Exception:
            vsize = None
        group, label = categorize(name, cat_map)
        out.append({
            "name": name, "count": count, "vector_size": vsize,
            "group": group, "label": label,
        })
    out.sort(key=lambda x: (x["group"], -(x["count"] if x["count"] >= 0 else 0)))
    return out


async def list_pg_tables(pool) -> list[dict]:
    """List tables (with row estimates) in a Postgres pool, or [] if no pool."""
    if pool is None:
        return []
    q = """
        SELECT n.nspname AS schema, c.relname AS tbl, c.reltuples::bigint AS rows
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
          AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
        ORDER BY n.nspname, c.relname
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(q)
    return [
        {"schema": r["schema"], "table": r["tbl"], "rows": int(r["rows"])}
        for r in rows
    ]


async def pg_table_exists(pool, schema: str, table: str) -> bool:
    """Verify a schema.table pair exists (defense-in-depth before browsing)."""
    if pool is None:
        return False
    async with pool.acquire() as conn:
        val = await conn.fetchval(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = $1 AND table_name = $2",
            schema, table,
        )
    return val is not None
