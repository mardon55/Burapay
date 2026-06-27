"""
database.py — BuraPay PostgreSQL ulanish moduli

Xavfsizlik choralari:
  1. asyncpg Connection Pool  — min/max ulanish hovuzi
  2. Retry Mechanism          — bazaga qayta ulanish (exponential backoff)
  3. Exception Handling       — barcha xatolar ushlanadi, loglaydi, xavfsiz javob
  4. Health Check             — startup/shutdown tekshiruvi
"""

import asyncpg
import asyncio
import logging
import os
import ssl
from typing import Optional
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

logger = logging.getLogger("burapay.db")

# ── Konfiguratsiya ────────────────────────────────────────────────────────────
POOL_MIN_SIZE = int(os.environ.get("DB_POOL_MIN", 2))
POOL_MAX_SIZE = int(os.environ.get("DB_POOL_MAX", 15))
POOL_MAX_INACTIVE = float(os.environ.get("DB_POOL_INACTIVE_TIMEOUT", 300))   # 5 daqiqa
QUERY_TIMEOUT = float(os.environ.get("DB_QUERY_TIMEOUT", 30))                # 30 soniya

# Qayta ulanish sozlamalari
RETRY_ATTEMPTS = int(os.environ.get("DB_RETRY_ATTEMPTS", 5))
RETRY_BASE_DELAY = float(os.environ.get("DB_RETRY_BASE_DELAY", 1.0))         # boshlang'ich kutish (soniya)
RETRY_MAX_DELAY = float(os.environ.get("DB_RETRY_MAX_DELAY", 30.0))          # maksimal kutish

# Global pool obyekti
_pool: Optional[asyncpg.Pool] = None


def _parse_dsn() -> tuple[str, dict]:
    """
    DATABASE_URL dan sslmode ni ajratadi va asyncpg-ga mos DSN + connect_args qaytaradi.
    asyncpg 'sslmode' keyword argumentini qo'llab-quvvatlamaydi — SSL ni ssl= orqali beramiz.
    """
    raw = os.environ.get("DATABASE_URL", "")
    if not raw:
        raise RuntimeError("DATABASE_URL muhit o'zgaruvchisi topilmadi!")

    parsed = urlparse(raw)
    qp = parse_qs(parsed.query, keep_blank_values=True)
    sslmode = qp.pop("sslmode", ["disable"])[0]

    # Tozalangan URL
    new_query = urlencode({k: v[0] for k, v in qp.items()})
    dsn = urlunparse(parsed._replace(query=new_query))

    connect_args = {}
    if sslmode not in ("disable", ""):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ctx

    return dsn, connect_args


async def _create_pool_once(dsn: str, connect_args: dict) -> asyncpg.Pool:
    """
    asyncpg pool yaratadi.
    command_timeout — har bir query uchun maksimal vaqt (soniyada).
    max_inactive_connection_lifetime — foydalanilmagan ulanish yopilgunga qadar kutish.
    """
    return await asyncpg.create_pool(
        dsn,
        min_size=POOL_MIN_SIZE,
        max_size=POOL_MAX_SIZE,
        max_inactive_connection_lifetime=POOL_MAX_INACTIVE,
        command_timeout=QUERY_TIMEOUT,
        **connect_args,
    )


async def init_pool() -> None:
    """
    Pool ni ishga tushiradi. Exponential backoff bilan bir necha marta urinadi.
    FastAPI startup hodisasida chaqiriladi.
    """
    global _pool
    dsn, connect_args = _parse_dsn()

    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            logger.info(f"PostgreSQL pool yaratilmoqda... (urinish {attempt}/{RETRY_ATTEMPTS})")
            _pool = await _create_pool_once(dsn, connect_args)
            logger.info(
                f"✅ PostgreSQL pool tayyor | "
                f"min={POOL_MIN_SIZE}, max={POOL_MAX_SIZE}, "
                f"timeout={QUERY_TIMEOUT}s"
            )
            return
        except (asyncpg.PostgresConnectionError, OSError, ConnectionRefusedError) as exc:
            delay = min(RETRY_BASE_DELAY * (2 ** (attempt - 1)), RETRY_MAX_DELAY)
            if attempt < RETRY_ATTEMPTS:
                logger.warning(
                    f"⚠️  Baza ulanishi muvaffaqiyatsiz (urinish {attempt}): {exc}. "
                    f"{delay:.1f}s kutilmoqda..."
                )
                await asyncio.sleep(delay)
            else:
                logger.error(f"❌ Baza ulanishi {RETRY_ATTEMPTS} ta urinishdan keyin ham muvaffaqiyatsiz!")
                raise


async def close_pool() -> None:
    """Pool ni xavfsiz yopadi. FastAPI shutdown hodisasida chaqiriladi."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("🔌 PostgreSQL pool yopildi.")


async def health_check() -> dict:
    """
    Bazaga ping yuboradi va pool holatini qaytaradi.
    GET /api/health endpointida ishlatiladi.
    """
    if _pool is None:
        return {"db": "error", "detail": "Pool mavjud emas"}
    try:
        async with _pool.acquire(timeout=5) as conn:
            result = await conn.fetchval("SELECT 1")
        stats = {
            "db": "ok",
            "pool_size": _pool.get_size(),
            "pool_idle": _pool.get_idle_size(),
            "pool_min": POOL_MIN_SIZE,
            "pool_max": POOL_MAX_SIZE,
        }
        return stats
    except Exception as exc:
        logger.error(f"Health check xatosi: {exc}")
        return {"db": "error", "detail": str(exc)}


def get_pool() -> asyncpg.Pool:
    """Pool ni qaytaradi. Agar init_pool chaqirilmagan bo'lsa xato."""
    if _pool is None:
        raise RuntimeError("DB pool ishga tushirilmagan. init_pool() chaqiring.")
    return _pool


# ── Xavfsiz query yordamchilari ───────────────────────────────────────────────

class DBError(Exception):
    """Barcha baza xatolarini o'rab oluvchi umumiy exception."""
    pass


async def _with_retry(coro_fn, *args, **kwargs):
    """
    Har qanday asyncpg xatosi uchun qayta urinish bilan o'rash.
    Transient (vaqtincha) xatolar uchun exponential backoff ishlatadi.
    Permanent (doimiy) xatolar (masalan, sintaksis xatosi) darhol qaytariladi.
    """
    _transient = (
        asyncpg.TooManyConnectionsError,
        asyncpg.ConnectionDoesNotExistError,
        asyncpg.ConnectionFailureError,
        OSError,
    )
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            return await coro_fn(*args, **kwargs)
        except _transient as exc:
            delay = min(RETRY_BASE_DELAY * (2 ** (attempt - 1)), RETRY_MAX_DELAY)
            if attempt < RETRY_ATTEMPTS:
                logger.warning(
                    f"🔄 Baza so'rovi vaqtincha muvaffaqiyatsiz "
                    f"(urinish {attempt}): {type(exc).__name__}: {exc}. "
                    f"{delay:.1f}s kutilmoqda..."
                )
                await asyncio.sleep(delay)
            else:
                logger.error(f"❌ Baza so'rovi {RETRY_ATTEMPTS} ta urinishdan keyin ham muvaffaqiyatsiz!")
                raise DBError(f"Baza ulanishi ishlamayapti: {exc}") from exc
        except (
            asyncpg.PostgresError,
            asyncpg.InterfaceError,
        ) as exc:
            # Doimiy xato — qayta urinishning foydasi yo'q
            logger.error(f"🛑 Baza xatosi [{type(exc).__name__}]: {exc}")
            raise DBError(f"Baza xatosi: {exc}") from exc


async def fetchall(query: str, params: dict = None) -> list:
    """
    SQL SELECT so'rovi — list[dict] qaytaradi.
    Xatolik bo'lsa: loglaydi va bo'sh ro'yxat qaytaradi.
    """
    pool = get_pool()
    args = list(params.values()) if params else []
    # asyncpg positional placeholders: $1, $2, ...
    pg_query = _to_pg_placeholders(query, params)

    async def _run():
        async with pool.acquire() as conn:
            rows = await conn.fetch(pg_query, *args)
            return [dict(row) for row in rows]

    try:
        return await _with_retry(_run)
    except DBError as exc:
        logger.error(f"fetchall xatosi | query: {query[:80]}... | {exc}")
        return []
    except Exception as exc:
        logger.error(f"fetchall kutilmagan xato | {exc}")
        return []


async def fetchone(query: str, params: dict = None) -> Optional[dict]:
    """
    SQL SELECT — bitta dict yoki None qaytaradi.
    """
    pool = get_pool()
    args = list(params.values()) if params else []
    pg_query = _to_pg_placeholders(query, params)

    async def _run():
        async with pool.acquire() as conn:
            row = await conn.fetchrow(pg_query, *args)
            return dict(row) if row else None

    try:
        return await _with_retry(_run)
    except DBError as exc:
        logger.error(f"fetchone xatosi | query: {query[:80]}... | {exc}")
        return None
    except Exception as exc:
        logger.error(f"fetchone kutilmagan xato | {exc}")
        return None


async def execute(query: str, params: dict = None) -> "ExecuteResult":
    """
    SQL INSERT/UPDATE/DELETE so'rovi.
    rowcount ni emulyatsiya qiluvchi ExecuteResult qaytaradi.
    Xatolik bo'lsa: loglaydi va rowcount=0 li natija qaytaradi.
    """
    pool = get_pool()
    args = list(params.values()) if params else []
    pg_query = _to_pg_placeholders(query, params)

    async def _run():
        async with pool.acquire() as conn:
            async with conn.transaction():
                status = await conn.execute(pg_query, *args)
                # asyncpg execute "UPDATE N" yoki "INSERT 0 N" formatida qaytaradi
                rc = _parse_rowcount(status)
                return ExecuteResult(rc)

    try:
        return await _with_retry(_run)
    except DBError as exc:
        logger.error(f"execute xatosi | query: {query[:80]}... | {exc}")
        return ExecuteResult(0)
    except Exception as exc:
        logger.error(f"execute kutilmagan xato | {exc}")
        return ExecuteResult(0)


class ExecuteResult:
    """SQLAlchemy result.rowcount ni emulyatsiya qiladi."""
    def __init__(self, rowcount: int):
        self.rowcount = rowcount


def _parse_rowcount(status: str) -> int:
    """'UPDATE 3' → 3, 'INSERT 0 1' → 1, 'DELETE 2' → 2"""
    try:
        parts = status.strip().split()
        return int(parts[-1])
    except (IndexError, ValueError):
        return 0


def _to_pg_placeholders(query: str, params: dict) -> str:
    """
    SQLAlchemy-uslubidagi :name → PostgreSQL-uslubidagi $N
    Misol: "WHERE telegram_id = :tid" → "WHERE telegram_id = $1"
    """
    if not params:
        return query
    result = query
    for i, key in enumerate(params.keys(), start=1):
        result = result.replace(f":{key}", f"${i}")
    return result
