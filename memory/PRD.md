# BuraPay - Telegram Mini App PRD

## Original Problem Statement
Telegram Mini App yaratish - "BuraPay" nomli to'lov tizimi. Foydalanuvchilar pul kiritish va yechish imkoniyatiga ega bo'lishi kerak. Mostbet Kassa API orqali avtomatik to'lovlar.

## Core Requirements
1. **User Management**: Telegram ID orqali autentifikatsiya, har bir foydalanuvchiga 7 xonali ID
2. **Wallet System**: Uzcard, Humo, Mostbet UZS, Mostbet USD hamyonlari
3. **Deposit Flow**: UZS/USD valyuta tanlash, admin kartalariga to'lov
4. **Withdrawal Flow**: Faqat Mostbet hamyonlariga, 8 xonali maxfiy kod
5. **Admin Panel**: Foydalanuvchilar, tranzaksiyalar, sozlamalar, kartalar boshqaruvi
6. **Multi-language**: O'zbek va Rus tillari
7. **Mandatory Card**: Uzcard/Humo karta qo'shish majburiy
8. **Mostbet Kassa API**: Avtomatik depozit o'tkazish admin tasdiqlashda

## Tech Stack
- **Backend**: FastAPI, Python, aiogram (webhook)
- **Frontend**: React.js, Tailwind CSS
- **Database**: MongoDB (Motor async driver)
- **3rd Party**: Mostbet Kassa API (HMAC SHA3-256), httpx

## What's Been Implemented

### 2026-02-17 - Mostbet Kassa API Integratsiyasi Tuzatildi
- [x] Signature algoritmi to'g'rilandi (HMAC SHA3-256)
- [x] Yangi API kalitlar qo'yildi (a954a859... / b0cfce6d...)
- [x] Kassa balance endpoint qo'shildi (GET /api/admin/kassa/balance)
- [x] Admin panelda Kassa balansi ko'rsatiladi (400,000 UZS)
- [x] Barcha testlar o'tdi: Backend 33/33 (100%), Frontend 100%

### Oldingi Sessiyalar
- [x] Home - balans (UZS/USD), tranzaksiya tarixi
- [x] Deposit - UZS/USD toggle, admin kartalari
- [x] Withdraw - Mostbet hamyonlari, maxfiy kod
- [x] Wallets - qo'shish/tahrirlash/o'chirish
- [x] Admin Panel - statistika, to'lovlar, kartalar, foydalanuvchilar, sozlamalar
- [x] Multi-language (uz/ru)
- [x] Majburiy karta tekshiruvi
- [x] Telegram bot webhook
- [x] Admin tasdiqlash/rad etish Telegramdan
- [x] Ikki valyutali balans (UZS/USD)

## Architecture
```
/app/
├── backend/
│   ├── server.py        # FastAPI + Bot + Mostbet API logic
│   ├── .env             # BOT_TOKEN, ADMIN_IDS, MOSTBET_API_KEY, MOSTBET_SECRET_KEY, MOSTBET_CASHPOINT_ID
│   ├── requirements.txt
│   └── tests/
│       └── test_burapay_api.py
├── frontend/
│   ├── src/
│   │   ├── App.js       # All React components (~1300 lines)
│   │   ├── index.js
│   │   └── index.css
│   └── .env             # REACT_APP_BACKEND_URL
└── memory/
    └── PRD.md
```

## Key API Endpoints
- `POST /api/auth/login` - User login/create
- `GET /api/user/{telegram_id}` - User profile
- `POST /api/wallets/add|update|delete` - Wallet CRUD
- `POST /api/transactions/create` - Create deposit/withdraw
- `GET /api/admin/stats` - Admin statistics
- `GET /api/admin/transactions/pending` - Pending transactions
- `GET/POST /api/admin/cards` - Admin payment cards
- `GET/POST /api/admin/settings` - System settings
- `GET /api/admin/kassa/balance` - Mostbet Kassa balance
- `POST /api/webhook` - Telegram bot webhook

## Database Schema
- **users**: telegram_id, internal_id, first_name, balance_uzs, balance_usd, wallets[], is_admin, language
- **transactions**: id, short_id, user_id, type, amount, currency, status, secret_code
- **settings**: deposit_channel_id, withdraw_channel_id, exchange_rate
- **admin_cards**: id, type, number

## Mostbet Kassa API
- **Base URL**: https://apimb.com/mbc/gateway/v1/api/cashpoint/{cashpointId}
- **Auth**: HMAC SHA3-256 signature (api-key prefix required)
- **Headers**: X-Api-Key, X-Timestamp, X-Signature, X-Project (MBC)
- **Endpoints used**: /balance (GET), /player/deposit (POST)
- **Signature format**: `api-key:{API_KEY}{PATH}{BODY}{TIMESTAMP}`
- **Cashpoint ID**: 155356

## Test Reports
- /app/test_reports/iteration_5.json - Latest (100% pass)
- /app/test_reports/iteration_3.json, iteration_4.json - Previous

## Backlog Tasks
- [ ] P1: App.js ni alohida komponentlarga refactor qilish (1300+ qator)
- [ ] P1: server.py ni routes/, models/, bot/ modullariga ajratish
- [ ] P2: data-testid atributlarini to'liq qo'shish
- [ ] P2: Karta raqamlarini maskalash (8600 **** **** 1234)
- [ ] P3: Hamyon o'chirishda tasdiqlash modali

## Credentials
- **Admin Telegram ID**: 1617111900
- **Bot Token**: 8544155186:AAGpP6ubXqmJHrQQ4MAt6CwNLgd2Nry1R68
- **Production URL**: https://burapay.com
- **Server IP**: 167.71.35.253
- **Mostbet API Key**: a954a859-80a6-47dd-956c-67da3693043c
- **Mostbet Cashpoint ID**: 155356
