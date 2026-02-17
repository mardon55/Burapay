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
7. **Mandatory Card**: Uzcard/Humo karta qo'shish majburiy

## Tech Stack
- **Backend**: FastAPI, Python
- **Frontend**: React.js
- **Database**: MongoDB
- **Bot**: aiogram (Telegram Bot API)
- **Styling**: Tailwind CSS

## What's Been Implemented ✅

### 2025-02-17 - To'liq Tizim Tekshiruvi va Mukammallashtirish
- [x] Admin 1617111900 to'g'ri sozlandi
- [x] "Ruxsat yo'q" sahifasi yaxshilandi (Shield ikonka, tushuntirish, qaytish tugmasi)
- [x] Barcha testlar muvaffaqiyatli (Backend 42/42, Frontend 100%)

### Asosiy Funksiyalar
- [x] Home - balans, tranzaksiya tarixi
- [x] Deposit - UZS/USD toggle, admin kartalari
- [x] Withdraw - Mostbet hamyonlari, maxfiy kod
- [x] Wallets - qo'shish/tahrirlash/o'chirish
- [x] Admin Panel - statistika, to'lovlar, kartalar, foydalanuvchilar, sozlamalar
- [x] Multi-language (uz/ru)
- [x] Majburiy karta tekshiruvi

## Tizim Statistikasi
- **Jami foydalanuvchilar**: 15+
- **Jami depozit**: 10,370,100 UZS
- **Tizim balansi**: 9,680,082 UZS
- **Kutilayotgan tranzaksiyalar**: 63+
- **Admin kartalar**: 2 (Uzcard, Humo)
- **USD kursi**: 13,000 UZS

## Architecture

```
/app/
├── backend/
│   ├── server.py      # FastAPI + Bot logic
│   ├── .env           # BOT_TOKEN, ADMIN_IDS=1617111900, MONGO_URL
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.js     # All React components (1293 lines)
│   │   ├── index.js
│   │   └── index.css
│   └── .env           # REACT_APP_BACKEND_URL
└── memory/
    └── PRD.md
```

## Key API Endpoints
- `POST /api/auth/login` - User login/create
- `GET /api/user/{telegram_id}` - User profile (has_card field)
- `POST /api/wallets/add|update|delete` - Wallet CRUD
- `POST /api/transactions/create` - Create deposit/withdraw
- `GET /api/admin/stats` - Admin statistics
- `GET /api/admin/transactions/pending` - Pending transactions
- `GET/POST /api/admin/cards` - Admin payment cards
- `GET/POST /api/admin/settings` - System settings

## Database Schema
- **users**: telegram_id, internal_id, first_name, balance, wallets[], is_admin, language
- **transactions**: id, short_id, user_id, type, amount, currency, status, secret_code
- **settings**: deposit_channel_id, withdraw_channel_id, exchange_rate
- **admin_cards**: id, type, number

## Test Results
- **Backend**: 100% (42/42 tests passed)
- **Frontend**: 100% (all features working)

## Future/Backlog Tasks
- [ ] App.js ni alohida komponentlarga refactor qilish
- [ ] data-testid atributlarini to'liq qo'shish

## Credentials
- **Admin Telegram ID**: 1617111900
- **Bot Token**: 8544155186:AAGpP6ubXqmJHrQQ4MAt6CwNLgd2Nry1R68
- **Preview URL**: https://miniwalletbot.preview.emergentagent.com
- **Depozit Kanali**: -1003351379612
- **Yechish Kanali**: -1003243642663
