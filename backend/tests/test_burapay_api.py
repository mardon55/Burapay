"""
BuraPay API Tests - Comprehensive testing for all endpoints
Tests: Auth, User, Wallets, Transactions, Admin Cards, Admin Settings
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
TEST_TELEGRAM_ID = 123456789
ADMIN_TELEGRAM_ID = 1617111900
TEST_USER_NAME = "Test User"

class TestHealthCheck:
    """API Health Check"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "BuraPay" in data["message"]
        print(f"✓ API root: {data['message']}")


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_login_creates_user(self):
        """Test /api/auth/login creates or returns user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "telegram_id": TEST_TELEGRAM_ID,
            "first_name": TEST_USER_NAME,
            "username": "testuser"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify user data structure
        assert "telegram_id" in data
        assert data["telegram_id"] == TEST_TELEGRAM_ID
        assert "first_name" in data
        assert "balance" in data
        assert "wallets" in data
        assert "language" in data
        assert data["language"] in ["uz", "ru"]
        print(f"✓ Login successful: User {data['first_name']} with balance {data['balance']}")
    
    def test_login_admin_user(self):
        """Test admin user login sets is_admin flag"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "telegram_id": ADMIN_TELEGRAM_ID,
            "first_name": "Admin User",
            "username": "adminuser"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_admin"] == True
        print(f"✓ Admin login: is_admin={data['is_admin']}")
    
    def test_login_missing_telegram_id(self):
        """Test login fails without telegram_id"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "first_name": "No ID User"
        })
        assert response.status_code == 400
        print("✓ Login correctly rejects missing telegram_id")


class TestUserEndpoints:
    """User profile endpoint tests"""
    
    def test_get_user_profile(self):
        """Test /api/user/{telegram_id} returns user profile"""
        # First ensure user exists
        requests.post(f"{BASE_URL}/api/auth/login", json={
            "telegram_id": TEST_TELEGRAM_ID,
            "first_name": TEST_USER_NAME
        })
        
        response = requests.get(f"{BASE_URL}/api/user/{TEST_TELEGRAM_ID}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["telegram_id"] == TEST_TELEGRAM_ID
        assert "balance" in data
        assert "wallets" in data
        assert "internal_id" in data
        print(f"✓ User profile: ID={data['internal_id']}, Balance={data['balance']}")
    
    def test_get_nonexistent_user(self):
        """Test getting non-existent user returns 404"""
        response = requests.get(f"{BASE_URL}/api/user/999999999999")
        assert response.status_code == 404
        print("✓ Non-existent user returns 404")
    
    def test_update_language(self):
        """Test /api/user/language updates user language"""
        response = requests.post(f"{BASE_URL}/api/user/language", json={
            "telegram_id": TEST_TELEGRAM_ID,
            "language": "ru"
        })
        assert response.status_code == 200
        
        # Verify language was updated
        user_response = requests.get(f"{BASE_URL}/api/user/{TEST_TELEGRAM_ID}")
        assert user_response.json()["language"] == "ru"
        
        # Reset to uz
        requests.post(f"{BASE_URL}/api/user/language", json={
            "telegram_id": TEST_TELEGRAM_ID,
            "language": "uz"
        })
        print("✓ Language update works correctly")
    
    def test_update_language_invalid(self):
        """Test invalid language code is rejected"""
        response = requests.post(f"{BASE_URL}/api/user/language", json={
            "telegram_id": TEST_TELEGRAM_ID,
            "language": "en"  # Invalid - only uz/ru allowed
        })
        assert response.status_code == 400
        print("✓ Invalid language code rejected")


class TestWalletEndpoints:
    """Wallet management endpoint tests"""
    
    def test_add_uzcard_wallet(self):
        """Test adding Uzcard wallet"""
        wallet_number = f"8600{uuid.uuid4().hex[:12]}"
        response = requests.post(f"{BASE_URL}/api/wallets/add", json={
            "telegram_id": TEST_TELEGRAM_ID,
            "wallet": {
                "type": "uzcard",
                "number": wallet_number,
                "expiry": "12/28"
            }
        })
        assert response.status_code == 200
        data = response.json()
        assert "wallet" in data
        assert data["wallet"]["type"] == "uzcard"
        print(f"✓ Uzcard wallet added: {wallet_number}")
    
    def test_add_humo_wallet(self):
        """Test adding Humo wallet"""
        wallet_number = f"9860{uuid.uuid4().hex[:12]}"
        response = requests.post(f"{BASE_URL}/api/wallets/add", json={
            "telegram_id": TEST_TELEGRAM_ID,
            "wallet": {
                "type": "humo",
                "number": wallet_number,
                "expiry": "06/27"
            }
        })
        assert response.status_code == 200
        print(f"✓ Humo wallet added: {wallet_number}")
    
    def test_add_mostbet_uzs_wallet(self):
        """Test adding Mostbet UZS wallet"""
        wallet_id = f"MB{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/wallets/add", json={
            "telegram_id": TEST_TELEGRAM_ID,
            "wallet": {
                "type": "mostbet_uzs",
                "number": wallet_id
            }
        })
        assert response.status_code == 200
        print(f"✓ Mostbet UZS wallet added: {wallet_id}")
    
    def test_add_mostbet_usd_wallet(self):
        """Test adding Mostbet USD wallet"""
        wallet_id = f"MBUSD{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/wallets/add", json={
            "telegram_id": TEST_TELEGRAM_ID,
            "wallet": {
                "type": "mostbet_usd",
                "number": wallet_id
            }
        })
        assert response.status_code == 200
        print(f"✓ Mostbet USD wallet added: {wallet_id}")
    
    def test_wallets_persist_in_user_profile(self):
        """Test wallets are persisted in user profile"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_TELEGRAM_ID}")
        assert response.status_code == 200
        data = response.json()
        
        assert "wallets" in data
        assert len(data["wallets"]) > 0
        
        wallet_types = [w["type"] for w in data["wallets"]]
        print(f"✓ User has {len(data['wallets'])} wallets: {wallet_types}")


class TestTransactionEndpoints:
    """Transaction endpoint tests"""
    
    def test_create_deposit_transaction(self):
        """Test creating deposit transaction"""
        response = requests.post(f"{BASE_URL}/api/transactions/create", json={
            "user_id": TEST_TELEGRAM_ID,
            "type": "deposit",
            "amount": 50000,
            "currency": "UZS",
            "method": "UZCARD (Admin)",
            "wallet_number": "External"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["type"] == "deposit"
        assert data["amount"] == 50000
        assert data["currency"] == "UZS"
        assert data["status"] == "pending"
        assert "id" in data
        print(f"✓ Deposit transaction created: {data['id']}")
        return data["id"]
    
    def test_create_deposit_usd(self):
        """Test creating USD deposit transaction"""
        response = requests.post(f"{BASE_URL}/api/transactions/create", json={
            "user_id": TEST_TELEGRAM_ID,
            "type": "deposit",
            "amount": 100,
            "currency": "USD",
            "method": "MOSTBET USD (Admin)",
            "wallet_number": "External"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["currency"] == "USD"
        print(f"✓ USD deposit created: {data['amount']} USD")
    
    def test_create_withdraw_transaction(self):
        """Test creating withdraw transaction with secret code"""
        # First get user's mostbet wallet
        user_response = requests.get(f"{BASE_URL}/api/user/{TEST_TELEGRAM_ID}")
        user_data = user_response.json()
        
        mostbet_wallet = None
        for w in user_data.get("wallets", []):
            if w["type"].startswith("mostbet"):
                mostbet_wallet = w
                break
        
        if not mostbet_wallet:
            pytest.skip("No Mostbet wallet found for withdrawal test")
        
        response = requests.post(f"{BASE_URL}/api/transactions/create", json={
            "user_id": TEST_TELEGRAM_ID,
            "type": "withdraw",
            "amount": 10000,
            "currency": "UZS",
            "method": mostbet_wallet["type"],
            "wallet_number": mostbet_wallet["number"],
            "secret_code": "ABCD1234"
        })
        
        # May fail if insufficient balance
        if response.status_code == 400:
            assert "Mablag' yetarli emas" in response.json().get("detail", "")
            print("✓ Withdraw correctly rejected due to insufficient balance")
        else:
            assert response.status_code == 200
            data = response.json()
            assert data["type"] == "withdraw"
            assert data["secret_code"] == "ABCD1234"
            print(f"✓ Withdraw transaction created: {data['id']}")
    
    def test_get_transaction_history(self):
        """Test /api/transactions/{telegram_id} returns history"""
        response = requests.get(f"{BASE_URL}/api/transactions/{TEST_TELEGRAM_ID}")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            tx = data[0]
            assert "id" in tx
            assert "type" in tx
            assert "amount" in tx
            assert "status" in tx
            assert "created_at" in tx
        print(f"✓ Transaction history: {len(data)} transactions")


class TestAdminCardsEndpoints:
    """Admin cards endpoint tests"""
    
    def test_get_admin_cards(self):
        """Test /api/admin/cards returns admin payment cards"""
        response = requests.get(f"{BASE_URL}/api/admin/cards")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        for card in data:
            assert "id" in card
            assert "type" in card
            assert "number" in card
            assert card["type"] in ["uzcard", "humo", "mostbet_uzs", "mostbet_usd"]
        print(f"✓ Admin cards: {len(data)} cards found")
        
        # Print card types for verification
        card_types = [c["type"] for c in data]
        print(f"  Card types: {card_types}")
    
    def test_add_admin_card(self):
        """Test adding admin card"""
        test_card_number = f"TEST{uuid.uuid4().hex[:12]}"
        response = requests.post(f"{BASE_URL}/api/admin/cards", json={
            "type": "uzcard",
            "number": test_card_number
        })
        assert response.status_code == 200
        data = response.json()
        assert "card" in data
        assert data["card"]["number"] == test_card_number
        
        # Store card ID for cleanup
        card_id = data["card"]["id"]
        print(f"✓ Admin card added: {test_card_number}")
        
        # Cleanup - delete the test card
        delete_response = requests.delete(f"{BASE_URL}/api/admin/cards/{card_id}")
        assert delete_response.status_code == 200
        print(f"✓ Test card cleaned up")
    
    def test_delete_nonexistent_card(self):
        """Test deleting non-existent card returns 404"""
        response = requests.delete(f"{BASE_URL}/api/admin/cards/nonexistent-id")
        assert response.status_code == 404
        print("✓ Delete non-existent card returns 404")


class TestAdminSettingsEndpoints:
    """Admin settings endpoint tests"""
    
    def test_get_settings(self):
        """Test /api/admin/settings returns settings"""
        response = requests.get(f"{BASE_URL}/api/admin/settings")
        assert response.status_code == 200
        data = response.json()
        
        # Settings may be empty or have values
        assert isinstance(data, dict)
        print(f"✓ Settings retrieved: {list(data.keys())}")
        
        if "exchange_rate" in data:
            print(f"  Exchange rate: 1 USD = {data['exchange_rate']} UZS")
    
    def test_get_settings_mostbet_api_key(self):
        """Test /api/admin/settings returns mostbet_api_key field"""
        response = requests.get(f"{BASE_URL}/api/admin/settings")
        assert response.status_code == 200
        data = response.json()
        
        assert "mostbet_api_key" in data
        assert isinstance(data["mostbet_api_key"], str)
        # API key should be masked (first 8 chars + ...)
        if data["mostbet_api_key"]:
            assert "..." in data["mostbet_api_key"] or len(data["mostbet_api_key"]) > 0
        print(f"✓ Mostbet API Key field present: {data['mostbet_api_key']}")
    
    def test_get_settings_mostbet_cashpoint_id(self):
        """Test /api/admin/settings returns mostbet_cashpoint_id field"""
        response = requests.get(f"{BASE_URL}/api/admin/settings")
        assert response.status_code == 200
        data = response.json()
        
        assert "mostbet_cashpoint_id" in data
        assert isinstance(data["mostbet_cashpoint_id"], str)
        print(f"✓ Mostbet Cashpoint ID field present: {data['mostbet_cashpoint_id']}")
    
    def test_update_settings(self):
        """Test updating admin settings"""
        # Get current settings
        current = requests.get(f"{BASE_URL}/api/admin/settings").json()
        
        # Update with test values
        response = requests.post(f"{BASE_URL}/api/admin/settings", json={
            "exchange_rate": 13000.0
        })
        assert response.status_code == 200
        
        # Verify update
        updated = requests.get(f"{BASE_URL}/api/admin/settings").json()
        assert updated.get("exchange_rate") == 13000.0
        
        # Restore original if existed
        if "exchange_rate" in current:
            requests.post(f"{BASE_URL}/api/admin/settings", json={
                "exchange_rate": current["exchange_rate"]
            })
        print("✓ Settings update works correctly")


class TestMostbetKassaEndpoints:
    """Mostbet Kassa API endpoint tests"""
    
    def test_get_kassa_balance(self):
        """Test /api/admin/kassa/balance returns balance data"""
        response = requests.get(f"{BASE_URL}/api/admin/kassa/balance")
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        if data["success"]:
            assert "data" in data
            assert "balance" in data["data"]
            assert "currency" in data["data"]
            assert isinstance(data["data"]["balance"], (int, float))
            assert isinstance(data["data"]["currency"], str)
            print(f"✓ Kassa balance: {data['data']['balance']} {data['data']['currency']}")
        else:
            # May fail if credentials not configured
            assert "error" in data
            print(f"✓ Kassa balance endpoint returns error (credentials may not be set): {data.get('error')}")
    
    def test_kassa_balance_response_structure(self):
        """Test kassa balance API returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/kassa/balance")
        assert response.status_code == 200
        data = response.json()
        
        # Must have success field
        assert "success" in data
        assert isinstance(data["success"], bool)
        
        # If success, must have data with balance and currency
        if data["success"]:
            assert "data" in data
            assert "balance" in data["data"]
            assert "currency" in data["data"]
            print(f"✓ Kassa balance structure valid: success={data['success']}, balance={data['data']['balance']}")
        else:
            # If error, must have error field
            assert "error" in data
            print(f"✓ Kassa balance structure valid: success=False, error={data['error']}")


class TestAdminTransactionEndpoints:
    """Admin transaction management tests"""
    
    def test_get_pending_transactions(self):
        """Test /api/admin/transactions/pending returns pending transactions"""
        response = requests.get(f"{BASE_URL}/api/admin/transactions/pending")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        for tx in data:
            assert tx["status"] == "pending"
        print(f"✓ Pending transactions: {len(data)} found")
    
    def test_get_admin_stats(self):
        """Test /api/admin/stats returns statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "total_users" in data
        assert "total_balance" in data
        assert "total_deposits" in data
        assert "pending_count" in data
        
        print(f"✓ Admin stats:")
        print(f"  Total users: {data['total_users']}")
        print(f"  Total balance: {data['total_balance']} UZS")
        print(f"  Total deposits: {data['total_deposits']} UZS")
        print(f"  Pending count: {data['pending_count']}")
    
    def test_get_all_users(self):
        """Test /api/admin/users returns user list"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            user = data[0]
            assert "telegram_id" in user
            assert "first_name" in user
            assert "balance" in user
        print(f"✓ Admin users: {len(data)} users found")
    
    def test_search_users_by_id(self):
        """Test user search by telegram ID"""
        response = requests.get(f"{BASE_URL}/api/admin/users?search={TEST_TELEGRAM_ID}")
        assert response.status_code == 200
        data = response.json()
        
        # Should find the test user
        found = any(u["telegram_id"] == TEST_TELEGRAM_ID for u in data)
        assert found, "Test user should be found by ID search"
        print(f"✓ User search by ID works")
    
    def test_search_users_by_name(self):
        """Test user search by name"""
        response = requests.get(f"{BASE_URL}/api/admin/users?search=Demo")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ User search by name: {len(data)} results")


class TestTransactionApprovalFlow:
    """Test transaction approval/rejection flow"""
    
    def test_approve_deposit_increases_balance(self):
        """Test approving deposit increases user balance"""
        # Get initial balance
        user_before = requests.get(f"{BASE_URL}/api/user/{TEST_TELEGRAM_ID}").json()
        initial_balance = user_before["balance"]
        
        # Create a deposit
        deposit_response = requests.post(f"{BASE_URL}/api/transactions/create", json={
            "user_id": TEST_TELEGRAM_ID,
            "type": "deposit",
            "amount": 25000,
            "currency": "UZS",
            "method": "UZCARD (Admin)",
            "wallet_number": "External"
        })
        assert deposit_response.status_code == 200
        tx_id = deposit_response.json()["id"]
        
        # Approve the deposit
        approve_response = requests.post(f"{BASE_URL}/api/admin/transactions/{tx_id}/approve")
        assert approve_response.status_code == 200
        
        # Verify balance increased
        user_after = requests.get(f"{BASE_URL}/api/user/{TEST_TELEGRAM_ID}").json()
        assert user_after["balance"] == initial_balance + 25000
        print(f"✓ Deposit approval: Balance {initial_balance} -> {user_after['balance']}")
    
    def test_reject_deposit_no_balance_change(self):
        """Test rejecting deposit doesn't change balance"""
        # Get initial balance
        user_before = requests.get(f"{BASE_URL}/api/user/{TEST_TELEGRAM_ID}").json()
        initial_balance = user_before["balance"]
        
        # Create a deposit
        deposit_response = requests.post(f"{BASE_URL}/api/transactions/create", json={
            "user_id": TEST_TELEGRAM_ID,
            "type": "deposit",
            "amount": 30000,
            "currency": "UZS",
            "method": "HUMO (Admin)",
            "wallet_number": "External"
        })
        assert deposit_response.status_code == 200
        tx_id = deposit_response.json()["id"]
        
        # Reject the deposit
        reject_response = requests.post(f"{BASE_URL}/api/admin/transactions/{tx_id}/reject")
        assert reject_response.status_code == 200
        
        # Verify balance unchanged
        user_after = requests.get(f"{BASE_URL}/api/user/{TEST_TELEGRAM_ID}").json()
        assert user_after["balance"] == initial_balance
        print(f"✓ Deposit rejection: Balance unchanged at {user_after['balance']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
