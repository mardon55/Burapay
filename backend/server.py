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
    
    # Send Notification to Admin/Group
    user_name = user.get("first_name", "Unknown")
    user_internal_id = user.get("internal_id", "---")
    
    # Format Method Name
    method_name = tx.method.replace('_', ' ').upper()
    if tx.method.startswith('mostbet') and tx.wallet_number:
        method_name += f" ({tx.wallet_number})"
    
    msg = ""
    if tx.type == 'deposit':
        msg = (f"📥 <b>Yangi Depozit!</b>\n\n"
               f"👤 <b>Foydalanuvchi:</b> {user_name}\n"
               f"🆔 <b>ID:</b> {user_internal_id}\n"
               f"💰 <b>Summa:</b> {tx.amount:,.0f} {tx.currency}\n"
               f"🏦 <b>Tizim:</b> {method_name}\n"
               f"📅 <b>Vaqt:</b> {datetime.now().strftime('%H:%M %d.%m.%Y')}")
    elif tx.type == 'withdraw':
        msg = (f"📤 <b>Pul Yechish!</b>\n\n"
               f"👤 <b>Foydalanuvchi:</b> {user_name}\n"
               f"🆔 <b>ID:</b> {user_internal_id}\n"
               f"💰 <b>Summa:</b> {tx.amount:,.0f} {tx.currency}\n"
               f"💳 <b>Hamyon:</b> {tx.wallet_number}\n"
               f"🏦 <b>Tizim:</b> {method_name}\n"
               f"📅 <b>Vaqt:</b> {datetime.now().strftime('%H:%M %d.%m.%Y')}")
    
    # Append User Wallets for reference
    user_wallets = []
    for w in user.get('wallets', []):
        w_type = w['type'].replace('_', ' ').upper()
        w_num = w['number']
        user_wallets.append(f"{w_type}: {w_num}")
    
    if user_wallets:
        msg += "\n\n📋 <b>Foydalanuvchi Hamyonlari:</b>\n" + "\n".join(user_wallets)

    await send_notification(msg, transaction.id)
    return transaction
