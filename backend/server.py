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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return str(v)

class Wallet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str # 'uzcard', 'humo', 'mostbet_id'
    number: str
    name: Optional[str] = None

class User(BaseModel):
    telegram_id: int
    first_name: str
    username: Optional[str] = None
    balance: float = 0.0
    wallets: List[Wallet] = []
    is_admin: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: int
    type: Literal['deposit', 'withdraw']
    amount: float
    currency: str # 'UZS', 'USD', 'RUB'
    method: str # 'uzcard', 'humo', 'mostbet'
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

# Routes

@api_router.get("/")
async def root():
    return {"message": "Totpay API Running"}

@api_router.post("/auth/login")
async def login(data: dict = Body(...)):
    # Mock login or simple telegram auth
    telegram_id = data.get("telegram_id")
    if not telegram_id:
        raise HTTPException(status_code=400, detail="Telegram ID required")
    
    user = await db.users.find_one({"telegram_id": telegram_id}, {"_id": 0})
    if not user:
        new_user = User(
            telegram_id=telegram_id,
            first_name=data.get("first_name", "User"),
            username=data.get("username"),
            balance=0.0
        )
        await db.users.insert_one(new_user.model_dump())
        return new_user
    return user

@api_router.get("/user/{telegram_id}")
async def get_profile(telegram_id: int):
    user = await db.users.find_one({"telegram_id": telegram_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.post("/wallets/add")
async def add_wallet(data: dict = Body(...)):
    telegram_id = data.get("telegram_id")
    wallet_data = data.get("wallet") # type, number, name
    
    if not telegram_id or not wallet_data:
        raise HTTPException(status_code=400, detail="Invalid data")

    new_wallet = Wallet(**wallet_data)
    
    result = await db.users.update_one(
        {"telegram_id": telegram_id},
        {"$push": {"wallets": new_wallet.model_dump()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Wallet added", "wallet": new_wallet}

@api_router.post("/transactions/create")
async def create_transaction(tx: TransactionCreate):
    # Check balance for withdraw
    if tx.type == 'withdraw':
        user = await db.users.find_one({"telegram_id": tx.user_id})
        if not user or user.get('balance', 0) < tx.amount:
            raise HTTPException(status_code=400, detail="Insufficient funds")
            
        # Deduct balance immediately or hold it? Let's hold it by deducing now.
        # Simple MVP logic: deduct now, refund if rejected.
        await db.users.update_one(
            {"telegram_id": tx.user_id},
            {"$inc": {"balance": -tx.amount}}
        )

    transaction = Transaction(**tx.model_dump())
    await db.transactions.insert_one(transaction.model_dump())
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

    # If deposit, add to balance
    if tx['type'] == 'deposit':
        await db.users.update_one(
            {"telegram_id": tx['user_id']},
            {"$inc": {"balance": tx['amount']}}
        )
    
    await db.transactions.update_one(
        {"id": tx_id},
        {"$set": {"status": "approved"}}
    )
    return {"status": "approved"}

@api_router.post("/admin/transactions/{tx_id}/reject")
async def reject_transaction(tx_id: str):
    tx = await db.transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    if tx['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Transaction already processed")

    # If withdraw, refund balance
    if tx['type'] == 'withdraw':
        await db.users.update_one(
            {"telegram_id": tx['user_id']},
            {"$inc": {"balance": tx['amount']}}
        )
    
    await db.transactions.update_one(
        {"id": tx_id},
        {"$set": {"status": "rejected"}}
    )
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
