from fastapi import FastAPI, APIRouter, HTTPException, Body, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional, Literal, Any
import uuid
from datetime import datetime, timezone, timedelta
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

# ── Database moduli (asyncpg pool + retry + exception handling) ───────────────
from database import (
    init_pool, close_pool, health_check as db_health_check,
    fetchall, fetchone, execute
)

# ── Bot Setup ─────────────────────────────────────────────────────────────────
BOT_TOKEN = os.environ.get('BOT_TOKEN')
SUPERADMIN_ID = 8321879273
ADMIN_IDS = [int(x) for x in os.environ.get('ADMIN_IDS', '').split(',') if x.strip()]
if SUPERADMIN_ID not in ADMIN_IDS:
    ADMIN_IDS.append(SUPERADMIN_ID)

def is_superadmin(telegram_id) -> bool:
    try:
        return int(telegram_id) == SUPERADMIN_ID
    except (TypeError, ValueError):
        return str(telegram_id) == str(SUPERADMIN_ID)

BOT_USERNAME = "MR_KASSABOT"

def detect_public_url() -> str:
    if os.environ.get('WEBAPP_URL'):
        return os.environ['WEBAPP_URL'].rstrip('/')
    if os.environ.get('REPLIT_DEV_DOMAIN'):
        return f"https://{os.environ['REPLIT_DEV_DOMAIN']}"
    if os.environ.get('REPLIT_DOMAINS'):
        domain = os.environ['REPLIT_DOMAINS'].split(',')[0].strip()
        return f"https://{domain}"
    if os.environ.get('RAILWAY_PUBLIC_DOMAIN'):
        return f"https://{os.environ['RAILWAY_PUBLIC_DOMAIN']}"
    if os.environ.get('RAILWAY_STATIC_URL'):
        url = os.environ['RAILWAY_STATIC_URL']
        return url if url.startswith('http') else f"https://{url}"
    if os.environ.get('RENDER_EXTERNAL_URL'):
        return os.environ['RENDER_EXTERNAL_URL'].rstrip('/')
    if os.environ.get('FLY_APP_NAME'):
        return f"https://{os.environ['FLY_APP_NAME']}.fly.dev"
    if os.environ.get('HEROKU_APP_NAME'):
        return f"https://{os.environ['HEROKU_APP_NAME']}.herokuapp.com"
    if os.environ.get('PUBLIC_URL'):
        return os.environ['PUBLIC_URL'].rstrip('/')
    if os.environ.get('BASE_URL'):
        return os.environ['BASE_URL'].rstrip('/')
    return ''

WEBAPP_URL = detect_public_url()
bot = Bot(token=BOT_TOKEN) if BOT_TOKEN else None
dp = Dispatcher()

# ── Rate Limiter (slowapi) ─────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
api_router = APIRouter(prefix="/api")

# ── Mostbet Kassa API ─────────────────────────────────────────────────────────
MOSTBET_API_KEY = os.environ.get('MOSTBET_API_KEY', '')
MOSTBET_SECRET_KEY = os.environ.get('MOSTBET_SECRET_KEY', '')
MOSTBET_CASHPOINT_ID = os.environ.get('MOSTBET_CASHPOINT_ID', '')

def mostbet_sign(api_key, secret, path, body_str, timestamp):
    sign_string = f"api-key:{api_key}{path}{body_str}{timestamp}"
    return hmac.new(secret.encode(), sign_string.encode(), hashlib.sha3_256).hexdigest()

def mostbet_headers(api_key, secret, path, body_str, timestamp, project=None):
    sig = mostbet_sign(api_key, secret, path, body_str, timestamp)
    h = {"X-Api-Key": f"api-key:{api_key}", "X-Timestamp": timestamp, "X-Signature": sig}
    if project:
        h["X-Project"] = project
        h["Content-Type"] = "application/json"
    return h

async def mostbet_deposit(player_id, amount, currency="UZS"):
    if not MOSTBET_API_KEY or not MOSTBET_SECRET_KEY or not MOSTBET_CASHPOINT_ID:
        return {"success": False, "error": "Kassa credentials not configured"}
    try:
        path = f"/mbc/gateway/v1/api/cashpoint/{MOSTBET_CASHPOINT_ID}/player/deposit"
        url = f"https://apimb.com{path}"
        body = {"brandId": 1, "playerId": str(player_id), "amount": int(amount), "currency": currency}
        body_str = json.dumps(body, separators=(',', ':'))
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        headers = mostbet_headers(MOSTBET_API_KEY, MOSTBET_SECRET_KEY, path, body_str, timestamp, project="MBC")
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(url, content=body_str, headers=headers)
            if r.status_code == 200:
                return {"success": True, "data": r.json()}
            try:
                err = r.json()
                msg = err.get("message", "") or err.get("code", "")
            except Exception:
                msg = r.text[:200]
            return {"success": False, "error": msg}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def mostbet_get_cashout_list(player_id):
    if not MOSTBET_API_KEY or not MOSTBET_SECRET_KEY or not MOSTBET_CASHPOINT_ID:
        return {"success": False, "error": "Kassa credentials not configured"}
    try:
        query = f"?page=1&size=50&searchString={player_id}"
        path = f"/mbc/gateway/v1/api/cashpoint/{MOSTBET_CASHPOINT_ID}/player/cashout/list/page{query}"
        url = f"https://apimb.com{path}"
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        headers = mostbet_headers(MOSTBET_API_KEY, MOSTBET_SECRET_KEY, path, "", timestamp)
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.get(url, headers=headers)
            if r.status_code == 200:
                return {"success": True, "data": r.json()}
            return {"success": False, "error": f"{r.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def mostbet_confirm_cashout(code, transaction_id):
    if not MOSTBET_API_KEY or not MOSTBET_SECRET_KEY or not MOSTBET_CASHPOINT_ID:
        return {"success": False, "error": "Kassa credentials not configured"}
    try:
        path = f"/mbc/gateway/v1/api/cashpoint/{MOSTBET_CASHPOINT_ID}/player/cashout/confirmation"
        url = f"https://apimb.com{path}"
        body = {"code": str(code), "transactionId": int(transaction_id)}
        body_str = json.dumps(body, separators=(',', ':'))
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        headers = mostbet_headers(MOSTBET_API_KEY, MOSTBET_SECRET_KEY, path, body_str, timestamp, project="MBC")
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(url, content=body_str, headers=headers)
            if r.status_code == 200:
                return {"success": True, "data": r.json()}
            try:
                err = r.json()
                return {"success": False, "error": err.get("code", ""), "message": err.get("message", "")}
            except Exception:
                return {"success": False, "error": r.text[:200]}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ── Helper generators ─────────────────────────────────────────────────────────
def generate_user_id():
    return str(random.randint(1000000, 9999999))

def generate_short_id():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

async def generate_unique_bot_id() -> str:
    while True:
        candidate = "MR" + str(random.randint(1000000, 9999999))
        existing = await fetchone("SELECT 1 FROM users WHERE bot_id = :bid", {"bid": candidate})
        if not existing:
            return candidate

# ── DB helper: get user + wallets as dict ────────────────────────────────────
async def get_user_with_wallets(telegram_id: int) -> Optional[dict]:
    user = await fetchone("SELECT * FROM users WHERE telegram_id = :tid", {"tid": telegram_id})
    if not user:
        return None
    wallets = await fetchall(
        "SELECT id, user_telegram_id, type, number, expiry, name FROM wallets WHERE user_telegram_id = :tid",
        {"tid": telegram_id}
    )
    user['wallets'] = wallets
    # Serialize datetime fields
    if isinstance(user.get('created_at'), datetime):
        user['created_at'] = user['created_at'].isoformat()
    return user

async def get_settings() -> dict:
    row = await fetchone("SELECT * FROM settings ORDER BY id LIMIT 1")
    if not row:
        return {}
    # required_channels stored as JSONB — already a list
    result = dict(row)
    if isinstance(result.get('required_channels'), str):
        result['required_channels'] = json.loads(result['required_channels'])
    return result

# ── Pydantic models (hardened — default values + validators) ──────────────────
VALID_WALLET_TYPES = {
    'uzcard', 'humo', 'visa', 'mastercard',
    'mostbet_uzs', 'mostbet_usd', '1xbet_uzs', '1xbet_usd'
}

class WalletIn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str
    number: str
    expiry: Optional[str] = None
    name: Optional[str] = None

    @field_validator('type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in VALID_WALLET_TYPES:
            raise ValueError(f"Noto'g'ri hamyon turi: {v}")
        return v

    @field_validator('number')
    @classmethod
    def validate_number(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Raqam bo'sh bo'lishi mumkin emas")
        if len(v) > 50:
            raise ValueError("Raqam 50 ta belgidan uzun bo'lishi mumkin emas")
        return v

    @field_validator('name', mode='before')
    @classmethod
    def validate_name(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        return str(v).strip()[:100] or None


class TransactionCreate(BaseModel):
    user_id: int
    type: Literal['deposit', 'withdraw']
    amount: float
    currency: Literal['UZS', 'USD'] = 'UZS'
    method: str = 'card'
    wallet_number: Optional[str] = None
    secret_code: Optional[str] = None

    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Summa musbat bo'lishi kerak")
        if v > 999_999_999:
            raise ValueError("Summa juda katta")
        return round(v, 2)

    @field_validator('method')
    @classmethod
    def validate_method(cls, v: str) -> str:
        return v.strip()[:50] if v else 'card'

    @field_validator('wallet_number', 'secret_code', mode='before')
    @classmethod
    def validate_optional_str(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        return s[:100] if s else None


class Settings(BaseModel):
    deposit_channel_id: Optional[str] = None
    withdraw_channel_id: Optional[str] = None
    exchange_rate: float = 12800.0
    required_channels: List[dict] = []

    @field_validator('exchange_rate')
    @classmethod
    def validate_exchange_rate(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Kurs musbat bo'lishi kerak")
        return v

    @field_validator('deposit_channel_id', 'withdraw_channel_id', mode='before')
    @classmethod
    def validate_channel_id(cls, v: Any) -> Optional[str]:
        if v is None or v == '':
            return None
        return str(v).strip()[:50]

# ── Subscription check ────────────────────────────────────────────────────────
async def check_subscription(user_id: int) -> dict:
    settings = await get_settings()
    channels = settings.get("required_channels", [])
    if not channels:
        return {"subscribed": True, "channels": []}
    not_subscribed = []
    for ch in channels:
        try:
            chat_id = ch["channel_id"]
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
            continue
    return {"subscribed": len(not_subscribed) == 0, "channels": not_subscribed}

# ── Messages ──────────────────────────────────────────────────────────────────
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

# ── Bot Handlers ──────────────────────────────────────────────────────────────
@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    try:
        user = await get_user_with_wallets(message.from_user.id)
        if not user:
            bot_id = await generate_unique_bot_id()
            await execute(
                """INSERT INTO users (telegram_id, internal_id, bot_id, first_name, username, balance_uzs, balance_usd, is_admin, language)
                   VALUES (:tid, :iid, :bid, :fn, :un, 0, 0, false, 'uz')""",
                {"tid": message.from_user.id, "iid": generate_user_id(),
                 "bid": bot_id, "fn": message.from_user.first_name or "",
                 "un": message.from_user.username}
            )
            user = {"language": "uz"}

        lang = user.get("language", "uz")
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
            text = "⚠️ Botdan foydalanish uchun kanallarga obuna bo'ling:" if lang != "ru" else "⚠️ Для использования бота подпишитесь на каналы:"
            await message.answer(text, reply_markup=markup)
            return

        markup = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=MESSAGES[lang]["open_app"], web_app=WebAppInfo(url=WEBAPP_URL))],
            [InlineKeyboardButton(text="🇺🇿 O'zbekcha / 🇷🇺 Русский", callback_data="change_lang")],
            [InlineKeyboardButton(text="📞 Qo'llab-quvvatlash / Поддержка", url="https://t.me/MR_KASSABOT")]
        ])
        await message.answer(
            MESSAGES[lang]["welcome"].format(name=message.from_user.first_name),
            reply_markup=markup, parse_mode="HTML"
        )
    except Exception as e:
        logging.error(f"Error in cmd_start: {e}")
        await message.answer("Error / Xatolik")

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
            await bot.send_message(chat_id,
                f"✅ <b>Bot qo'shildi!</b>\n\n🆔 Kanal ID: `{chat_id}`\n📌 Nomi: {chat_title}\n\n"
                "Ushbu ID ni Admin Paneldagi tegishli (Depozit yoki Pul yechish) katakka nusxalab qo'ying.")
        except: pass

@dp.callback_query(F.data == "check_sub")
async def cb_check_sub(callback: CallbackQuery):
    sub_result = await check_subscription(callback.from_user.id)
    if sub_result["subscribed"]:
        user = await get_user_with_wallets(callback.from_user.id)
        lang = (user or {}).get("language", "uz")
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
    lang_code = callback.data.split("_")[-1]
    await execute("UPDATE users SET language = :lang WHERE telegram_id = :tid",
                  {"lang": lang_code, "tid": callback.from_user.id})
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=MESSAGES[lang_code]["open_app"], web_app=WebAppInfo(url=WEBAPP_URL))],
        [InlineKeyboardButton(text="🇺🇿 O'zbekcha / 🇷🇺 Русский", callback_data="change_lang")]
    ])
    await callback.message.edit_text(
        MESSAGES[lang_code]["welcome"].format(name=callback.from_user.first_name),
        reply_markup=markup, parse_mode="HTML"
    )
    await callback.answer(MESSAGES[lang_code]["lang_selected"])

@dp.callback_query(F.data.startswith("admin_"))
async def admin_action_handler(callback: CallbackQuery):
    try:
        parts = callback.data.split("_")
        if len(parts) < 3:
            await callback.answer("Noto'g'ri format", show_alert=True)
            return
        action = parts[1]
        tx_id = "_".join(parts[2:])
        tx = await fetchone("SELECT * FROM transactions WHERE id = :id OR short_id = :sid",
                            {"id": tx_id, "sid": tx_id})
        if not tx:
            await callback.answer("Tranzaksiya topilmadi", show_alert=True)
            try:
                await callback.message.edit_text(
                    f"{callback.message.html_text}\n\n<b>Holat: ❌ Tranzaksiya topilmadi</b>",
                    parse_mode="HTML", reply_markup=None)
            except: pass
            return
        if tx['status'] != 'pending':
            await callback.answer("Allaqachon ko'rib chiqilgan", show_alert=True)
            try:
                await callback.message.edit_reply_markup(reply_markup=None)
            except: pass
            return

        balance_field = 'balance_uzs' if tx['currency'] == 'UZS' else 'balance_usd'

        if action == "approve":
            user = await get_user_with_wallets(tx['user_id'])
            mostbet_type = 'mostbet_uzs' if tx['currency'] == 'UZS' else 'mostbet_usd'
            mostbet_id = None
            for w in (user or {}).get('wallets', []):
                if w['type'] == mostbet_type:
                    mostbet_id = w['number']
                    break
            if not mostbet_id:
                for w in (user or {}).get('wallets', []):
                    if w['type'].startswith('mostbet'):
                        mostbet_id = w['number']
                        break

            kassa_result = None
            if mostbet_id and tx['type'] == 'deposit':
                kassa_result = await mostbet_deposit(mostbet_id, tx['amount'], tx['currency'])

            if tx['type'] == 'deposit':
                await execute(
                    f"UPDATE users SET {balance_field} = {balance_field} + :amt WHERE telegram_id = :tid",
                    {"amt": tx['amount'], "tid": tx['user_id']}
                )
            await execute("UPDATE transactions SET status = 'approved' WHERE id = :id", {"id": tx['id']})

            if tx['type'] == 'deposit' and kassa_result and kassa_result.get('success'):
                status_text = "✅ TASDIQLANDI (Kassadan o'tkazildi)"
            elif tx['type'] == 'deposit' and kassa_result and not kassa_result.get('success'):
                status_text = "✅ TASDIQLANDI (Kassa xato)"
            else:
                status_text = "✅ TASDIQLANDI"

        elif action == "reject":
            if tx['type'] == 'withdraw':
                await execute(
                    f"UPDATE users SET {balance_field} = {balance_field} + :amt WHERE telegram_id = :tid",
                    {"amt": tx['amount'], "tid": tx['user_id']}
                )
            await execute("UPDATE transactions SET status = 'rejected' WHERE id = :id", {"id": tx['id']})
            status_text = "❌ RAD ETILDI"
        else:
            return

        try:
            await callback.message.edit_text(
                f"{callback.message.html_text}\n\n<b>Holat: {status_text}</b>\n👮‍♂️ Admin: {callback.from_user.first_name}",
                parse_mode="HTML", reply_markup=None
            )
        except: pass
        await callback.answer(f"Zayavka {action} qilindi")
    except Exception as e:
        logging.error(f"Error in admin_action_handler: {e}")

@dp.callback_query(F.data.startswith("bal_"))
async def bal_action_handler(callback: CallbackQuery):
    try:
        parts = callback.data.split("_")
        if len(parts) < 3:
            await callback.answer("Noto'g'ri format", show_alert=True)
            return
        action = parts[1]
        short_id = "_".join(parts[2:])
        req = await fetchone("SELECT * FROM deposit_requests WHERE short_id = :sid", {"sid": short_id})
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
            await execute("UPDATE deposit_requests SET status = 'completed' WHERE id = :id", {"id": req['id']})
            await execute("UPDATE users SET balance_uzs = balance_uzs + :amt WHERE telegram_id = :tid",
                          {"amt": req['amount'], "tid": req['user_telegram_id']})
            await execute(
                """INSERT INTO transactions (id, short_id, user_id, type, amount, currency, method, wallet_number, status, created_at)
                   VALUES (:id, :sid, :uid, 'deposit', :amt, 'UZS', 'balance', :wn, 'approved', NOW())""",
                {"id": str(uuid.uuid4()), "sid": generate_short_id(), "uid": req['user_telegram_id'],
                 "amt": req['amount'], "wn": req['user_bot_id']}
            )
            status_text = "✅ TASDIQLANDI"
        elif action == "reject":
            await execute("UPDATE deposit_requests SET status = 'rejected' WHERE id = :id", {"id": req['id']})
            status_text = "❌ RAD ETILDI"
        else:
            await callback.answer("Noma'lum amal", show_alert=True)
            return

        try:
            await callback.message.edit_text(
                f"{callback.message.html_text}\n\n<b>Holat: {status_text}</b>\n👮‍♂️ Admin: {callback.from_user.first_name}",
                parse_mode="HTML", reply_markup=None
            )
        except: pass
        await callback.answer(f"So'rov {action} qilindi")
    except Exception as e:
        logging.error(f"Error in bal_action_handler: {e}")
        await callback.answer("Xatolik yuz berdi", show_alert=True)

async def send_notification(msg: str, tx_type: str, short_id: str = None):
    if not bot: return
    markup = None
    if short_id:
        markup = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"admin_approve_{short_id}"),
            InlineKeyboardButton(text="❌ Rad etish", callback_data=f"admin_reject_{short_id}")
        ]])
    settings = await get_settings()
    target_channel = settings.get('deposit_channel_id' if tx_type == 'deposit' else 'withdraw_channel_id')
    if target_channel:
        try:
            await bot.send_message(target_channel, msg, parse_mode="HTML", reply_markup=markup)
            return
        except Exception as e:
            logging.error(f"Failed to send to channel {target_channel}: {e}")
    admin_users = await fetchall("SELECT telegram_id FROM users WHERE is_admin = true LIMIT 100")
    admin_ids = set(ADMIN_IDS + [u['telegram_id'] for u in admin_users])
    for admin_id in admin_ids:
        try:
            await bot.send_message(admin_id, msg, parse_mode="HTML", reply_markup=markup)
        except Exception as e:
            logging.error(f"Failed to notify admin {admin_id}: {e}")

# ── API Routes ────────────────────────────────────────────────────────────────
@api_router.get("/")
async def root():
    return {"message": "BuraPay API Running"}

@api_router.post("/auth/login")
@limiter.limit("30/minute")
async def login(request: Request, data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    if not telegram_id:
        raise HTTPException(status_code=400, detail="Telegram ID required")

    user = await get_user_with_wallets(telegram_id)
    is_admin_env = is_superadmin(telegram_id) or (telegram_id in ADMIN_IDS)

    if not user:
        bot_id = await generate_unique_bot_id()
        internal_id = generate_user_id()
        await execute(
            """INSERT INTO users (telegram_id, internal_id, bot_id, first_name, username, balance_uzs, balance_usd, is_admin, language)
               VALUES (:tid, :iid, :bid, :fn, :un, 0, 0, :adm, 'uz')""",
            {"tid": telegram_id, "iid": internal_id, "bid": bot_id,
             "fn": data.get("first_name", "User"), "un": data.get("username"),
             "adm": is_admin_env}
        )
        return await get_user_with_wallets(telegram_id)

    update_fields = {}
    if not user.get("bot_id"):
        update_fields["bot_id"] = await generate_unique_bot_id()
    if "language" not in user or not user.get("language"):
        update_fields["language"] = "uz"
    if is_superadmin(telegram_id):
        if not user.get('is_admin'):
            update_fields["is_admin"] = True
    elif is_admin_env and not user.get('is_admin'):
        update_fields["is_admin"] = True
    elif not is_admin_env and user.get('is_admin'):
        update_fields["is_admin"] = False
    if data.get("first_name") and user.get("first_name") != data.get("first_name"):
        update_fields["first_name"] = data.get("first_name")
    if data.get("username") and user.get("username") != data.get("username"):
        update_fields["username"] = data.get("username")

    if update_fields:
        set_clause = ", ".join(f"{k} = :{k}" for k in update_fields)
        update_fields["tid"] = telegram_id
        await execute(f"UPDATE users SET {set_clause} WHERE telegram_id = :tid", update_fields)

    return await get_user_with_wallets(telegram_id)

@api_router.get("/user/{telegram_id}")
async def get_profile(telegram_id: int):
    user = await get_user_with_wallets(telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wallets = user.get('wallets', [])
    user['has_card'] = any(w['type'] in ['uzcard', 'humo'] for w in wallets)
    return user

@api_router.post("/user/language")
async def update_language(data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    language = data.get("language")
    if not telegram_id or language not in ["uz", "ru"]:
        raise HTTPException(status_code=400, detail="Invalid data")
    await execute("UPDATE users SET language = :lang WHERE telegram_id = :tid",
                  {"lang": language, "tid": telegram_id})
    return {"status": "ok"}

@api_router.post("/wallets/add")
@limiter.limit("20/minute")
async def add_wallet(request: Request, data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    wallet_data = data.get("wallet")
    if not telegram_id or not wallet_data:
        raise HTTPException(status_code=400, detail="Invalid data")
    user = await fetchone("SELECT telegram_id FROM users WHERE telegram_id = :tid", {"tid": telegram_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_wallet = WalletIn(**wallet_data)
    await execute(
        """INSERT INTO wallets (id, user_telegram_id, type, number, expiry, name)
           VALUES (:id, :uid, :type, :number, :expiry, :name)""",
        {"id": new_wallet.id, "uid": telegram_id, "type": new_wallet.type,
         "number": new_wallet.number, "expiry": new_wallet.expiry, "name": new_wallet.name}
    )
    return {"message": "Hamyon qo'shildi", "wallet": new_wallet.model_dump()}

@api_router.post("/wallets/delete")
async def delete_wallet(data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    wallet_id = data.get("wallet_id")
    if not telegram_id or not wallet_id:
        raise HTTPException(status_code=400, detail="Invalid data")
    result = await execute(
        "DELETE FROM wallets WHERE id = :wid AND user_telegram_id = :tid",
        {"wid": wallet_id, "tid": telegram_id}
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return {"message": "Hamyon o'chirildi"}

@api_router.post("/wallets/update")
async def update_wallet(data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    wallet_id = data.get("wallet_id")
    wallet_data = data.get("wallet")
    if not telegram_id or not wallet_id or not wallet_data:
        raise HTTPException(status_code=400, detail="Invalid data")
    updates = {}
    if wallet_data.get("number"):
        updates["number"] = wallet_data["number"]
    if wallet_data.get("expiry") is not None:
        updates["expiry"] = wallet_data["expiry"]
    if wallet_data.get("type"):
        updates["type"] = wallet_data["type"]
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["wid"] = wallet_id
    updates["tid"] = telegram_id
    result = await execute(
        f"UPDATE wallets SET {set_clause} WHERE id = :wid AND user_telegram_id = :tid",
        updates
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return {"message": "Hamyon yangilandi"}

@api_router.post("/transactions/create")
@limiter.limit("10/minute")
async def create_transaction(request: Request, tx: TransactionCreate):
    user = await get_user_with_wallets(tx.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_wallets = user.get('wallets', [])
    has_card = any(w['type'] in ['uzcard', 'humo'] for w in user_wallets)
    if not has_card:
        raise HTTPException(status_code=400, detail="Avval Uzcard yoki Humo karta qo'shing")

    balance_field = 'balance_uzs' if tx.currency == 'UZS' else 'balance_usd'
    current_balance = user.get(balance_field, 0)

    if tx.type == 'withdraw':
        if current_balance < tx.amount:
            raise HTTPException(status_code=400, detail="Mablag' yetarli emas")
        await execute(
            f"UPDATE users SET {balance_field} = {balance_field} - :amt WHERE telegram_id = :tid",
            {"amt": tx.amount, "tid": tx.user_id}
        )

    tx_id = str(uuid.uuid4())
    short_id = generate_short_id()
    await execute(
        """INSERT INTO transactions (id, short_id, user_id, type, amount, currency, method, wallet_number, secret_code, status)
           VALUES (:id, :sid, :uid, :type, :amt, :cur, :mth, :wn, :sc, 'pending')""",
        {"id": tx_id, "sid": short_id, "uid": tx.user_id, "type": tx.type,
         "amt": tx.amount, "cur": tx.currency, "mth": tx.method,
         "wn": tx.wallet_number, "sc": tx.secret_code}
    )

    user_name = user.get("first_name", "Unknown")
    user_username = f"@{user.get('username')}" if user.get('username') else "Mavjud emas"
    user_internal_id = user.get("internal_id", "---")
    user_phone = user.get("phone_number", "Kiritilmagan")
    user_card_type, user_card_number = "", ""
    for w in user_wallets:
        if w['type'] in ['uzcard', 'humo']:
            user_card_type = w['type'].upper()
            user_card_number = w['number']
            break

    mostbet_id = ""
    mostbet_label = "MOSTBET UZS" if tx.currency == 'UZS' else "MOSTBET USD"
    mostbet_type = 'mostbet_uzs' if tx.currency == 'UZS' else 'mostbet_usd'
    for w in user_wallets:
        if w['type'] == mostbet_type:
            mostbet_id = w['number']
            break
    if not mostbet_id:
        for w in user_wallets:
            if w['type'].startswith('mostbet'):
                mostbet_id = w['number']
                mostbet_label = w['type'].replace('_', ' ').upper()
                break

    currency_label = "SO'M" if tx.currency == 'UZS' else "USD"
    if tx.type == 'deposit':
        msg = (f"🆔 <b>ID:</b> {user_internal_id}\n\n💳 <b>{user_card_type}:</b> {user_card_number}\n\n"
               f"🎮 <b>{mostbet_label}:</b> {mostbet_id}\n\n💰 <b>{tx.amount:,.0f} {currency_label}</b>\n\n"
               f"👤 <b>Telegram:</b> {user_username}\n📞 <b>Telefon:</b> {user_phone}")
    else:
        msg = (f"🆔 <b>ID:</b> {user_internal_id}\n\n💳 <b>{user_card_type}:</b> {user_card_number}\n\n"
               f"🎮 <b>{mostbet_label}:</b> {mostbet_id}\n\n💰 <b>{tx.amount:,.0f} {currency_label}</b>\n\n"
               f"🔑 <b>Kod:</b> <code>{tx.secret_code}</code>\n\n"
               f"👤 <b>Telegram:</b> {user_username}\n📞 <b>Telefon:</b> {user_phone}")

    await send_notification(msg, tx.type, short_id)
    return {"id": tx_id, "short_id": short_id, "user_id": tx.user_id, "type": tx.type,
            "amount": tx.amount, "currency": tx.currency, "method": tx.method,
            "wallet_number": tx.wallet_number, "secret_code": tx.secret_code, "status": "pending"}

@api_router.get("/transactions/{telegram_id}")
async def get_history(telegram_id: int):
    rows = await fetchall(
        "SELECT * FROM transactions WHERE user_id = :uid ORDER BY created_at DESC LIMIT 100",
        {"uid": telegram_id}
    )
    for r in rows:
        if isinstance(r.get('created_at'), datetime):
            r['created_at'] = r['created_at'].isoformat()
    return rows

_code_attempts = {}

@api_router.post("/transactions/verify_code")
async def verify_code(data: dict = Body(...)):
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
        return {"valid": True, "status": result.get("data", {}).get("status", ""),
                "amount": amount, "currency": currency, "transactionId": tx_id}
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
    rows = await fetchall(
        "SELECT * FROM transactions WHERE status = 'pending' ORDER BY created_at DESC LIMIT 100"
    )
    for r in rows:
        if isinstance(r.get('created_at'), datetime):
            r['created_at'] = r['created_at'].isoformat()
    return rows

@api_router.post("/admin/transactions/{tx_id}/approve")
async def approve_transaction(tx_id: str):
    tx = await fetchone("SELECT * FROM transactions WHERE id = :id", {"id": tx_id})
    if not tx or tx['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Invalid tx")
    balance_field = 'balance_uzs' if tx['currency'] == 'UZS' else 'balance_usd'
    if tx['type'] == 'deposit':
        await execute(
            f"UPDATE users SET {balance_field} = {balance_field} + :amt WHERE telegram_id = :tid",
            {"amt": tx['amount'], "tid": tx['user_id']}
        )
    await execute("UPDATE transactions SET status = 'approved' WHERE id = :id", {"id": tx_id})
    return {"status": "approved"}

@api_router.post("/admin/transactions/{tx_id}/reject")
async def reject_transaction(tx_id: str):
    tx = await fetchone("SELECT * FROM transactions WHERE id = :id", {"id": tx_id})
    if not tx or tx['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Invalid tx")
    balance_field = 'balance_uzs' if tx['currency'] == 'UZS' else 'balance_usd'
    if tx['type'] == 'withdraw':
        await execute(
            f"UPDATE users SET {balance_field} = {balance_field} + :amt WHERE telegram_id = :tid",
            {"amt": tx['amount'], "tid": tx['user_id']}
        )
    await execute("UPDATE transactions SET status = 'rejected' WHERE id = :id", {"id": tx_id})
    return {"status": "rejected"}

@api_router.get("/admin/stats")
async def get_admin_stats():
    total_users = (await fetchone("SELECT COUNT(*) as cnt FROM users"))['cnt']
    balance_row = await fetchone("SELECT COALESCE(SUM(balance_uzs), 0) as total FROM users")
    total_balance = balance_row['total'] if balance_row else 0
    deposit_row = await fetchone(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type='deposit' AND status='approved'"
    )
    total_deposits = deposit_row['total'] if deposit_row else 0
    pending_row = await fetchone("SELECT COUNT(*) as cnt FROM transactions WHERE status='pending'")
    pending_count = pending_row['cnt'] if pending_row else 0
    return {"total_users": total_users, "total_balance": total_balance,
            "total_deposits": total_deposits, "pending_count": pending_count}

@api_router.get("/admin/users")
async def get_all_users(search: str = ""):
    if search:
        if search.isdigit():
            rows = await fetchall(
                "SELECT * FROM users WHERE telegram_id = :tid OR internal_id = :iid ORDER BY created_at DESC LIMIT 50",
                {"tid": int(search), "iid": search}
            )
        else:
            rows = await fetchall(
                "SELECT * FROM users WHERE LOWER(first_name) LIKE :q ORDER BY created_at DESC LIMIT 50",
                {"q": f"%{search.lower()}%"}
            )
    else:
        rows = await fetchall("SELECT * FROM users ORDER BY created_at DESC LIMIT 50")

    result = []
    for u in rows:
        wallets = await fetchall(
            "SELECT * FROM wallets WHERE user_telegram_id = :tid", {"tid": u['telegram_id']}
        )
        u['wallets'] = wallets
        if isinstance(u.get('created_at'), datetime):
            u['created_at'] = u['created_at'].isoformat()
        result.append(u)
    return result

@api_router.post("/admin/users/{telegram_id}/balance")
async def update_user_balance(telegram_id: int, data: dict = Body(...)):
    amount = float(data.get("amount", 0))
    tx_type = data.get("type", "credit")
    currency = data.get("currency", "UZS")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    balance_field = 'balance_uzs' if currency == 'UZS' else 'balance_usd'
    if tx_type == "credit":
        result = await execute(
            f"UPDATE users SET {balance_field} = {balance_field} + :amt WHERE telegram_id = :tid",
            {"amt": amount, "tid": telegram_id}
        )
    else:
        result = await execute(
            f"UPDATE users SET {balance_field} = {balance_field} - :amt WHERE telegram_id = :tid",
            {"amt": amount, "tid": telegram_id}
        )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await execute(
        """INSERT INTO transactions (id, short_id, user_id, type, amount, currency, method, wallet_number, status)
           VALUES (:id, :sid, :uid, :type, :amt, :cur, 'admin_adjustment', 'Admin Adjustment', 'approved')""",
        {"id": str(uuid.uuid4()), "sid": generate_short_id(), "uid": telegram_id,
         "type": "deposit" if tx_type == "credit" else "withdraw",
         "amt": amount, "cur": currency}
    )
    if bot:
        try:
            user = await fetchone("SELECT language FROM users WHERE telegram_id = :tid", {"tid": telegram_id})
            lang = (user or {}).get("language", "uz")
            if lang == "uz":
                action = "to'ldirildi" if tx_type == "credit" else "kamaytirildi"
                msg = f"💰 Sizning hisobingiz admin tomonidan {amount:,.0f} UZS ga {action}."
            else:
                action = "пополнен" if tx_type == "credit" else "уменьшен"
                msg = f"💰 Ваш баланс {action} админом на {amount:,.0f} UZS."
            await bot.send_message(telegram_id, msg)
        except: pass
    return {"message": "Balance updated"}

@api_router.get("/admin/cards")
async def get_admin_cards():
    rows = await fetchall("SELECT * FROM admin_cards ORDER BY created_at DESC")
    for r in rows:
        if isinstance(r.get('created_at'), datetime):
            r['created_at'] = r['created_at'].isoformat()
    return rows

@api_router.post("/admin/cards")
async def add_admin_card(card: dict = Body(...)):
    card_id = str(uuid.uuid4())
    await execute(
        "INSERT INTO admin_cards (id, type, number, holder_name) VALUES (:id, :type, :number, :holder)",
        {"id": card_id, "type": card.get("type"), "number": card.get("number"), "holder": card.get("holder_name")}
    )
    return {"message": "Card added", "card": {"id": card_id, **card}}

@api_router.delete("/admin/cards/{id}")
async def delete_admin_card(id: str):
    result = await execute("DELETE FROM admin_cards WHERE id = :id", {"id": id})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"message": "Card deleted"}

@api_router.get("/admin/settings")
async def get_settings_api():
    settings = await get_settings()
    result = dict(settings)
    result["mostbet_api_key"] = MOSTBET_API_KEY[:8] + "..." if MOSTBET_API_KEY else ""
    result["mostbet_cashpoint_id"] = MOSTBET_CASHPOINT_ID
    return result

@api_router.get("/admin/kassa/balance")
async def get_kassa_balance():
    if not MOSTBET_API_KEY or not MOSTBET_SECRET_KEY or not MOSTBET_CASHPOINT_ID:
        return {"success": False, "error": "Kassa credentials not configured"}
    try:
        path = f"/mbc/gateway/v1/api/cashpoint/{MOSTBET_CASHPOINT_ID}/balance"
        url = f"https://apimb.com{path}"
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        headers = mostbet_headers(MOSTBET_API_KEY, MOSTBET_SECRET_KEY, path, "", timestamp)
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(url, headers=headers)
            if r.status_code == 200:
                return {"success": True, "data": r.json()}
            return {"success": False, "error": f"{r.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@api_router.post("/admin/settings")
async def update_settings(data: Settings):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        return {"status": "updated"}
    # Handle required_channels as JSONB
    if 'required_channels' in update_data:
        update_data['required_channels'] = json.dumps(update_data['required_channels'])
    set_clause = ", ".join(f"{k} = :{k}" for k in update_data)
    await execute(f"UPDATE settings SET {set_clause} WHERE id = (SELECT id FROM settings ORDER BY id LIMIT 1)",
                  update_data)
    return {"status": "updated"}

@api_router.post("/admin/required_channels/add")
async def add_required_channel(data: dict = Body(...)):
    channel_id = data.get("channel_id", "").strip()
    channel_name = data.get("channel_name", "").strip()
    channel_link = data.get("channel_link", "").strip()
    if not channel_id or not channel_name:
        raise HTTPException(status_code=400, detail="Kanal ID va nomi kerak")
    channel = {"channel_id": channel_id, "channel_name": channel_name, "channel_link": channel_link}
    settings = await get_settings()
    channels = settings.get("required_channels", [])
    channels.append(channel)
    await execute(
        "UPDATE settings SET required_channels = :ch WHERE id = (SELECT id FROM settings ORDER BY id LIMIT 1)",
        {"ch": json.dumps(channels)}
    )
    return {"status": "added"}

@api_router.post("/admin/required_channels/remove")
async def remove_required_channel(data: dict = Body(...)):
    channel_id = data.get("channel_id", "").strip()
    if not channel_id:
        raise HTTPException(status_code=400, detail="Kanal ID kerak")
    settings = await get_settings()
    channels = [ch for ch in settings.get("required_channels", []) if ch.get("channel_id") != channel_id]
    await execute(
        "UPDATE settings SET required_channels = :ch WHERE id = (SELECT id FROM settings ORDER BY id LIMIT 1)",
        {"ch": json.dumps(channels)}
    )
    return {"status": "removed"}

@api_router.get("/check_subscription/{telegram_id}")
async def api_check_subscription(telegram_id: int):
    return await check_subscription(telegram_id)

@api_router.post("/balance/deposit")
@limiter.limit("10/minute")
async def create_balance_deposit(request: Request, data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    amount = float(data.get("amount", 0))
    if not telegram_id or amount < 1000:
        raise HTTPException(status_code=400, detail="Telegram ID va summa kerak (min 1000)")
    user = await get_user_with_wallets(telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    bot_id = user.get("bot_id", "")
    if not bot_id:
        raise HTTPException(status_code=400, detail="Bot ID topilmadi")
    admin_cards = await fetchall("SELECT * FROM admin_cards")
    card = next((c for c in admin_cards if c.get("type") in ["uzcard", "humo"]), None)
    if not card:
        raise HTTPException(status_code=400, detail="Admin kartasi topilmadi")
    req_id = str(uuid.uuid4())
    short_id = generate_short_id()
    await execute(
        """INSERT INTO deposit_requests (id, short_id, user_telegram_id, user_bot_id, amount, card_number, status)
           VALUES (:id, :sid, :uid, :bid, :amt, :card, 'pending')""",
        {"id": req_id, "sid": short_id, "uid": telegram_id, "bid": bot_id,
         "amt": amount, "card": card["number"]}
    )
    if bot:
        user_name = user.get("first_name", "Noma'lum")
        user_username = f"@{user.get('username')}" if user.get('username') else "—"
        msg = (f"💳 <b>BALANS TO'LDIRISH SO'ROVI</b>\n\n"
               f"🆔 <b>Bot ID:</b> <code>{bot_id}</code>\n"
               f"👤 <b>Ismi:</b> {user_name}\n"
               f"📱 <b>Telegram:</b> {user_username}\n\n"
               f"💰 <b>Summa:</b> {amount:,.0f} UZS\n"
               f"💳 <b>Admin karta:</b> <code>{card['number']}</code>\n\n"
               f"⏰ {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')} UTC")
        markup = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"bal_approve_{short_id}"),
            InlineKeyboardButton(text="❌ Rad etish", callback_data=f"bal_reject_{short_id}")
        ]])
        settings = await get_settings()
        target = settings.get("deposit_channel_id")
        notified = False
        if target:
            try:
                await bot.send_message(target, msg, parse_mode="HTML", reply_markup=markup)
                notified = True
            except Exception as e:
                logging.error(f"Balance deposit notify error: {e}")
        if not notified:
            admin_users = await fetchall("SELECT telegram_id FROM users WHERE is_admin = true LIMIT 50")
            ids = set(ADMIN_IDS + [u["telegram_id"] for u in admin_users])
            for aid in ids:
                try:
                    await bot.send_message(aid, msg, parse_mode="HTML", reply_markup=markup)
                except: pass
    return {"status": "pending", "id": req_id, "short_id": short_id}

@api_router.get("/balance/deposits/{telegram_id}")
async def get_user_balance_deposits(telegram_id: int):
    rows = await fetchall(
        "SELECT * FROM deposit_requests WHERE user_telegram_id = :uid ORDER BY created_at DESC LIMIT 50",
        {"uid": telegram_id}
    )
    for r in rows:
        if isinstance(r.get('created_at'), datetime):
            r['created_at'] = r['created_at'].isoformat()
    return rows

@api_router.get("/admin/balance/deposits")
async def get_all_balance_deposits(status: str = "pending"):
    rows = await fetchall(
        "SELECT * FROM deposit_requests WHERE status = :status ORDER BY created_at DESC LIMIT 100",
        {"status": status}
    )
    for r in rows:
        if isinstance(r.get('created_at'), datetime):
            r['created_at'] = r['created_at'].isoformat()
    return rows

@api_router.post("/admin/balance/deposits/{req_id}/approve")
async def approve_balance_deposit_admin(req_id: str):
    req = await fetchone("SELECT * FROM deposit_requests WHERE id = :id", {"id": req_id})
    if not req or req["status"] != "pending":
        raise HTTPException(status_code=400, detail="So'rov topilmadi yoki allaqachon ko'rilgan")
    await execute("UPDATE deposit_requests SET status = 'completed' WHERE id = :id", {"id": req_id})
    await execute("UPDATE users SET balance_uzs = balance_uzs + :amt WHERE telegram_id = :tid",
                  {"amt": req["amount"], "tid": req["user_telegram_id"]})
    await execute(
        """INSERT INTO transactions (id, short_id, user_id, type, amount, currency, method, wallet_number, status)
           VALUES (:id, :sid, :uid, 'deposit', :amt, 'UZS', 'balance', :wn, 'approved')""",
        {"id": str(uuid.uuid4()), "sid": generate_short_id(), "uid": req["user_telegram_id"],
         "amt": req["amount"], "wn": req["user_bot_id"]}
    )
    return {"status": "completed"}

@api_router.post("/admin/balance/deposits/{req_id}/reject")
async def reject_balance_deposit_admin(req_id: str):
    req = await fetchone("SELECT * FROM deposit_requests WHERE id = :id", {"id": req_id})
    if not req or req["status"] != "pending":
        raise HTTPException(status_code=400, detail="So'rov topilmadi yoki allaqachon ko'rilgan")
    await execute("UPDATE deposit_requests SET status = 'rejected' WHERE id = :id", {"id": req_id})
    return {"status": "rejected"}

@api_router.post("/partnership/apply")
@limiter.limit("5/minute")
async def apply_partnership(request: Request, data: dict = Body(...)):
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
        menu_payload = {"menu_button": {"type": "web_app", "text": "BuraPay", "web_app": {"url": webapp_url}}}
        await client.post(f"{tg_api}/setChatMenuButton", json=menu_payload)
        start_cmd = [{"command": "start", "description": "BuraPay ilovasini ochish"}]
        await client.post(f"{tg_api}/setMyCommands", json={"commands": start_cmd})
    await execute(
        """INSERT INTO partnerships (telegram_id, bot_token, bot_name, bot_username, webapp_url, status)
           VALUES (:tid, :token, :name, :username, :url, 'active')""",
        {"tid": telegram_id, "token": bot_token, "name": detected_name,
         "username": detected_username, "url": webapp_url}
    )
    return {"status": "active", "bot_username": detected_username,
            "bot_name": detected_name, "webapp_url": webapp_url}

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
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO)

@app.get("/api/health")
async def health_check():
    db_status = await db_health_check()
    return {"status": "ok", "webapp_url": WEBAPP_URL, **db_status}

def find_frontend_build() -> Path:
    candidates = [
        Path(__file__).parent.parent / "frontend" / "build",
        Path("/app/frontend/build"),
        Path(__file__).parent / "frontend" / "build",
    ]
    for p in candidates:
        if p.exists():
            return p
    return candidates[0]

FRONTEND_BUILD = find_frontend_build()
if FRONTEND_BUILD.exists() and (FRONTEND_BUILD / "static").exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_BUILD / "static")), name="static")

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        index_file = FRONTEND_BUILD / "index.html"
        return FileResponse(str(index_file))

@app.on_event("startup")
async def startup():
    # 1. DB pool ni ishga tushirish (retry bilan)
    await init_pool()

    # 2. Health check — pool ishlayotganini tasdiqlash
    status = await db_health_check()
    if status.get("db") == "ok":
        logging.info(
            f"✅ DB tayyor | pool_size={status['pool_size']} "
            f"idle={status['pool_idle']} max={status['pool_max']}"
        )
    else:
        logging.error(f"❌ DB health check muvaffaqiyatsiz: {status}")

    # 3. Telegram bot webhook
    if bot:
        public_url = detect_public_url()
        logging.info(f"Detected public URL: {public_url or 'none (will use polling)'}")
        if public_url:
            webhook_url = f"{public_url}/api/webhook"
            await bot.set_webhook(url=webhook_url, drop_pending_updates=True,
                                   allowed_updates=["message", "callback_query", "my_chat_member"])
            logging.info(f"Webhook set to: {webhook_url}")
            try:
                from aiogram.types import MenuButtonWebApp, WebAppInfo as TgWebAppInfo
                await bot.set_chat_menu_button(
                    menu_button=MenuButtonWebApp(text="BuraPay", web_app=TgWebAppInfo(url=public_url))
                )
            except Exception as e:
                logging.warning(f"Could not set menu button: {e}")
            try:
                from aiogram.types import BotCommand
                await bot.set_my_commands([BotCommand(command="start", description="BuraPay ilovasini ochish")])
            except Exception as e:
                logging.warning(f"Could not set commands: {e}")
        else:
            await bot.delete_webhook(drop_pending_updates=True)
            asyncio.create_task(dp.start_polling(bot))
            logging.info("Bot started in polling mode")

@app.on_event("shutdown")
async def shutdown():
    # DB pool ni xavfsiz yopish
    await close_pool()
    if bot:
        await bot.delete_webhook()
        await bot.session.close()
