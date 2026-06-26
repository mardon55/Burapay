from fastapi import FastAPI, APIRouter, HTTPException, Body, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
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
# Hardcoded superadmin — always has admin rights regardless of env vars or DB
SUPERADMIN_ID = 8321879273

ADMIN_IDS = [int(x) for x in os.environ.get('ADMIN_IDS', '').split(',') if x.strip()]
if SUPERADMIN_ID not in ADMIN_IDS:
    ADMIN_IDS.append(SUPERADMIN_ID)

def is_superadmin(telegram_id) -> bool:
    """Returns True if telegram_id matches superadmin — accepts both int and str."""
    try:
        return int(telegram_id) == SUPERADMIN_ID
    except (TypeError, ValueError):
        return str(telegram_id) == str(SUPERADMIN_ID)
BOT_USERNAME = "MR_KASSABOT"

def detect_public_url() -> str:
    """Auto-detect public URL from any hosting platform environment variables."""
    # Manually set — highest priority
    if os.environ.get('WEBAPP_URL'):
        return os.environ['WEBAPP_URL'].rstrip('/')
    # Replit
    if os.environ.get('REPLIT_DEV_DOMAIN'):
        return f"https://{os.environ['REPLIT_DEV_DOMAIN']}"
    if os.environ.get('REPLIT_DOMAINS'):
        domain = os.environ['REPLIT_DOMAINS'].split(',')[0].strip()
        return f"https://{domain}"
    # Railway
    if os.environ.get('RAILWAY_PUBLIC_DOMAIN'):
        return f"https://{os.environ['RAILWAY_PUBLIC_DOMAIN']}"
    if os.environ.get('RAILWAY_STATIC_URL'):
        url = os.environ['RAILWAY_STATIC_URL']
        return url if url.startswith('http') else f"https://{url}"
    # Render
    if os.environ.get('RENDER_EXTERNAL_URL'):
        return os.environ['RENDER_EXTERNAL_URL'].rstrip('/')
    # Fly.io
    if os.environ.get('FLY_APP_NAME'):
        return f"https://{os.environ['FLY_APP_NAME']}.fly.dev"
    # Heroku
    if os.environ.get('HEROKU_APP_NAME'):
        return f"https://{os.environ['HEROKU_APP_NAME']}.herokuapp.com"
    # Generic fallback
    if os.environ.get('PUBLIC_URL'):
        return os.environ['PUBLIC_URL'].rstrip('/')
    if os.environ.get('BASE_URL'):
        return os.environ['BASE_URL'].rstrip('/')
    return ''

WEBAPP_URL = detect_public_url()

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

async def mostbet_get_cashout_list(player_id: str) -> dict:
    """Get pending cashout requests for a player from Kassa API."""
    if not MOSTBET_API_KEY or not MOSTBET_SECRET_KEY or not MOSTBET_CASHPOINT_ID:
        return {"success": False, "error": "Kassa credentials not configured"}
    try:
        query = f"?page=1&size=50&searchString={player_id}"
        path = f"/mbc/gateway/v1/api/cashpoint/{MOSTBET_CASHPOINT_ID}/player/cashout/list/page{query}"
        url = f"https://apimb.com{path}"
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        headers = mostbet_headers(MOSTBET_API_KEY, MOSTBET_SECRET_KEY, path, "", timestamp)
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.get(url, headers=headers)
            logging.info(f"Mostbet Cashout List: {response.status_code} - {response.text}")
            if response.status_code == 200:
                return {"success": True, "data": response.json()}
            return {"success": False, "error": f"{response.status_code}"}
    except Exception as e:
        logging.error(f"Mostbet Cashout List Error: {e}")
        return {"success": False, "error": str(e)}

async def mostbet_confirm_cashout(code: str, transaction_id: int) -> dict:
    """Confirm a cashout request using the player's SMS code."""
    if not MOSTBET_API_KEY or not MOSTBET_SECRET_KEY or not MOSTBET_CASHPOINT_ID:
        return {"success": False, "error": "Kassa credentials not configured"}
    try:
        path = f"/mbc/gateway/v1/api/cashpoint/{MOSTBET_CASHPOINT_ID}/player/cashout/confirmation"
        url = f"https://apimb.com{path}"
        body = {"code": str(code), "transactionId": int(transaction_id)}
        body_str = json.dumps(body, separators=(',', ':'))
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        headers = mostbet_headers(MOSTBET_API_KEY, MOSTBET_SECRET_KEY, path, body_str, timestamp, project="MBC")
        logging.info(f"Mostbet Cashout Confirm: url={url}, body={body_str}")
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(url, content=body_str, headers=headers)
            logging.info(f"Mostbet Cashout Confirm Response: {response.status_code} - {response.text}")
            if response.status_code == 200:
                return {"success": True, "data": response.json()}
            try:
                err = response.json()
                error_code = err.get("code", "")
                error_msg = err.get("message", "")
                return {"success": False, "error": error_code, "message": error_msg}
            except Exception:
                return {"success": False, "error": response.text[:200]}
    except Exception as e:
        logging.error(f"Mostbet Cashout Confirm Error: {e}")
        return {"success": False, "error": str(e)}

def generate_user_id():
    """Generate a 7-digit random ID"""
    return str(random.randint(1000000, 9999999))

async def generate_unique_bot_id() -> str:
    """Generate a unique MR-prefixed Bot ID (MR + 7 digits), retrying until unique."""
    while True:
        candidate = "MR" + str(random.randint(1000000, 9999999))
        existing = await db.users.find_one({"bot_id": candidate})
        if not existing:
            return candidate

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
    bot_id: Optional[str] = None
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
    required_channels: List[dict] = []

class DepositRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    short_id: str = Field(default_factory=generate_short_id)
    user_telegram_id: int
    user_bot_id: str
    amount: float
    card_number: str
    status: Literal['pending', 'completed', 'rejected'] = 'pending'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Messages
async def check_subscription(user_id: int) -> dict:
    """Check if user is subscribed to all required channels."""
    settings = await db.settings.find_one({})
    channels = (settings or {}).get("required_channels", [])
    if not channels:
        return {"subscribed": True, "channels": []}
    
    not_subscribed = []
    for ch in channels:
        try:
            # Try with channel_id first, then channel username
            chat_id = ch["channel_id"]
            # If channel link has @username, extract it
            link = ch.get("channel_link", "")
            username = None
            if link and "t.me/" in link:
                username = "@" + link.split("t.me/")[-1].strip("/")
            
            member = None
            try:
                member = await bot.get_chat_member(chat_id=int(chat_id), user_id=user_id)
            except Exception:
                if username:
                    member = await bot.get_chat_member(chat_id=username, user_id=user_id)
            
            if member and member.status in ["left", "kicked"]:
                not_subscribed.append(ch)
            elif not member:
                not_subscribed.append(ch)
        except Exception as e:
            logging.error(f"Subscription check error for channel {ch.get('channel_id')}: {e}")
            # If bot can't check (not admin), skip this channel
            continue
    
    return {"subscribed": len(not_subscribed) == 0, "channels": not_subscribed}

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
        
        # Check subscription
        sub_result = await check_subscription(message.from_user.id)
        if not sub_result["subscribed"]:
            buttons = []
            for ch in sub_result["channels"]:
                name = ch.get("channel_name", "Kanal")
                link = ch.get("channel_link", "")
                if link:
                    buttons.append([InlineKeyboardButton(text=f"➡️ {name}", url=link)])
            buttons.append([InlineKeyboardButton(text="✅ Tekshirish / Проверить", callback_data="check_sub")])
            markup = InlineKeyboardMarkup(inline_keyboard=buttons)
            
            if lang == "ru":
                text = "⚠️ Для использования бота подпишитесь на каналы:"
            else:
                text = "⚠️ Botdan foydalanish uchun kanallarga obuna bo'ling:"
            await message.answer(text, reply_markup=markup)
            return
        
        markup = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=MESSAGES[lang]["open_app"], web_app=WebAppInfo(url=WEBAPP_URL))],
            [InlineKeyboardButton(text="🇺🇿 O'zbekcha / 🇷🇺 Русский", callback_data="change_lang")],
            [InlineKeyboardButton(text="📞 Qo'llab-quvvatlash / Поддержка", url="https://t.me/MR_KASSABOT")]
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

@dp.callback_query(F.data == "check_sub")
async def cb_check_sub(callback: CallbackQuery):
    sub_result = await check_subscription(callback.from_user.id)
    if sub_result["subscribed"]:
        user_data = await db.users.find_one({"telegram_id": callback.from_user.id})
        lang = (user_data or {}).get("language", "uz")
        markup = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=MESSAGES[lang]["open_app"], web_app=WebAppInfo(url=WEBAPP_URL))],
            [InlineKeyboardButton(text="🇺🇿 O'zbekcha / 🇷🇺 Русский", callback_data="change_lang")],
            [InlineKeyboardButton(text="📞 Qo'llab-quvvatlash / Поддержка", url="https://t.me/MR_KASSABOT")]
        ])
        await callback.message.edit_text(
            MESSAGES[lang]["welcome"].format(name=callback.from_user.first_name),
            reply_markup=markup, parse_mode="HTML"
        )
    else:
        await callback.answer("Kanallarga obuna bo'ling! / Подпишитесь на каналы!", show_alert=True)

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
            try:
                original_text = callback.message.html_text
                await callback.message.edit_text(
                    f"{original_text}\n\n<b>Holat: ❌ Tranzaksiya topilmadi</b>",
                    parse_mode="HTML",
                    reply_markup=None
                )
            except: pass
            return
            
        if tx['status'] != 'pending':
            await callback.answer("Allaqachon ko'rib chiqilgan", show_alert=True)
            try:
                await callback.message.edit_reply_markup(reply_markup=None)
            except: pass
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
            
            # Auto transfer via Mostbet Kassa API (ONLY for deposits)
            kassa_result = None
            if mostbet_id and tx['type'] == 'deposit':
                kassa_result = await mostbet_deposit(mostbet_id, tx['amount'], tx['currency'])
                logging.info(f"Mostbet Kassa Result: {kassa_result}")
            
            if tx['type'] == 'deposit':
                await db.users.update_one({"telegram_id": tx['user_id']}, {"$inc": {balance_field: tx['amount']}})
            await db.transactions.update_one({"id": tx['id']}, {"$set": {"status": "approved"}})
            
            # Status text based on kassa result
            if tx['type'] == 'deposit' and kassa_result and kassa_result.get('success'):
                status_text = "✅ TASDIQLANDI (Kassadan o'tkazildi)"
            elif tx['type'] == 'deposit' and kassa_result and not kassa_result.get('success'):
                status_text = "✅ TASDIQLANDI (Kassa xato)"
            else:
                status_text = "✅ TASDIQLANDI"

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

@dp.callback_query(F.data.startswith("bal_"))
async def bal_action_handler(callback: CallbackQuery):
    """Handle balance deposit approve/reject from Telegram inline buttons."""
    try:
        parts = callback.data.split("_")
        if len(parts) < 3:
            await callback.answer("Noto'g'ri format", show_alert=True)
            return

        action = parts[1]  # approve or reject
        short_id = "_".join(parts[2:])

        req = await db.deposit_requests.find_one({"short_id": short_id})
        if not req:
            await callback.answer("So'rov topilmadi", show_alert=True)
            return

        if req['status'] != 'pending':
            await callback.answer("Allaqachon ko'rib chiqilgan", show_alert=True)
            try:
                await callback.message.edit_reply_markup(reply_markup=None)
            except: pass
            return

        if action == "approve":
            await db.deposit_requests.update_one({"id": req['id']}, {"$set": {"status": "completed"}})
            await db.users.update_one({"telegram_id": req['user_telegram_id']}, {"$inc": {"balance_uzs": req['amount']}})
            # Write to transactions for Reports history
            tx_record = {
                "id": str(uuid.uuid4()),
                "short_id": generate_short_id(),
                "user_id": req['user_telegram_id'],
                "type": "deposit",
                "amount": req['amount'],
                "currency": "UZS",
                "method": "balance",
                "wallet_number": req['user_bot_id'],
                "status": "approved",
                "created_at": datetime.now(timezone.utc)
            }
            await db.transactions.insert_one(tx_record)
            status_text = "✅ TASDIQLANDI"
        elif action == "reject":
            await db.deposit_requests.update_one({"id": req['id']}, {"$set": {"status": "rejected"}})
            status_text = "❌ RAD ETILDI"
        else:
            await callback.answer("Noma'lum amal", show_alert=True)
            return

        original_text = callback.message.html_text
        await callback.message.edit_text(
            f"{original_text}\n\n<b>Holat: {status_text}</b>\n👮‍♂️ Admin: {callback.from_user.first_name}",
            parse_mode="HTML",
            reply_markup=None
        )
        await callback.answer(f"So'rov {action} qilindi")
    except Exception as e:
        logging.error(f"Error in bal_action_handler: {e}")
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
    # Superadmin always gets admin rights — check both int/str forms
    is_admin_env = is_superadmin(telegram_id) or (telegram_id in ADMIN_IDS)
    
    if not user:
        bot_id = await generate_unique_bot_id()
        new_user = User(
            telegram_id=telegram_id,
            first_name=data.get("first_name", "User"),
            username=data.get("username"),
            bot_id=bot_id,
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
    if not user.get("bot_id"):
        new_bot_id = await generate_unique_bot_id()
        update_fields["bot_id"] = new_bot_id
        user["bot_id"] = new_bot_id
    if "language" not in user:
        update_fields["language"] = "uz"
        user["language"] = "uz"
    # Set is_admin — superadmin is NEVER stripped of admin rights
    if is_superadmin(telegram_id):
        if not user.get('is_admin'):
            update_fields["is_admin"] = True
            user['is_admin'] = True
    elif is_admin_env and not user.get('is_admin'):
        update_fields["is_admin"] = True
        user['is_admin'] = True
    elif not is_admin_env and user.get('is_admin'):
        update_fields["is_admin"] = False
        user['is_admin'] = False
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
    
    # Find user's card (Uzcard/Humo)
    user_card_type = ""
    user_card_number = ""
    for w in user.get('wallets', []):
        if w['type'] in ['uzcard', 'humo']:
            user_card_type = w['type'].upper()
            user_card_number = w['number']
            break

    # Find Mostbet ID based on currency
    mostbet_id = ""
    mostbet_label = "MOSTBET UZS" if tx.currency == 'UZS' else "MOSTBET USD"
    mostbet_type = 'mostbet_uzs' if tx.currency == 'UZS' else 'mostbet_usd'
    for w in user.get('wallets', []):
        if w['type'] == mostbet_type:
            mostbet_id = w['number']
            break
    if not mostbet_id:
        for w in user.get('wallets', []):
            if w['type'].startswith('mostbet'):
                mostbet_id = w['number']
                mostbet_label = w['type'].replace('_', ' ').upper()
                break

    currency_label = "SO'M" if tx.currency == 'UZS' else "USD"

    msg = ""
    if tx.type == 'deposit':
        msg = (f"🆔 <b>ID:</b> {user_internal_id}\n\n"
               f"💳 <b>{user_card_type}:</b> {user_card_number}\n\n"
               f"🎮 <b>{mostbet_label}:</b> {mostbet_id}\n\n"
               f"💰 <b>{tx.amount:,.0f} {currency_label}</b>\n\n"
               f"👤 <b>Telegram:</b> {user_username}\n"
               f"📞 <b>Telefon:</b> {user_phone}")
    elif tx.type == 'withdraw':
        msg = (f"🆔 <b>ID:</b> {user_internal_id}\n\n"
               f"💳 <b>{user_card_type}:</b> {user_card_number}\n\n"
               f"🎮 <b>{mostbet_label}:</b> {mostbet_id}\n\n"
               f"💰 <b>{tx.amount:,.0f} {currency_label}</b>\n\n"
               f"🔑 <b>Kod:</b> <code>{tx.secret_code}</code>\n\n"
               f"👤 <b>Telegram:</b> {user_username}\n"
               f"📞 <b>Telefon:</b> {user_phone}")
    
    # Use short_id for callback data (Telegram limit is 64 bytes)
    await send_notification(msg, tx.type, transaction.short_id)
    return transaction

@api_router.get("/transactions/{telegram_id}")
async def get_history(telegram_id: int):
    txs = await db.transactions.find({"user_id": telegram_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return txs

_code_attempts = {}

@api_router.post("/transactions/verify_code")
async def verify_code(data: dict = Body(...)):
    """Verify withdrawal code via Mostbet Kassa API."""
    code = data.get("code", "").strip()
    player_id = data.get("player_id", "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Kodni kiriting")
    if not player_id:
        raise HTTPException(status_code=400, detail="Mostbet ID topilmadi")
    
    cashout_list = await mostbet_get_cashout_list(player_id)
    if not cashout_list.get("success"):
        raise HTTPException(status_code=400, detail="Mostbet bilan bog'lanib bo'lmadi")
    
    items = cashout_list.get("data", {}).get("items", [])
    if not items:
        raise HTTPException(status_code=404, detail="Mostbet'da yechish so'rovi topilmadi")
    
    tx_id = items[0].get("transactionId")
    amount = items[0].get("amount", 0)
    currency = items[0].get("currency", "UZS")
    
    result = await mostbet_confirm_cashout(code, tx_id)
    
    if result.get("success"):
        return {"valid": True, "status": result.get("data", {}).get("status", ""), "amount": amount, "currency": currency, "transactionId": tx_id}
    
    error = result.get("error", "")
    if "CONFIRM_FREEZE" in str(error):
        raise HTTPException(status_code=429, detail="Biroz kuting, qayta urining")
    elif "EXPIRED" in str(error):
        raise HTTPException(status_code=400, detail="Kod muddati tugagan")
    elif "CANCELED" in str(error):
        raise HTTPException(status_code=400, detail="So'rov bekor qilingan")
    raise HTTPException(status_code=400, detail="Noto'g'ri kod")

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
            # Kassa transfer logic stays, user notification removed
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

@api_router.post("/partnership/apply")
async def apply_partnership(data: dict = Body(...)):
    import httpx
    telegram_id = data.get("telegram_id")
    bot_token = data.get("bot_token", "").strip()
    bot_name = data.get("bot_name", "").strip()
    if not telegram_id or not bot_token:
        raise HTTPException(status_code=400, detail="telegram_id va bot_token kerak")

    tg_api = f"https://api.telegram.org/bot{bot_token}"

    async with httpx.AsyncClient(timeout=10) as client:
        me_res = await client.get(f"{tg_api}/getMe")
        me_data = me_res.json()
        if not me_data.get("ok"):
            raise HTTPException(status_code=400, detail="Bot token noto'g'ri. Qayta tekshiring.")

        bot_info = me_data["result"]
        detected_username = bot_info.get("username", "")
        detected_name = bot_info.get("first_name", bot_name)

        webapp_url = WEBAPP_URL.rstrip("/")

        menu_payload = {
            "menu_button": {
                "type": "web_app",
                "text": "BuraPay",
                "web_app": {"url": webapp_url}
            }
        }
        await client.post(f"{tg_api}/setChatMenuButton", json=menu_payload)

        start_cmd = [{"command": "start", "description": "BuraPay ilovasini ochish"}]
        await client.post(f"{tg_api}/setMyCommands", json={"commands": start_cmd})

    await db.partnerships.insert_one({
        "telegram_id": telegram_id,
        "bot_token": bot_token,
        "bot_name": detected_name,
        "bot_username": detected_username,
        "webapp_url": webapp_url,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {
        "status": "active",
        "bot_username": detected_username,
        "bot_name": detected_name,
        "webapp_url": webapp_url
    }

@api_router.post("/admin/required_channels/add")
async def add_required_channel(data: dict = Body(...)):
    channel_id = data.get("channel_id", "").strip()
    channel_name = data.get("channel_name", "").strip()
    channel_link = data.get("channel_link", "").strip()
    if not channel_id or not channel_name:
        raise HTTPException(status_code=400, detail="Kanal ID va nomi kerak")
    channel = {"channel_id": channel_id, "channel_name": channel_name, "channel_link": channel_link}
    await db.settings.update_one({}, {"$push": {"required_channels": channel}}, upsert=True)
    return {"status": "added"}

@api_router.post("/admin/required_channels/remove")
async def remove_required_channel(data: dict = Body(...)):
    channel_id = data.get("channel_id", "").strip()
    if not channel_id:
        raise HTTPException(status_code=400, detail="Kanal ID kerak")
    await db.settings.update_one({}, {"$pull": {"required_channels": {"channel_id": channel_id}}})
    return {"status": "removed"}

@api_router.get("/check_subscription/{telegram_id}")
async def api_check_subscription(telegram_id: int):
    result = await check_subscription(telegram_id)
    return result

# ── Balance Deposit Endpoints ──────────────────────────────────────────────

@api_router.post("/balance/deposit")
async def create_balance_deposit(data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    amount = float(data.get("amount", 0))
    if not telegram_id or amount < 1000:
        raise HTTPException(status_code=400, detail="Telegram ID va summa kerak (min 1000)")
    user = await db.users.find_one({"telegram_id": telegram_id})
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    bot_id = user.get("bot_id", "")
    if not bot_id:
        raise HTTPException(status_code=400, detail="Bot ID topilmadi")

    # Get first admin uzcard/humo card
    admin_cards = await db.admin_cards.find({}).to_list(100)
    card = next((c for c in admin_cards if c.get("type") in ["uzcard", "humo"]), None)
    if not card:
        raise HTTPException(status_code=400, detail="Admin kartasi topilmadi")

    req = DepositRequest(
        user_telegram_id=telegram_id,
        user_bot_id=bot_id,
        amount=amount,
        card_number=card["number"]
    )
    await db.deposit_requests.insert_one(req.model_dump())

    # Send Telegram notification to admin
    if bot:
        user_name = user.get("first_name", "Noma'lum")
        user_username = f"@{user.get('username')}" if user.get('username') else "—"
        msg = (
            f"💳 <b>BALANS TO'LDIRISH SO'ROVI</b>\n\n"
            f"🆔 <b>Bot ID:</b> <code>{bot_id}</code>\n"
            f"👤 <b>Ismi:</b> {user_name}\n"
            f"📱 <b>Telegram:</b> {user_username}\n\n"
            f"💰 <b>Summa:</b> {amount:,.0f} UZS\n"
            f"💳 <b>Admin karta:</b> <code>{card['number']}</code>\n\n"
            f"⏰ {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')} UTC"
        )
        markup = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"bal_approve_{req.short_id}"),
            InlineKeyboardButton(text="❌ Rad etish",  callback_data=f"bal_reject_{req.short_id}")
        ]])
        settings = await db.settings.find_one({})
        target = settings.get("deposit_channel_id") if settings else None
        notified = False
        if target:
            try:
                await bot.send_message(target, msg, parse_mode="HTML", reply_markup=markup)
                notified = True
            except Exception as e:
                logging.error(f"Balance deposit notify error: {e}")
        if not notified:
            admin_users = await db.users.find({"is_admin": True}).to_list(50)
            ids = set(ADMIN_IDS + [u["telegram_id"] for u in admin_users])
            for aid in ids:
                try:
                    await bot.send_message(aid, msg, parse_mode="HTML", reply_markup=markup)
                except: pass

    return {"status": "pending", "id": req.id, "short_id": req.short_id}


@api_router.get("/balance/deposits/{telegram_id}")
async def get_user_balance_deposits(telegram_id: int):
    reqs = await db.deposit_requests.find(
        {"user_telegram_id": telegram_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return reqs


@api_router.get("/admin/balance/deposits")
async def get_all_balance_deposits(status: str = "pending"):
    reqs = await db.deposit_requests.find(
        {"status": status}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return reqs


@api_router.post("/admin/balance/deposits/{req_id}/approve")
async def approve_balance_deposit_admin(req_id: str):
    req = await db.deposit_requests.find_one({"id": req_id})
    if not req or req["status"] != "pending":
        raise HTTPException(status_code=400, detail="So'rov topilmadi yoki allaqachon ko'rilgan")
    await db.deposit_requests.update_one({"id": req_id}, {"$set": {"status": "completed"}})
    await db.users.update_one({"telegram_id": req["user_telegram_id"]}, {"$inc": {"balance_uzs": req["amount"]}})
    tx_record = {
        "id": str(uuid.uuid4()), "short_id": generate_short_id(),
        "user_id": req["user_telegram_id"], "type": "deposit",
        "amount": req["amount"], "currency": "UZS", "method": "balance",
        "wallet_number": req["user_bot_id"], "status": "approved",
        "created_at": datetime.now(timezone.utc)
    }
    await db.transactions.insert_one(tx_record)
    return {"status": "completed"}


@api_router.post("/admin/balance/deposits/{req_id}/reject")
async def reject_balance_deposit_admin(req_id: str):
    req = await db.deposit_requests.find_one({"id": req_id})
    if not req or req["status"] != "pending":
        raise HTTPException(status_code=400, detail="So'rov topilmadi yoki allaqachon ko'rilgan")
    await db.deposit_requests.update_one({"id": req_id}, {"$set": {"status": "rejected"}})
    return {"status": "rejected"}


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

# Health check endpoint (for Railway, Render, etc.)
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "webapp_url": WEBAPP_URL}

# Serve React frontend static files
# Support both Replit (/home/runner/workspace) and Railway/Docker (/app) paths
def find_frontend_build() -> Path:
    candidates = [
        Path(__file__).parent.parent / "frontend" / "build",   # Replit
        Path("/app/frontend/build"),                            # Railway / Docker
        Path(__file__).parent / "frontend" / "build",          # flat layout
    ]
    for p in candidates:
        if p.exists():
            return p
    return candidates[0]  # default (may not exist, guarded below)

FRONTEND_BUILD = find_frontend_build()
if FRONTEND_BUILD.exists() and (FRONTEND_BUILD / "static").exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_BUILD / "static")), name="static")

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        index_file = FRONTEND_BUILD / "index.html"
        return FileResponse(str(index_file))

@app.on_event("startup")
async def start_bot():
    # Ensure unique index on bot_id (sparse so null values are excluded)
    await db.users.create_index("bot_id", unique=True, sparse=True)
    logging.info("Unique index on bot_id ensured")
    # Index for deposit_requests
    await db.deposit_requests.create_index("short_id", unique=True)
    await db.deposit_requests.create_index([("user_telegram_id", 1), ("status", 1)])
    logging.info("Deposit requests indexes ensured")

    if bot:
        public_url = detect_public_url()
        logging.info(f"Detected public URL: {public_url or 'none (will use polling)'}")

        if public_url:
            # Webhook mode — works on any external platform
            webhook_url = f"{public_url}/api/webhook"
            await bot.set_webhook(
                url=webhook_url,
                drop_pending_updates=True,
                allowed_updates=["message", "callback_query", "my_chat_member"]
            )
            logging.info(f"Webhook set to: {webhook_url}")

            # Auto-set mini app menu button so users see it without /start
            try:
                from aiogram.types import MenuButtonWebApp, WebAppInfo as TgWebAppInfo
                await bot.set_chat_menu_button(
                    menu_button=MenuButtonWebApp(
                        text="BuraPay",
                        web_app=TgWebAppInfo(url=public_url)
                    )
                )
                logging.info("Bot menu button (Mini App) set automatically")
            except Exception as e:
                logging.warning(f"Could not set menu button: {e}")

            # Set bot commands
            try:
                from aiogram.types import BotCommand
                await bot.set_my_commands([
                    BotCommand(command="start", description="BuraPay ilovasini ochish")
                ])
            except Exception as e:
                logging.warning(f"Could not set commands: {e}")
        else:
            # Polling mode — local development / no public URL
            await bot.delete_webhook(drop_pending_updates=True)
            asyncio.create_task(dp.start_polling(bot))
            logging.info("Bot started in polling mode (no public URL detected)")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    if bot: 
        await bot.delete_webhook()
        await bot.session.close()
