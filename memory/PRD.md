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

### 2025-02-17 - Majburiy Karta va Admin Panel Tuzatish
- [x] Uzcard/Humo karta majburiy qilindi (transaction yaratishdan oldin)
- [x] has_card field user API ga qo'shildi
- [x] Home sahifada sariq ogohlantirish banner qo'shildi
- [x] short_id (8 belgi) Telegram callback uchun qo'shildi
- [x] Admin action handler tuzatildi (short_id va id bo'yicha qidirish)
- [x] Admin panel to'liq ishlayapti

### Oldingi Yangilanishlar
- [x] Hamyon tahrirlash/o'chirish funksiyalari
- [x] Deposit/Withdraw flow
- [x] Multi-language (uz/ru)
- [x] Admin panel (stats, pending tx, cards, users, settings)

## Architecture

```
/app/
├── backend/
│   ├── server.py      # FastAPI + Bot logic
│   ├── .env           # BOT_TOKEN, ADMIN_IDS, MONGO_URL
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.js     # All React components
│   │   ├── index.js
│   │   └── index.css
│   └── .env           # REACT_APP_BACKEND_URL
└── memory/
    └── PRD.md
```

## Key API Endpoints
- `POST /api/auth/login` - User login/create (returns has_card, is_admin)
- `GET /api/user/{telegram_id}` - User profile (returns has_card)
- `POST /api/wallets/add` - Add wallet
- `POST /api/wallets/update` - Update wallet
- `POST /api/wallets/delete` - Delete wallet
- `POST /api/transactions/create` - Create deposit/withdraw (requires Uzcard/Humo)
- `GET /api/admin/stats` - Admin statistics
- `GET /api/admin/transactions/pending` - Pending transactions
- `GET/POST /api/admin/cards` - Admin payment cards
- `GET/POST /api/admin/settings` - System settings

## Database Schema
- **users**: telegram_id, internal_id, first_name, balance, wallets[], is_admin, language
- **transactions**: id, short_id, user_id, type, amount, currency, status, secret_code
- **settings**: deposit_channel_id, withdraw_channel_id, exchange_rate
- **admin_cards**: id, type, number

## Telegram Callback Data
- short_id (8 belgi) ishlatiladi (UUID 64 bayt chegarasidan oshmasligi uchun)
- Format: `admin_approve_{short_id}` yoki `admin_reject_{short_id}`

## Future/Backlog Tasks
- [ ] App.js ni alohida komponentlarga refactor qilish
- [ ] data-testid atributlarini qo'shish

## Credentials
- Admin Telegram ID: 1617111900
- Bot Token: 8544155186:AAGpP6ubXqmJHrQQ4MAt6CwNLgd2Nry1R68
- Preview URL: https://miniwalletbot.preview.emergentagent.com
