# Railway Deploy Qilish Ko'rsatmasi

## 1. GitHub ga push qiling
```bash
git add .
git commit -m "Railway deploy ready"
git push
```

## 2. Railway da yangi loyiha oching
1. [railway.app](https://railway.app) ga kiring
2. **New Project** → **Deploy from GitHub repo** → o'z repongizni tanlang

## 3. MongoDB qo'shing
1. Loyihangizda **+ New** → **Database** → **MongoDB** tanlang
2. Railway avtomatik `MONGO_URL` o'rnatadi ✅

## 4. Environment Variables qo'shing
Railway dashboard → loyihangiz → **Variables** bo'limiga quyidagilarni kiriting:

| Variable | Qiymat | Izoh |
|----------|--------|------|
| `BOT_TOKEN` | `123456:ABC...` | BotFather dan olingan token |
| `DB_NAME` | `burapay` | Ma'lumotlar bazasi nomi |
| `ADMIN_IDS` | `1234567,8901234` | Admin Telegram ID lari (vergul bilan) |

> ⚠️ `WEBAPP_URL` ni **kiritmang** — Railway avtomatik aniqlaydi!
> ⚠️ `MONGO_URL` ni ham **kiritmang** — MongoDB plugin avtomatik qo'shadi!

## 5. Deploy
Variables kiritilgach Railway avtomatik deploy qiladi.  
Deploy tugagach bot URL avtomatik aniqlanadi va webhook + mini app menyusi o'zi sozlanadi.

## Tekshirish
Deploy muvaffaqiyatli bo'lsa:
- `https://your-app.railway.app` — Mini App ochilishi kerak
- `https://your-app.railway.app/api/health` — `{"status":"ok"}` qaytarishi kerak
- Botga `/start` bosing — Mini App tugmasi ko'rinishi kerak
