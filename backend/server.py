from fastapi import FastAPI, APIRouter, HTTPException, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone
from bson import ObjectId
import asyncio
import random
import string
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command, CommandStart, CommandObject
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Bot Setup
BOT_TOKEN = os.environ.get('BOT_TOKEN')
ADMIN_IDS = [int(x) for x in os.environ.get('ADMIN_IDS', '').split(',') if x.strip()]
BOT_USERNAME = "BuraPay_bot" 
WEBAPP_URL = "https://manga-shunaqa.preview.emergentagent.com"

bot = Bot(token=BOT_TOKEN) if BOT_TOKEN else None
dp = Dispatcher()

app = FastAPI()
api_router = APIRouter(prefix="/api")

def generate_user_id():
    """Generate a 7-digit random ID"""
    return str(random.randint(1000000, 9999999))

class Wallet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str 
    number: str
    expiry: Optional[str] = None 
    name: Optional[str] = None

class User(BaseModel):
    telegram_id: int
    internal_id: str = Field(default_factory=generate_user_id)
    first_name: str
    username: Optional[str] = None
    phone_number: Optional[str] = None
    balance: float = 0.0
    wallets: List[Wallet] = []
    is_admin: bool = False
    referrer_id: Optional[int] = None 
    referrals_count: int = 0
    language: str = "uz" # 'uz' or 'ru'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: int
    type: Literal['deposit', 'withdraw']
    amount: float
    currency: str
    method: str
    wallet_number: Optional[str] = None
    secret_code: Optional[str] = None
    status: Literal['pending', 'approved', 'rejected'] = 'pending'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    user_id: int
    type: Literal['deposit', 'withdraw']
    amount: float
    currency: str
    method: str
    wallet_number: Optional[str] = None
    secret_code: Optional[str] = None

class Settings(BaseModel):
    admin_group_id: Optional[str] = None
    deposit_channel_id: Optional[str] = None
    withdraw_channel_id: Optional[str] = None
    # Payment Details
    admin_card_uzcard: Optional[str] = "8600 0000 0000 0000"
    admin_card_humo: Optional[str] = "9860 0000 0000 0000"
    admin_mostbet_uzs: Optional[str] = None
    admin_mostbet_usd: Optional[str] = None
    admin_mostbet_rub: Optional[str] = None

# Messages
MESSAGES = {
    "uz": {
        "welcome": "👋 Salom, {name}!\n\n<b>BuraPay</b> - ishonchli to'lov tizimiga xush kelibsiz.\nHisobni to'ldirish va yechish uchun pastdagi tugmani bosing.",
        "open_app": "📱 BuraPay ilovasini ochish",
        "new_ref": "🎉 Sizda yangi referal bor: {name}",
        "approved": "✅ Sizning {amount:,.0f} {currency} miqdoridagi so'rovingiz tasdiqlandi!",
        "rejected": "❌ Sizning {amount:,.0f} {currency} miqdoridagi so'rovingiz bekor qilindi.",
        "choose_lang": "👇 Tilni tanlang / Выберите язык",
        "lang_selected": "✅ Til o'zgartirildi: O'zbekcha",
        "balance_updated": "💰 Sizning hisobingiz admin tomonidan {amount:,.0f} UZS ga {action}."
    },
    "ru": {
        "welcome": "👋 Привет, {name}!\n\nДобро пожаловать в <b>BuraPay</b> - надежную платежную систему.\nНажмите кнопку ниже для пополнения и вывода средств.",
        "open_app": "📱 Открыть приложение BuraPay",
        "new_ref": "🎉 У вас новый реферал: {name}",
        "approved": "✅ Ваша заявка на {amount:,.0f} {currency} одобрена!",
        "rejected": "❌ Ваша заявка на {amount:,.0f} {currency} отклонена.",
        "choose_lang": "👇 Tilni tanlang / Выберите язык",
        "lang_selected": "✅ Язык изменен: Русский",
        "balance_updated": "💰 Ваш баланс изменен админом: {action} {amount:,.0f} UZS."
    }
}

# Bot Handlers
@dp.message(CommandStart())
async def cmd_start(message: types.Message, command: CommandObject):
    try:
        user_data = await db.users.find_one({"telegram_id": message.from_user.id})
        
        # Referral
        args = command.args
        referrer_id = None
        if args and args.isdigit() and not user_data:
            ref_internal_id = args
            referrer = await db.users.find_one({"internal_id": ref_internal_id})
            if referrer and referrer['telegram_id'] != message.from_user.id:
                referrer_id = referrer['telegram_id']
                await db.users.update_one(
                    {"telegram_id": referrer['telegram_id']},
                    {"$inc": {"referrals_count": 1}}
                )
                if bot:
                    try:
                        r_lang = referrer.get("language", "uz")
                        msg = MESSAGES[r_lang]["new_ref"].format(name=message.from_user.first_name)
                        await bot.send_message(referrer['telegram_id'], msg)
                    except: pass

        if not user_data:
            new_user = User(
                telegram_id=message.from_user.id,
                first_name=message.from_user.first_name,
                username=message.from_user.username,
                balance=0.0,
                referrer_id=referrer_id,
                language="uz"
            )
            await db.users.insert_one(new_user.model_dump())
            user_data = new_user.model_dump()
        
        lang = user_data.get("language", "uz")
        
        # Main Menu
        markup = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=MESSAGES[lang]["open_app"], web_app=WebAppInfo(url=WEBAPP_URL))],
            [InlineKeyboardButton(text="🇺🇿 O'zbekcha / 🇷🇺 Русский", callback_data="change_lang")]
        ])
        
        await message.answer(
            MESSAGES[lang]["welcome"].format(name=message.from_user.first_name),
            reply_markup=markup,
            parse_mode="HTML"
        )
    except Exception as e:
        logging.error(f"Error in cmd_start: {e}")
        await message.answer("Error / Xatolik")

# Helper to find ID
@dp.message(F.text | F.forward_from_chat)
async def get_chat_id(message: types.Message):
    if message.chat.type == 'private' and message.from_user.id in ADMIN_IDS:
        if message.forward_from_chat:
            await message.reply(f"📢 Kanal/Guruh ID: `{message.forward_from_chat.id}`", parse_mode="Markdown")
        elif message.text == "/id":
            await message.reply(f"🆔 Sizning ID: `{message.from_user.id}`\n📍 Chat ID: `{message.chat.id}`", parse_mode="Markdown")

@dp.my_chat_member()
async def on_my_chat_member(event: types.ChatMemberUpdated):
    if event.new_chat_member.status in ['administrator', 'member']:
        chat_id = event.chat.id
        chat_title = event.chat.title
        try:
            await bot.send_message(
                chat_id, 
                f"✅ <b>Bot qo'shildi!</b>\n\n"
                f"🆔 Kanal ID: `{chat_id}`\n"
                f"📌 Nomi: {chat_title}\n\n"
                "Ushbu ID ni Admin Paneldagi tegishli (Depozit yoki Pul yechish) katakka nusxalab qo'ying."
            )
        except: pass

@dp.callback_query(F.data == "change_lang")
async def cb_change_lang(callback: CallbackQuery):
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🇺🇿 O'zbekcha", callback_data="set_lang_uz"),
         InlineKeyboardButton(text="🇷🇺 Русский", callback_data="set_lang_ru")]
    ])
    await callback.message.edit_text("👇 Tilni tanlang / Выберите язык", reply_markup=markup)

@dp.callback_query(F.data.startswith("set_lang_"))
async def cb_set_lang(callback: CallbackQuery):
    lang_code = callback.data.split("_")[-1] # uz or ru
    
    await db.users.update_one(
        {"telegram_id": callback.from_user.id},
        {"$set": {"language": lang_code}}
    )
    
    msg_text = MESSAGES[lang_code]["lang_selected"]
    
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=MESSAGES[lang_code]["open_app"], web_app=WebAppInfo(url=WEBAPP_URL))],
        [InlineKeyboardButton(text="🇺🇿 O'zbekcha / 🇷🇺 Русский", callback_data="change_lang")]
    ])
    
    await callback.message.edit_text(
        MESSAGES[lang_code]["welcome"].format(name=callback.from_user.first_name),
        reply_markup=markup,
        parse_mode="HTML"
    )
    await callback.answer(msg_text)

# ADMIN ACTION HANDLERS
@dp.callback_query(F.data.startswith("admin_"))
async def admin_action_handler(callback: CallbackQuery):
    action, tx_id = callback.data.split("_")[1], callback.data.split("_")[2]
    
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx:
        await callback.answer("Tranzaksiya topilmadi", show_alert=True)
        return
        
    if tx['status'] != 'pending':
        await callback.answer("Allaqachon ko'rib chiqilgan", show_alert=True)
        await callback.message.edit_reply_markup(reply_markup=None)
        return

    if action == "approve":
        if tx['type'] == 'deposit':
            await db.users.update_one({"telegram_id": tx['user_id']}, {"$inc": {"balance": tx['amount']}})
        await db.transactions.update_one({"id": tx_id}, {"$set": {"status": "approved"}})
        status_text = "✅ TASDIQLANDI"
        
        try:
            user = await db.users.find_one({"telegram_id": tx['user_id']})
            lang = user.get("language", "uz")
            msg = MESSAGES[lang]["approved"].format(amount=tx['amount'], currency=tx['currency'])
            await bot.send_message(tx['user_id'], msg)
        except: pass

    elif action == "reject":
        if tx['type'] == 'withdraw':
            await db.users.update_one({"telegram_id": tx['user_id']}, {"$inc": {"balance": tx['amount']}})
        await db.transactions.update_one({"id": tx_id}, {"$set": {"status": "rejected"}})
        status_text = "❌ RAD ETILDI"
        
        try:
            user = await db.users.find_one({"telegram_id": tx['user_id']})
            lang = user.get("language", "uz")
            msg = MESSAGES[lang]["rejected"].format(amount=tx['amount'], currency=tx['currency'])
            await bot.send_message(tx['user_id'], msg)
        except: pass

    original_text = callback.message.html_text
    await callback.message.edit_text(
        f"{original_text}\n\n<b>Holat: {status_text}</b>\n👮‍♂️ Admin: {callback.from_user.first_name}",
        parse_mode="HTML",
        reply_markup=None
    )
    await callback.answer(f"Zayavka {action} qilindi")


async def send_notification(msg: str, tx_type: str, tx_id: str = None):
    if not bot: return
    
    markup = None
    if tx_id:
        markup = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"admin_approve_{tx_id}"),
                InlineKeyboardButton(text="❌ Rad etish", callback_data=f"admin_reject_{tx_id}")
            ]
        ])

    settings = await db.settings.find_one({})
    target_channel = None
    
    if settings:
        if tx_type == 'deposit':
            target_channel = settings.get('deposit_channel_id')
        elif tx_type == 'withdraw':
            target_channel = settings.get('withdraw_channel_id')
        if not target_channel:
            target_channel = settings.get('admin_group_id')

    if target_channel:
        try:
            await bot.send_message(target_channel, msg, parse_mode="HTML", reply_markup=markup)
            return
        except Exception as e:
            logging.error(f"Failed to send to channel {target_channel}: {e}")

    admin_users = await db.users.find({"is_admin": True}).to_list(100)
    admin_ids = set(ADMIN_IDS + [u['telegram_id'] for u in admin_users])
    
    for admin_id in admin_ids:
        try:
            await bot.send_message(admin_id, msg, parse_mode="HTML", reply_markup=markup)
        except Exception as e:
            logging.error(f"Failed to send admin notification to {admin_id}: {e}")

# API Routes
@api_router.get("/")
async def root():
    return {"message": "BuraPay API Running"}

@api_router.post("/auth/login")
async def login(data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    if not telegram_id:
        raise HTTPException(status_code=400, detail="Telegram ID required")
    
    user = await db.users.find_one({"telegram_id": telegram_id}, {"_id": 0})
    is_admin_env = telegram_id in ADMIN_IDS
    
    if not user:
        new_user = User(
            telegram_id=telegram_id,
            first_name=data.get("first_name", "User"),
            username=data.get("username"),
            balance=0.0,
            is_admin=is_admin_env,
            language="uz"
        )
        await db.users.insert_one(new_user.model_dump())
        return new_user
    
    update_fields = {}
    if "internal_id" not in user:
        update_fields["internal_id"] = generate_user_id()
        user["internal_id"] = update_fields["internal_id"]
    if "language" not in user:
        update_fields["language"] = "uz"
        user["language"] = "uz"
    if is_admin_env and not user.get('is_admin'):
        update_fields["is_admin"] = True
        user['is_admin'] = True
    if data.get("first_name") and user.get("first_name") != data.get("first_name"):
        update_fields["first_name"] = data.get("first_name")
        user["first_name"] = data.get("first_name")
    if data.get("username") and user.get("username") != data.get("username"):
        update_fields["username"] = data.get("username")
        user["username"] = data.get("username")
        
    if update_fields:
        await db.users.update_one({"telegram_id": telegram_id}, {"$set": update_fields})
        
    return user

@api_router.get("/user/{telegram_id}")
async def get_profile(telegram_id: int):
    user = await db.users.find_one({"telegram_id": telegram_id}, {"_id": 0})
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    if "internal_id" not in user:
        new_id = generate_user_id()
        await db.users.update_one({"telegram_id": telegram_id}, {"$set": {"internal_id": new_id}})
        user["internal_id"] = new_id
        
    return user

@api_router.post("/user/language")
async def update_language(data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    language = data.get("language")
    if not telegram_id or language not in ["uz", "ru"]:
        raise HTTPException(status_code=400, detail="Invalid data")
    
    await db.users.update_one({"telegram_id": telegram_id}, {"$set": {"language": language}})
    return {"status": "ok"}

@api_router.post("/wallets/add")
async def add_wallet(data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    wallet_data = data.get("wallet")
    if not telegram_id or not wallet_data: raise HTTPException(status_code=400, detail="Invalid data")

    new_wallet = Wallet(**wallet_data)
    result = await db.users.update_one(
        {"telegram_id": telegram_id},
        {"$push": {"wallets": new_wallet.model_dump()}}
    )
    if result.modified_count == 0: raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Hamyon qo'shildi", "wallet": new_wallet}

@api_router.post("/transactions/create")
async def create_transaction(tx: TransactionCreate):
    user = await db.users.find_one({"telegram_id": tx.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if tx.type == 'withdraw':
        if user.get('balance', 0) < tx.amount:
            raise HTTPException(status_code=400, detail="Mablag' yetarli emas")
        await db.users.update_one({"telegram_id": tx.user_id}, {"$inc": {"balance": -tx.amount}})

    transaction = Transaction(**tx.model_dump())
    await db.transactions.insert_one(transaction.model_dump())
    
    # Notification Details
    user_name = user.get("first_name", "Unknown")
    user_username = f"@{user.get('username')}" if user.get('username') else "Mavjud emas"
    user_internal_id = user.get("internal_id", "---")
    user_phone = user.get("phone_number", "Kiritilmagan")
    
    # Find user's attached card (Uzcard/Humo)
    user_attached_card = "Kiritilmagan"
    for w in user.get('wallets', []):
        if w['type'] in ['uzcard', 'humo']:
            user_attached_card = f"{w['type'].upper()} {w['number']}"
            break

    method_name = tx.method.replace('_', ' ').upper()
    if tx.method.startswith('mostbet') and tx.wallet_number:
        method_name += f" ({tx.wallet_number})"
    
    msg = ""
    if tx.type == 'deposit':
        msg = (f"📥 <b>Yangi Depozit!</b>\n\n"
               f"👤 <b>Foydalanuvchi:</b> {user_name}\n"
               f"🔗 <b>Username:</b> {user_username}\n"
               f"🆔 <b>ID:</b> {user_internal_id}\n"
               f"📞 <b>Tel:</b> {user_phone}\n"
               f"💳 <b>Karta:</b> {user_attached_card}\n"
               f"💰 <b>Summa:</b> {tx.amount:,.0f} {tx.currency}\n"
               f"🏦 <b>Tizim:</b> {method_name}\n"
               f"📅 <b>Vaqt:</b> {datetime.now().strftime('%H:%M %d.%m.%Y')}")
    elif tx.type == 'withdraw':
        msg = (f"📤 <b>Pul Yechish!</b>\n\n"
               f"👤 <b>Foydalanuvchi:</b> {user_name}\n"
               f"🔗 <b>Username:</b> {user_username}\n"
               f"🆔 <b>ID:</b> {user_internal_id}\n"
               f"📞 <b>Tel:</b> {user_phone}\n"
               f"💳 <b>Karta:</b> {user_attached_card}\n"
               f"💰 <b>Summa:</b> {tx.amount:,.0f} {tx.currency}\n"
               f"💳 <b>Hamyon:</b> {tx.wallet_number}\n"
               f"🏦 <b>Tizim:</b> {method_name}\n"
               f"🔑 <b>Kod:</b> {tx.secret_code if tx.secret_code else 'Kiritilmagan'}\n"
               f"📅 <b>Vaqt:</b> {datetime.now().strftime('%H:%M %d.%m.%Y')}")
    
    await send_notification(msg, tx.type, transaction.id)
    return transaction

@api_router.get("/transactions/{telegram_id}")
async def get_history(telegram_id: int):
    txs = await db.transactions.find({"user_id": telegram_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return txs

@api_router.get("/admin/transactions/pending")
async def get_pending_transactions():
    txs = await db.transactions.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return txs

@api_router.post("/admin/transactions/{tx_id}/approve")
async def approve_transaction(tx_id: str):
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx or tx['status'] != 'pending': raise HTTPException(status_code=400, detail="Invalid tx")

    if tx['type'] == 'deposit':
        await db.users.update_one({"telegram_id": tx['user_id']}, {"$inc": {"balance": tx['amount']}})
    
    await db.transactions.update_one({"id": tx_id}, {"$set": {"status": "approved"}})
    
    if bot:
        try:
            user = await db.users.find_one({"telegram_id": tx['user_id']})
            lang = user.get("language", "uz")
            msg = MESSAGES[lang]["approved"].format(amount=tx['amount'], currency=tx['currency'])
            await bot.send_message(tx['user_id'], msg)
        except: pass
    return {"status": "approved"}

@api_router.post("/admin/transactions/{tx_id}/reject")
async def reject_transaction(tx_id: str):
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx or tx['status'] != 'pending': raise HTTPException(status_code=400, detail="Invalid tx")

    if tx['type'] == 'withdraw':
        await db.users.update_one({"telegram_id": tx['user_id']}, {"$inc": {"balance": tx['amount']}})
    
    await db.transactions.update_one({"id": tx_id}, {"$set": {"status": "rejected"}})
    
    if bot:
        try:
            user = await db.users.find_one({"telegram_id": tx['user_id']})
            lang = user.get("language", "uz")
            msg = MESSAGES[lang]["rejected"].format(amount=tx['amount'], currency=tx['currency'])
            await bot.send_message(tx['user_id'], msg)
        except: pass
    return {"status": "rejected"}

@api_router.get("/admin/stats")
async def get_admin_stats():
    total_users = await db.users.count_documents({})
    balance_agg = await db.users.aggregate([{"$group": {"_id": None, "total": {"$sum": "$balance"}}}]).to_list(1)
    total_balance = balance_agg[0]['total'] if balance_agg else 0
    deposit_agg = await db.transactions.aggregate([{"$match": {"type": "deposit", "status": "approved"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
    total_deposits = deposit_agg[0]['total'] if deposit_agg else 0
    pending_count = await db.transactions.count_documents({"status": "pending"})
    return {"total_users": total_users, "total_balance": total_balance, "total_deposits": total_deposits, "pending_count": pending_count}

@api_router.get("/admin/users")
async def get_all_users(search: str = ""):
    query = {}
    if search:
        if search.isdigit(): query = {"$or": [{"telegram_id": int(search)}, {"internal_id": search}]}
        else: query = {"first_name": {"$regex": search, "$options": "i"}}
    users = await db.users.find(query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return users

@api_router.post("/admin/users/{telegram_id}/balance")
async def update_user_balance(telegram_id: int, data: dict = Body(...)):
    amount = float(data.get("amount", 0))
    tx_type = data.get("type", "credit")
    if amount <= 0: raise HTTPException(status_code=400, detail="Invalid amount")

    inc_amount = amount if tx_type == "credit" else -amount
    res = await db.users.update_one({"telegram_id": telegram_id}, {"$inc": {"balance": inc_amount}})
    if res.modified_count == 0: raise HTTPException(status_code=404, detail="User not found")
    
    tx = Transaction(
        user_id=telegram_id, type="deposit" if tx_type == "credit" else "withdraw",
        amount=amount, currency="UZS", method="admin_adjustment", status="approved", wallet_number="Admin Adjustment"
    )
    await db.transactions.insert_one(tx.model_dump())
    
    if bot:
        try:
            user = await db.users.find_one({"telegram_id": telegram_id})
            lang = user.get("language", "uz")
            action = "to'ldirildi" if lang == "uz" else "пополнен"
            if tx_type == 'debit': action = "kamaytirildi" if lang == "uz" else "уменьшен"
            
            if lang == "uz":
                msg = f"💰 Sizning hisobingiz admin tomonidan {amount:,.0f} UZS ga {action}."
            else:
                msg = f"💰 Ваш баланс {action} админом на {amount:,.0f} UZS."
            await bot.send_message(telegram_id, msg)
        except: pass
    return {"message": "Balance updated"}

# Settings API
@api_router.get("/admin/settings")
async def get_settings():
    settings = await db.settings.find_one({}, {"_id": 0})
    return settings or {}

@api_router.post("/admin/settings")
async def update_settings(data: Settings):
    update_data = data.model_dump(exclude_unset=True)
    if update_data:
        await db.settings.update_one({}, {"$set": update_data}, upsert=True)
    return {"status": "updated"}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO)

@app.on_event("startup")
async def start_bot():
    if bot: asyncio.create_task(dp.start_polling(bot))

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    if bot: await bot.session.close()
