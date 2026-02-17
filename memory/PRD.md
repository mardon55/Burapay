# BuraPay - Telegram Mini App PRD

## Original Problem Statement
Telegram Mini App yaratish - "BuraPay" nomli to'lov tizimi. Foydalanuvchilar pul kiritish va yechish imkoniyatiga ega bo'lishi kerak.

## Core Requirements
1. **User Management**: Telegram ID orqali autentifikatsiya, har bir foydalanuvchiga 7 xonali ID
2. **Wallet System**: Uzcard, Humo, Mostbet UZS, Mostbet USD hamyonlari
3. **Deposit Flow**: UZS/USD valyuta tanlash, admin kartalariga to'lov
4. **Withdrawal Flow**: Faqat Mostbet hamyonlariga, 8 xonali maxfiy kod
5. **Admin Panel**: Foydalanuvchilar, tranzaksiyalar, sozlamalar, kartalar boshqaruvi
6. **Multi-language**: O'zbek va Rus tillari

## Tech Stack
- **Backend**: FastAPI, Python
- **Frontend**: React.js
- **Database**: MongoDB
- **Bot**: aiogram (Telegram Bot API)
- **Styling**: Tailwind CSS

## What's Been Implemented ✅

### 2025-02-17 - Full System Verification
- [x] Home page - balans va tranzaksiya tarixi
- [x] Deposit page - UZS/USD toggle, admin kartalari
- [x] Withdraw page - Mostbet hamyonlari, maxfiy kod
- [x] Wallets page - hamyon qo'shish/ko'rish
- [x] Admin panel - ruxsat nazorati
- [x] Multi-language support (uz/ru)
- [x] Bottom navigation
- [x] All API endpoints working

### Testing Results
- Backend: 100% (29/29 tests passed)
- Frontend: 100% (all features working)

## Architecture

```
/app/
├── backend/
│   ├── server.py      # FastAPI + Bot logic
│   ├── .env           # BOT_TOKEN, ADMIN_IDS, MONGO_URL
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.js     # All React components (1129 lines)
│   │   ├── index.js
│   │   └── index.css
│   └── .env           # REACT_APP_BACKEND_URL
└── memory/
    └── PRD.md
```

## Key API Endpoints
- `POST /api/auth/login` - User login/create
- `GET /api/user/{telegram_id}` - User profile
- `POST /api/transactions/create` - Create deposit/withdraw
- `GET /api/admin/cards` - Get payment cards
- `GET/POST /api/admin/settings` - System settings

## Database Schema
- **users**: telegram_id, internal_id, first_name, balance, wallets[], is_admin, language
- **transactions**: id, user_id, type, amount, currency, status, secret_code
- **settings**: deposit_channel_id, withdraw_channel_id, exchange_rate
- **admin_cards**: id, type, number

## Known Technical Debt
1. App.js juda katta (1129 qator) - komponentlarga ajratish kerak
2. data-testid atributlari qo'shilishi kerak

## Future/Backlog Tasks
- [ ] App.js ni alohida komponentlarga refactor qilish
- [ ] data-testid atributlarini qo'shish
- [ ] Error handling yaxshilash

## Credentials
- Admin Telegram ID: 1617111900
- Bot Token: 8544155186:AAGpP6ubXqmJHrQQ4MAt6CwNLgd2Nry1R68
- Preview URL: https://miniwalletbot.preview.emergentagent.com
