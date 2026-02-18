from fastapi import FastAPI, APIRouter, HTTPException, Body, Request
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
import hashlib
import hmac
import httpx
import json
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
WEBAPP_URL = "https://wallet-app-22.preview.emergentagent.com"

bot = Bot(token=BOT_TOKEN) if BOT_TOKEN else None
dp = Dispatcher()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Mostbet Kassa API Configuration
MOSTBET_API_KEY = os.environ.get('MOSTBET_API_KEY', '')
MOSTBET_SECRET_KEY = os.environ.get('MOSTBET_SECRET_KEY', '')
MOSTBET_CASHPOINT_ID = os.environ.get('MOSTBET_CASHPOINT_ID', '')

def mostbet_sign(api_key: str, secret: str, path: str, body_str: str, timestamp: str) -> str:
    """Generate HMAC SHA3-256 signature per Mostbet API docs."""
    sign_string = f"api-key:{api_key}{path}{body_str}{timestamp}"
    return hmac.new(
        secret.encode('utf-8'),
        sign_string.encode('utf-8'),
        hashlib.sha3_256
    ).hexdigest()

def mostbet_headers(api_key: str, secret: str, path: str, body_str: str, timestamp: str, project: str = None) -> dict:
    """Build required Mostbet API headers."""
    sig = mostbet_sign(api_key, secret, path, body_str, timestamp)
    h = {
        "X-Api-Key": f"api-key:{api_key}",
        "X-Timestamp": timestamp,
        "X-Signature": sig,
    }
    if project:
        h["X-Project"] = project
        h["Content-Type"] = "application/json"
    return h

async def mostbet_deposit(player_id: str, amount: float, currency: str = "UZS") -> dict:
    """Transfer money to player's Mostbet account via Kassa API."""
    if not MOSTBET_API_KEY or not MOSTBET_SECRET_KEY or not MOSTBET_CASHPOINT_ID:
        return {"success": False, "error": "Kassa credentials not configured"}
    
    try:
        path = f"/mbc/gateway/v1/api/cashpoint/{MOSTBET_CASHPOINT_ID}/player/deposit"
        url = f"https://apimb.com{path}"
        
        body = {
            "brandId": 1,
            "playerId": str(player_id),
            "amount": int(amount),
            "currency": currency
        }
        body_str = json.dumps(body, separators=(',', ':'))
        
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        
        headers = mostbet_headers(MOSTBET_API_KEY, MOSTBET_SECRET_KEY, path, body_str, timestamp, project="MBC")
        
        logging.info(f"Mostbet API Request: {url}")
        logging.info(f"Body: {body_str}")
        logging.info(f"Timestamp: {timestamp}")
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(url, content=body_str, headers=headers)
            
            logging.info(f"Mostbet API Response: {response.status_code} - {response.text}")
            
            if response.status_code == 200:
                return {"success": True, "data": response.json()}
            else:
                try:
                    err = response.json()
                    msg = err.get("message", "") or err.get("code", "")
                except Exception:
                    msg = response.text[:200]
                return {"success": False, "error": msg}
                
    except Exception as e:
        logging.error(f"Mostbet API Error: {e}")
        return {"success": False, "error": str(e)}

def generate_user_id():
    """Generate a 7-digit random ID"""
    return str(random.randint(1000000, 9999999))

class Wallet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str 
    number: str
    expiry: Optional[str] = None 
    name: Optional[str] = None

class AdminCard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str # 'uzcard', 'humo', 'mostbet_uzs', 'mostbet_usd'
    number: str
    holder_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class User(BaseModel):
    telegram_id: int
    internal_id: str = Field(default_factory=generate_user_id)
    first_name: str
    username: Optional[str] = None
    phone_number: Optional[str] = None
    balance: float = 0.0  # Legacy field
    balance_uzs: float = 0.0
    balance_usd: float = 0.0
    wallets: List[Wallet] = []
    is_admin: bool = False
    language: str = "uz" # 'uz' or 'ru'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

def generate_short_id():
    """Generate a short 8-character ID for callback data"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    short_id: str = Field(default_factory=generate_short_id)
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
    deposit_channel_id: Optional[str] = None
    withdraw_channel_id: Optional[str] = None
    exchange_rate: float = 12800.0

# Messages
MESSAGES = {
    "uz": {
        "welcome": "👋 Salom, {name}!\n\n<b>BuraPay</b> - ishonchli to'lov tizimiga xush kelibsiz.\nHisobni to'ldirish va yechish uchun pastdagi tugmani bosing.",
        "open_app": "📱 BuraPay ilovasini ochish",
        "approved": "✅ Sizning {amount:,.0f} {currency} miqdoridagi so'rovingiz tasdiqlandi!",
        "rejected": "❌ Sizning {amount:,.0f} {currency} miqdoridagi so'rovingiz bekor qilindi.",
        "choose_lang": "👇 Tilni tanlang / Выберите язык",
        "lang_selected": "✅ Til o'zgartirildi: O'zbekcha",
        "balance_updated": "💰 Sizning hisobingiz admin tomonidan {amount:,.0f} UZS ga {action}."
    },
    "ru": {
        "welcome": "👋 Привет, {name}!\n\nДобро пожаловать в <b>BuraPay</b> - надежную платежную систему.\nНажмите кнопку ниже для пополнения и вывода средств.",
        "open_app": "📱 Открыть приложение BuraPay",
        "approved": "✅ Ваша заявка на {amount:,.0f} {currency} одобрена!",
        "rejected": "❌ Ваша заявка на {amount:,.0f} {currency} отклонена.",
        "choose_lang": "👇 Tilni tanlang / Выберите язык",
        "lang_selected": "✅ Язык изменен: Русский",
        "balance_updated": "💰 Ваш баланс изменен админом: {action} {amount:,.0f} UZS."
    }
}

# Bot Handlers
@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    try:
        user_data = await db.users.find_one({"telegram_id": message.from_user.id})
        
        if not user_data:
            new_user = User(
                telegram_id=message.from_user.id,
                first_name=message.from_user.first_name,
                username=message.from_user.username,
                balance=0.0,
                language="uz"
            )
            await db.users.insert_one(new_user.model_dump())
            user_data = new_user.model_dump()
        
        lang = user_data.get("language", "uz")
        
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
    try:
        parts = callback.data.split("_")
        if len(parts) < 3:
            await callback.answer("Noto'g'ri format", show_alert=True)
            return
        
        action = parts[1]  # approve or reject
        tx_id = "_".join(parts[2:])  # Join remaining parts for UUID
        
        logging.info(f"Admin action: {action} for tx_id: {tx_id}")
        
        tx = await db.transactions.find_one({"id": tx_id})
        if not tx:
            # Try to find by short_id if full id not found
            tx = await db.transactions.find_one({"short_id": tx_id})
        
        if not tx:
            logging.error(f"Transaction not found: {tx_id}")
            await callback.answer("Tranzaksiya topilmadi", show_alert=True)
            return
            
        if tx['status'] != 'pending':
            await callback.answer("Allaqachon ko'rib chiqilgan", show_alert=True)
            await callback.message.edit_reply_markup(reply_markup=None)
            return

        # Determine balance field based on currency
        balance_field = 'balance_uzs' if tx['currency'] == 'UZS' else 'balance_usd'

        if action == "approve":
            # Get user's Mostbet ID for kassa transfer
            user = await db.users.find_one({"telegram_id": tx['user_id']})
            mostbet_type = 'mostbet_uzs' if tx['currency'] == 'UZS' else 'mostbet_usd'
            mostbet_id = None
            for w in user.get('wallets', []):
                if w['type'] == mostbet_type:
                    mostbet_id = w['number']
                    break
            if not mostbet_id:
                for w in user.get('wallets', []):
                    if w['type'].startswith('mostbet'):
                        mostbet_id = w['number']
                        break
            
            # Auto transfer via Mostbet Kassa API
            kassa_result = None
            if mostbet_id and tx['type'] == 'deposit':
                kassa_result = await mostbet_deposit(mostbet_id, tx['amount'], tx['currency'])
                logging.info(f"Mostbet Kassa Result: {kassa_result}")
            
            if tx['type'] == 'deposit':
                await db.users.update_one({"telegram_id": tx['user_id']}, {"$inc": {balance_field: tx['amount']}})
            await db.transactions.update_one({"id": tx['id']}, {"$set": {"status": "approved"}})
            
            # Status text based on kassa result
            if kassa_result and kassa_result.get('success'):
                status_text = "✅ TASDIQLANDI (Kassadan o'tkazildi)"
                kassa_msg = (f"✅ <b>KASSA O'TKAZISH MUVAFFAQIYATLI!</b>\n"
                            f"━━━━━━━━━━━━━━━━━━━━\n"
                            f"🎮 <b>Mostbet ID:</b> <code>{mostbet_id}</code>\n"
                            f"💵 <b>Summa:</b> {tx['amount']:,.0f} {tx['currency']}\n"
                            f"━━━━━━━━━━━━━━━━━━━━\n"
                            f"💰 Avtomatik o'tkazildi!")
            elif kassa_result and not kassa_result.get('success'):
                status_text = "✅ TASDIQLANDI (Kassa xato)"
                error_msg = kassa_result.get('error', 'Noma\'lum xato')
                kassa_msg = (f"⚠️ <b>KASSA XATOLIK!</b>\n"
                            f"━━━━━━━━━━━━━━━━━━━━\n"
                            f"🎮 <b>Mostbet ID:</b> <code>{mostbet_id}</code>\n"
                            f"💵 <b>Summa:</b> {tx['amount']:,.0f} {tx['currency']}\n"
                            f"❌ <b>Xato:</b> {error_msg}\n"
                            f"━━━━━━━━━━━━━━━━━━━━\n"
                            f"📋 Qo'lda o'tkazing!")
            else:
                status_text = "✅ TASDIQLANDI"
                kassa_msg = (f"💰 <b>KASSA ORQALI O'TKAZISH:</b>\n"
                            f"━━━━━━━━━━━━━━━━━━━━\n"
                            f"🎮 <b>Mostbet ID:</b> <code>{mostbet_id or 'Topilmadi'}</code>\n"
                            f"💵 <b>Summa:</b> {tx['amount']:,.0f} {tx['currency']}\n"
                            f"━━━━━━━━━━━━━━━━━━━━\n"
                            f"📋 Qo'lda o'tkazing!")
            
            try:
                await bot.send_message(callback.from_user.id, kassa_msg, parse_mode="HTML")
            except: pass

        elif action == "reject":
            if tx['type'] == 'withdraw':
                await db.users.update_one({"telegram_id": tx['user_id']}, {"$inc": {balance_field: tx['amount']}})
            await db.transactions.update_one({"id": tx['id']}, {"$set": {"status": "rejected"}})
            status_text = "❌ RAD ETILDI"

        original_text = callback.message.html_text
        await callback.message.edit_text(
            f"{original_text}\n\n<b>Holat: {status_text}</b>\n👮‍♂️ Admin: {callback.from_user.first_name}",
            parse_mode="HTML",
            reply_markup=None
        )
        await callback.answer(f"Zayavka {action} qilindi")
    except Exception as e:
        logging.error(f"Error in admin_action_handler: {e}")
        await callback.answer("Xatolik yuz berdi", show_alert=True)


async def send_notification(msg: str, tx_type: str, short_id: str = None):
    if not bot: return
    
    markup = None
    if short_id:
        markup = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"admin_approve_{short_id}"),
                InlineKeyboardButton(text="❌ Rad etish", callback_data=f"admin_reject_{short_id}")
            ]
        ])

    settings = await db.settings.find_one({})
    target_channel = None
    
    if settings:
        if tx_type == 'deposit':
            target_channel = settings.get('deposit_channel_id')
        elif tx_type == 'withdraw':
            target_channel = settings.get('withdraw_channel_id')

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
    # Set is_admin from env OR keep existing is_admin status
    if is_admin_env and not user.get('is_admin'):
        update_fields["is_admin"] = True
        user['is_admin'] = True
    # Keep existing is_admin if already set (don't reset to false)
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
    
    # Add has_card field for frontend
    wallets = user.get('wallets', [])
    user['has_card'] = any(w['type'] in ['uzcard', 'humo'] for w in wallets)
    
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

@api_router.post("/wallets/delete")
async def delete_wallet(data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    wallet_id = data.get("wallet_id")
    if not telegram_id or not wallet_id: 
        raise HTTPException(status_code=400, detail="Invalid data")

    result = await db.users.update_one(
        {"telegram_id": telegram_id},
        {"$pull": {"wallets": {"id": wallet_id}}}
    )
    if result.modified_count == 0: 
        raise HTTPException(status_code=404, detail="Wallet not found")
    return {"message": "Hamyon o'chirildi"}

@api_router.post("/wallets/update")
async def update_wallet(data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    wallet_id = data.get("wallet_id")
    wallet_data = data.get("wallet")
    
    if not telegram_id or not wallet_id or not wallet_data:
        raise HTTPException(status_code=400, detail="Invalid data")

    # Build update query for nested array element
    update_fields = {}
    if wallet_data.get("number"):
        update_fields["wallets.$.number"] = wallet_data["number"]
    if wallet_data.get("expiry") is not None:
        update_fields["wallets.$.expiry"] = wallet_data["expiry"]
    if wallet_data.get("type"):
        update_fields["wallets.$.type"] = wallet_data["type"]

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.users.update_one(
        {"telegram_id": telegram_id, "wallets.id": wallet_id},
        {"$set": update_fields}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return {"message": "Hamyon yangilandi"}

@api_router.post("/transactions/create")
async def create_transaction(tx: TransactionCreate):
    user = await db.users.find_one({"telegram_id": tx.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for mandatory Uzcard/Humo card
    user_wallets = user.get('wallets', [])
    has_card = any(w['type'] in ['uzcard', 'humo'] for w in user_wallets)
    if not has_card:
        raise HTTPException(status_code=400, detail="Avval Uzcard yoki Humo karta qo'shing")

    # Determine balance field based on currency
    balance_field = 'balance_uzs' if tx.currency == 'UZS' else 'balance_usd'
    current_balance = user.get(balance_field, 0)

    if tx.type == 'withdraw':
        if current_balance < tx.amount:
            raise HTTPException(status_code=400, detail="Mablag' yetarli emas")
        await db.users.update_one({"telegram_id": tx.user_id}, {"$inc": {balance_field: -tx.amount}})

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

    # Find user's Mostbet ID based on currency
    mostbet_id = "Kiritilmagan"
    mostbet_type = 'mostbet_uzs' if tx.currency == 'UZS' else 'mostbet_usd'
    for w in user.get('wallets', []):
        if w['type'] == mostbet_type:
            mostbet_id = w['number']
            break
    # If not found, try any Mostbet wallet
    if mostbet_id == "Kiritilmagan":
        for w in user.get('wallets', []):
            if w['type'].startswith('mostbet'):
                mostbet_id = w['number']
                break

    method_name = tx.method.replace('_', ' ').upper()
    if tx.method.startswith('mostbet') and tx.wallet_number:
        method_name += f" ({tx.wallet_number})"
    
    msg = ""
    if tx.type == 'deposit':
        msg = (f"📥 <b>Yangi Depozit!</b>\n\n"
               f"👤 <b>Foydalanuvchi:</b> {user_name}\n"
               f"🔗 <b>Username:</b> {user_username}\n"
               f"🎮 <b>Mostbet ID:</b> {mostbet_id}\n"
               f"📞 <b>Tel:</b> {user_phone}\n"
               f"💳 <b>Karta:</b> {user_attached_card}\n"
               f"💰 <b>Summa:</b> {tx.amount:,.0f} {tx.currency}\n"
               f"🏦 <b>Tizim:</b> {method_name}\n"
               f"📅 <b>Vaqt:</b> {datetime.now().strftime('%H:%M %d.%m.%Y')}")
    elif tx.type == 'withdraw':
        msg = (f"📤 <b>Pul Yechish!</b>\n\n"
               f"👤 <b>Foydalanuvchi:</b> {user_name}\n"
               f"🔗 <b>Username:</b> {user_username}\n"
               f"🎮 <b>Mostbet ID:</b> {mostbet_id}\n"
               f"📞 <b>Tel:</b> {user_phone}\n"
               f"💳 <b>Karta:</b> {user_attached_card}\n"
               f"💰 <b>Summa:</b> {tx.amount:,.0f} {tx.currency}\n"
               f"💳 <b>Hamyon:</b> {tx.wallet_number}\n"
               f"🏦 <b>Tizim:</b> {method_name}\n"
               f"🔑 <b>Kod:</b> {tx.secret_code if tx.secret_code else 'Kiritilmagan'}\n"
               f"📅 <b>Vaqt:</b> {datetime.now().strftime('%H:%M %d.%m.%Y')}")
    
    # Use short_id for callback data (Telegram limit is 64 bytes)
    await send_notification(msg, tx.type, transaction.short_id)
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

    # Determine balance field based on currency
    balance_field = 'balance_uzs' if tx['currency'] == 'UZS' else 'balance_usd'

    if tx['type'] == 'deposit':
        await db.users.update_one({"telegram_id": tx['user_id']}, {"$inc": {balance_field: tx['amount']}})
    
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

    # Determine balance field based on currency
    balance_field = 'balance_uzs' if tx['currency'] == 'UZS' else 'balance_usd'

    if tx['type'] == 'withdraw':
        await db.users.update_one({"telegram_id": tx['user_id']}, {"$inc": {balance_field: tx['amount']}})
    
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
    currency = data.get("currency", "UZS")  # Default to UZS
    if amount <= 0: raise HTTPException(status_code=400, detail="Invalid amount")

    # Determine balance field based on currency
    balance_field = 'balance_uzs' if currency == 'UZS' else 'balance_usd'
    
    inc_amount = amount if tx_type == "credit" else -amount
    res = await db.users.update_one({"telegram_id": telegram_id}, {"$inc": {balance_field: inc_amount}})
    if res.modified_count == 0: raise HTTPException(status_code=404, detail="User not found")
    
    tx = Transaction(
        user_id=telegram_id, type="deposit" if tx_type == "credit" else "withdraw",
        amount=amount, currency=currency, method="admin_adjustment", status="approved", wallet_number="Admin Adjustment"
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

# Admin Cards API
@api_router.get("/admin/cards")
async def get_admin_cards():
    cards = await db.admin_cards.find({}, {"_id": 0}).to_list(100)
    return cards

@api_router.post("/admin/cards")
async def add_admin_card(card: dict = Body(...)):
    new_card = AdminCard(**card)
    await db.admin_cards.insert_one(new_card.model_dump())
    return {"message": "Card added", "card": new_card}

@api_router.delete("/admin/cards/{id}")
async def delete_admin_card(id: str):
    res = await db.admin_cards.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"message": "Card deleted"}

# Settings API
@api_router.get("/admin/settings")
async def get_settings():
    settings = await db.settings.find_one({}, {"_id": 0})
    result = settings or {}
    result["mostbet_api_key"] = MOSTBET_API_KEY[:8] + "..." if MOSTBET_API_KEY else ""
    result["mostbet_cashpoint_id"] = MOSTBET_CASHPOINT_ID
    return result

@api_router.get("/admin/kassa/balance")
async def get_kassa_balance():
    """Check Mostbet Kassa balance via API."""
    if not MOSTBET_API_KEY or not MOSTBET_SECRET_KEY or not MOSTBET_CASHPOINT_ID:
        return {"success": False, "error": "Kassa credentials not configured"}
    try:
        path = f"/mbc/gateway/v1/api/cashpoint/{MOSTBET_CASHPOINT_ID}/balance"
        url = f"https://apimb.com{path}"
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        headers = mostbet_headers(MOSTBET_API_KEY, MOSTBET_SECRET_KEY, path, "", timestamp)
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            response = await http_client.get(url, headers=headers)
            if response.status_code == 200:
                return {"success": True, "data": response.json()}
            return {"success": False, "error": f"{response.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@api_router.post("/admin/settings")
async def update_settings(data: Settings):
    update_data = data.model_dump(exclude_unset=True)
    if update_data:
        await db.settings.update_one({}, {"$set": update_data}, upsert=True)
    return {"status": "updated"}

# Webhook endpoint for Telegram (must be before app.include_router)
@api_router.post("/webhook")
async def telegram_webhook(request: Request):
    try:
        data = await request.json()
        logging.info(f"Webhook received: {data.get('update_id', 'no update_id')}")
        update = types.Update.model_validate(data)
        await dp.feed_update(bot, update)
    except Exception as e:
        logging.error(f"Webhook error: {e}")
    return {"ok": True}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO)

@app.on_event("startup")
async def start_bot():
    if bot:
        # Delete any existing webhook and set new one
        await bot.delete_webhook(drop_pending_updates=True)
        
        # Get webhook URL - use base URL without /api prefix
        base_url = WEBAPP_URL.rstrip('/')
        webhook_url = f"{base_url}/api/webhook"
        
        # Set webhook
        try:
            result = await bot.set_webhook(webhook_url)
            logging.info(f"Webhook set to: {webhook_url}, result: {result}")
        except Exception as e:
            logging.error(f"Failed to set webhook: {e}")
            # Fallback to polling if webhook fails
            asyncio.create_task(dp.start_polling(bot))

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    if bot: 
        await bot.delete_webhook()
        await bot.session.close()
