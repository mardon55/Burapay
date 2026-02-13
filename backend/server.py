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
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton

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
    name: Optional[str] = None

class User(BaseModel):
    telegram_id: int
    internal_id: str = Field(default_factory=generate_user_id)
    first_name: str
    username: Optional[str] = None
    balance: float = 0.0
    wallets: List[Wallet] = []
    is_admin: bool = False
    referrer_id: Optional[int] = None 
    referrals_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: int
    type: Literal['deposit', 'withdraw']
    amount: float
    currency: str
    method: str
    wallet_number: Optional[str] = None
    status: Literal['pending', 'approved', 'rejected'] = 'pending'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    user_id: int
    type: Literal['deposit', 'withdraw']
    amount: float
    currency: str
    method: str
    wallet_number: Optional[str] = None

# Bot Handlers
@dp.message(CommandStart())
async def cmd_start(message: types.Message, command: CommandObject):
    try:
        user = await db.users.find_one({"telegram_id": message.from_user.id})
        referrer_id = None
        
        args = command.args
        if args and args.isdigit() and not user:
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
                        await bot.send_message(referrer['telegram_id'], f"🎉 Sizda yangi referal bor: {message.from_user.first_name}")
                    except: pass

        if not user:
            new_user = User(
                telegram_id=message.from_user.id,
                first_name=message.from_user.first_name,
                username=message.from_user.username,
                balance=0.0,
                referrer_id=referrer_id
            )
            await db.users.insert_one(new_user.model_dump())
        
        markup = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📱 BuraPay ilovasini ochish", web_app=WebAppInfo(url=WEBAPP_URL))]
        ])
        
        await message.answer(
            f"👋 Salom, {message.from_user.first_name}!\n\n"
            "<b>BuraPay</b> - ishonchli to'lov tizimiga xush kelibsiz.\n"
            "Hisobni to'ldirish, pul yechish va referal tizimidan foydalanish uchun pastdagi tugmani bosing.",
            reply_markup=markup,
            parse_mode="HTML"
        )
    except Exception as e:
        logging.error(f"Error in cmd_start: {e}")
        await message.answer("Xatolik yuz berdi. Iltimos qayta urinib ko'ring.")

async def notify_admins(text: str):
    if not bot: return
    admin_users = await db.users.find({"is_admin": True}).to_list(100)
    admin_ids = set(ADMIN_IDS + [u['telegram_id'] for u in admin_users])
    
    for admin_id in admin_ids:
        try:
            await bot.send_message(admin_id, text)
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
    
    # Check Env admin
    is_admin_env = telegram_id in ADMIN_IDS
    
    if not user:
        # Create new user
        new_user = User(
            telegram_id=telegram_id,
            first_name=data.get("first_name", "User"),
            username=data.get("username"),
            balance=0.0,
            is_admin=is_admin_env
        )
        await db.users.insert_one(new_user.model_dump())
        return new_user
    
    # Update existing user if needed (missing ID or admin status changed)
    update_fields = {}
    if "internal_id" not in user:
        update_fields["internal_id"] = generate_user_id()
        user["internal_id"] = update_fields["internal_id"]
    
    if is_admin_env and not user.get('is_admin'):
        update_fields["is_admin"] = True
        user['is_admin'] = True

    # Update name if changed
    if data.get("first_name") and user.get("first_name") != data.get("first_name"):
        update_fields["first_name"] = data.get("first_name")
        user["first_name"] = data.get("first_name")
        
    if update_fields:
        await db.users.update_one({"telegram_id": telegram_id}, {"$set": update_fields})
        
    return user

@api_router.get("/user/{telegram_id}")
async def get_profile(telegram_id: int):
    user = await db.users.find_one({"telegram_id": telegram_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Hot-fix for missing ID in existing users
    if "internal_id" not in user:
        new_id = generate_user_id()
        await db.users.update_one({"telegram_id": telegram_id}, {"$set": {"internal_id": new_id}})
        user["internal_id"] = new_id
        
    return user

@api_router.post("/wallets/add")
async def add_wallet(data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    wallet_data = data.get("wallet")
    
    if not telegram_id or not wallet_data:
        raise HTTPException(status_code=400, detail="Invalid data")

    new_wallet = Wallet(**wallet_data)
    
    result = await db.users.update_one(
        {"telegram_id": telegram_id},
        {"$push": {"wallets": new_wallet.model_dump()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Hamyon qo'shildi", "wallet": new_wallet}

@api_router.post("/transactions/create")
async def create_transaction(tx: TransactionCreate):
    if tx.type == 'withdraw':
        user = await db.users.find_one({"telegram_id": tx.user_id})
        if not user or user.get('balance', 0) < tx.amount:
            raise HTTPException(status_code=400, detail="Mablag' yetarli emas")
            
        await db.users.update_one(
            {"telegram_id": tx.user_id},
            {"$inc": {"balance": -tx.amount}}
        )

    transaction = Transaction(**tx.model_dump())
    await db.transactions.insert_one(transaction.model_dump())
    
    if tx.type == 'deposit':
        msg = (f"💰 <b>Yangi to'lov!</b>\n"
               f"👤 User ID: {tx.user_id}\n"
               f"💵 Summa: {tx.amount:,.0f} {tx.currency}\n"
               f"🏦 Tizim: {tx.method}")
        await notify_admins(msg)
    elif tx.type == 'withdraw':
        msg = (f"💸 <b>Pul yechish so'rovi!</b>\n"
               f"👤 User ID: {tx.user_id}\n"
               f"💵 Summa: {tx.amount:,.0f} {tx.currency}\n"
               f"💳 Hamyon: {tx.wallet_number}\n"
               f"🏦 Tizim: {tx.method}")
        await notify_admins(msg)

    return transaction

@api_router.get("/transactions/{telegram_id}")
async def get_history(telegram_id: int):
    txs = await db.transactions.find(
        {"user_id": telegram_id}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return txs

@api_router.get("/admin/transactions/pending")
async def get_pending_transactions():
    txs = await db.transactions.find(
        {"status": "pending"}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return txs

@api_router.post("/admin/transactions/{tx_id}/approve")
async def approve_transaction(tx_id: str):
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if tx['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Transaction already processed")

    if tx['type'] == 'deposit':
        await db.users.update_one(
            {"telegram_id": tx['user_id']},
            {"$inc": {"balance": tx['amount']}}
        )
    
    await db.transactions.update_one(
        {"id": tx_id},
        {"$set": {"status": "approved"}}
    )
    
    if bot:
        try:
            await bot.send_message(
                tx['user_id'],
                f"✅ Sizning {tx['amount']:,.0f} {tx['currency']} miqdoridagi so'rovingiz tasdiqlandi!"
            )
        except: pass
        
    return {"status": "approved"}

@api_router.post("/admin/transactions/{tx_id}/reject")
async def reject_transaction(tx_id: str):
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    if tx['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Transaction already processed")

    if tx['type'] == 'withdraw':
        await db.users.update_one(
            {"telegram_id": tx['user_id']},
            {"$inc": {"balance": tx['amount']}}
        )
    
    await db.transactions.update_one(
        {"id": tx_id},
        {"$set": {"status": "rejected"}}
    )
    
    if bot:
        try:
            await bot.send_message(
                tx['user_id'],
                f"❌ Sizning {tx['amount']:,.0f} {tx['currency']} miqdoridagi so'rovingiz bekor qilindi."
            )
        except: pass

    return {"status": "rejected"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)

@app.on_event("startup")
async def start_bot():
    if bot:
        asyncio.create_task(dp.start_polling(bot))

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    if bot:
        await bot.session.close()
