---
name: PostgreSQL asyncpg pool setup
description: BuraPay da asyncpg connection pool va SSL konfiguratsiyasi, database.py pattern
---

## Rule
Replit PostgreSQL DATABASE_URL da `sslmode=require` bo'ladi. asyncpg bu parametrni keyword argument sifatida qabul qilmaydi — URL dan olib tashlash va `ssl=` context sifatida berish kerak.

**Why:** asyncpg `connect()` / `create_pool()` `sslmode` keyword ni tanimaydi → `TypeError: connect() got an unexpected keyword argument 'sslmode'`

**How to apply:**
```python
parsed = urlparse(raw_url)
qp = parse_qs(parsed.query)
sslmode = qp.pop('sslmode', ['disable'])[0]
clean_url = urlunparse(parsed._replace(query=urlencode({k:v[0] for k,v in qp.items()})))
if sslmode not in ('disable', ''):
    ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
    pool = await asyncpg.create_pool(clean_url, ssl=ctx, ...)
```

## Database module pattern (backend/database.py)
- `init_pool()` — startup da chaqiriladi, exponential backoff bilan 5 ta urinish
- `close_pool()` — shutdown da chaqiriladi
- `health_check()` — pool_size, pool_idle, pool_max qaytaradi
- `fetchall/fetchone/execute` — `:name` → `$N` placeholder conversion, try/except bilan o'ralgan
- `_with_retry()` — transient xatolar uchun retry, permanent uchun darhol raise

## PYTHONPATH
sqlalchemy va asyncpg `.venv` da, boshqalar `.pythonlibs` da.
`start.sh` da: `export PYTHONPATH="/home/runner/workspace/.venv/lib/python3.12/site-packages:$PYTHONPATH"`
