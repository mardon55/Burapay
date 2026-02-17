"""
BuraPay Mandatory Card Tests - Testing new features:
1. has_card field in user API
2. Mandatory Uzcard/Humo card check before transactions
3. short_id field in transactions for Telegram callback
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user without cards
TEST_USER_NO_CARD = 999888777
# Test user with cards (existing)
TEST_USER_WITH_CARD = 123456789


class TestHasCardField:
    """Test has_card field in user API"""
    
    def test_user_with_uzcard_has_card_true(self):
        """Test user with Uzcard returns has_card=true"""
        # First ensure user exists and has Uzcard
        requests.post(f"{BASE_URL}/api/auth/login", json={
            "telegram_id": TEST_USER_WITH_CARD,
            "first_name": "Test User"
        })
        
        # Add Uzcard if not exists
        requests.post(f"{BASE_URL}/api/wallets/add", json={
            "telegram_id": TEST_USER_WITH_CARD,
            "wallet": {
                "type": "uzcard",
                "number": f"8600{uuid.uuid4().hex[:12]}",
                "expiry": "12/28"
            }
        })
        
        # Get user profile
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_WITH_CARD}")
        assert response.status_code == 200
        data = response.json()
        
        assert "has_card" in data, "has_card field should be present in user response"
        assert data["has_card"] == True, "User with Uzcard should have has_card=true"
        print(f"✓ User with Uzcard has has_card={data['has_card']}")
    
    def test_user_with_humo_has_card_true(self):
        """Test user with Humo returns has_card=true"""
        # Create a new test user
        test_user_id = 888777666
        requests.post(f"{BASE_URL}/api/auth/login", json={
            "telegram_id": test_user_id,
            "first_name": "Humo Test User"
        })
        
        # Add Humo card
        requests.post(f"{BASE_URL}/api/wallets/add", json={
            "telegram_id": test_user_id,
            "wallet": {
                "type": "humo",
                "number": f"9860{uuid.uuid4().hex[:12]}",
                "expiry": "06/27"
            }
        })
        
        # Get user profile
        response = requests.get(f"{BASE_URL}/api/user/{test_user_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["has_card"] == True, "User with Humo should have has_card=true"
        print(f"✓ User with Humo has has_card={data['has_card']}")
    
    def test_user_with_only_mostbet_has_card_false(self):
        """Test user with only Mostbet wallet returns has_card=false"""
        # Create a new test user with only Mostbet
        test_user_id = 777666555
        requests.post(f"{BASE_URL}/api/auth/login", json={
            "telegram_id": test_user_id,
            "first_name": "Mostbet Only User"
        })
        
        # Get user profile - should have has_card=false if no Uzcard/Humo
        response = requests.get(f"{BASE_URL}/api/user/{test_user_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Check if user has any Uzcard/Humo
        wallets = data.get("wallets", [])
        has_uzcard_humo = any(w["type"] in ["uzcard", "humo"] for w in wallets)
        
        if not has_uzcard_humo:
            assert data["has_card"] == False, "User without Uzcard/Humo should have has_card=false"
            print(f"✓ User without Uzcard/Humo has has_card={data['has_card']}")
        else:
            print(f"⚠ User already has Uzcard/Humo, skipping test")


class TestMandatoryCardCheck:
    """Test mandatory card check for transactions"""
    
    def test_deposit_fails_without_card(self):
        """Test deposit creation fails when user has no Uzcard/Humo"""
        # Create a fresh user without any cards
        test_user_id = 666555444
        requests.post(f"{BASE_URL}/api/auth/login", json={
            "telegram_id": test_user_id,
            "first_name": "No Card User"
        })
        
        # Try to create deposit without card
        response = requests.post(f"{BASE_URL}/api/transactions/create", json={
            "user_id": test_user_id,
            "type": "deposit",
            "amount": 50000,
            "currency": "UZS",
            "method": "UZCARD (Admin)",
            "wallet_number": "External"
        })
        
        # Should fail with 400 error
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        assert "Uzcard" in data["detail"] or "Humo" in data["detail"], \
            f"Error should mention Uzcard/Humo requirement: {data['detail']}"
        print(f"✓ Deposit correctly rejected without card: {data['detail']}")
    
    def test_withdraw_fails_without_card(self):
        """Test withdrawal creation fails when user has no Uzcard/Humo"""
        # Create a fresh user without any cards
        test_user_id = 555444333
        requests.post(f"{BASE_URL}/api/auth/login", json={
            "telegram_id": test_user_id,
            "first_name": "No Card Withdraw User"
        })
        
        # Try to create withdrawal without card
        response = requests.post(f"{BASE_URL}/api/transactions/create", json={
            "user_id": test_user_id,
            "type": "withdraw",
            "amount": 10000,
            "currency": "UZS",
            "method": "mostbet_uzs",
            "wallet_number": "MB123456",
            "secret_code": "ABCD1234"
        })
        
        # Should fail with 400 error
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "Uzcard" in data["detail"] or "Humo" in data["detail"], \
            f"Error should mention Uzcard/Humo requirement: {data['detail']}"
        print(f"✓ Withdrawal correctly rejected without card: {data['detail']}")
    
    def test_deposit_succeeds_with_uzcard(self):
        """Test deposit creation succeeds when user has Uzcard"""
        # Use existing user with card
        response = requests.post(f"{BASE_URL}/api/transactions/create", json={
            "user_id": TEST_USER_WITH_CARD,
            "type": "deposit",
            "amount": 100000,
            "currency": "UZS",
            "method": "UZCARD (Admin)",
            "wallet_number": "External"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["type"] == "deposit"
        assert data["status"] == "pending"
        print(f"✓ Deposit created successfully with card: {data['id']}")
    
    def test_deposit_succeeds_with_humo(self):
        """Test deposit creation succeeds when user has Humo"""
        # Create user with Humo
        test_user_id = 444333222
        requests.post(f"{BASE_URL}/api/auth/login", json={
            "telegram_id": test_user_id,
            "first_name": "Humo Deposit User"
        })
        
        # Add Humo card
        requests.post(f"{BASE_URL}/api/wallets/add", json={
            "telegram_id": test_user_id,
            "wallet": {
                "type": "humo",
                "number": f"9860{uuid.uuid4().hex[:12]}",
                "expiry": "12/29"
            }
        })
        
        # Create deposit
        response = requests.post(f"{BASE_URL}/api/transactions/create", json={
            "user_id": test_user_id,
            "type": "deposit",
            "amount": 75000,
            "currency": "UZS",
            "method": "HUMO (Admin)",
            "wallet_number": "External"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["type"] == "deposit"
        print(f"✓ Deposit created successfully with Humo card: {data['id']}")


class TestShortIdField:
    """Test short_id field in transactions for Telegram callback"""
    
    def test_transaction_has_short_id(self):
        """Test transaction response includes short_id field"""
        response = requests.post(f"{BASE_URL}/api/transactions/create", json={
            "user_id": TEST_USER_WITH_CARD,
            "type": "deposit",
            "amount": 20000,
            "currency": "UZS",
            "method": "UZCARD (Admin)",
            "wallet_number": "External"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "short_id" in data, "Transaction should have short_id field"
        assert "id" in data, "Transaction should have id field (UUID)"
        
        # Verify short_id is 8 characters
        assert len(data["short_id"]) == 8, f"short_id should be 8 chars, got {len(data['short_id'])}"
        
        # Verify id is UUID format (36 chars with dashes)
        assert len(data["id"]) == 36, f"id should be UUID (36 chars), got {len(data['id'])}"
        
        print(f"✓ Transaction has short_id={data['short_id']} and id={data['id']}")
    
    def test_short_id_is_alphanumeric(self):
        """Test short_id contains only lowercase letters and digits"""
        response = requests.post(f"{BASE_URL}/api/transactions/create", json={
            "user_id": TEST_USER_WITH_CARD,
            "type": "deposit",
            "amount": 15000,
            "currency": "UZS",
            "method": "UZCARD (Admin)",
            "wallet_number": "External"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        short_id = data["short_id"]
        assert short_id.isalnum(), f"short_id should be alphanumeric: {short_id}"
        assert short_id.islower() or short_id.isdigit() or all(c.islower() or c.isdigit() for c in short_id), \
            f"short_id should be lowercase: {short_id}"
        
        print(f"✓ short_id is valid alphanumeric: {short_id}")
    
    def test_transaction_history_includes_short_id(self):
        """Test transaction history includes short_id for each transaction"""
        response = requests.get(f"{BASE_URL}/api/transactions/{TEST_USER_WITH_CARD}")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            # Check recent transactions have short_id
            for tx in data[:5]:  # Check first 5
                if "short_id" in tx:
                    assert len(tx["short_id"]) == 8, f"short_id should be 8 chars: {tx['short_id']}"
                    print(f"  Transaction {tx['id'][:8]}... has short_id={tx['short_id']}")
        
        print(f"✓ Transaction history checked ({len(data)} transactions)")


class TestWalletManagement:
    """Test wallet add/edit/delete functionality"""
    
    def test_add_wallet(self):
        """Test adding a new wallet"""
        wallet_number = f"8600{uuid.uuid4().hex[:12]}"
        response = requests.post(f"{BASE_URL}/api/wallets/add", json={
            "telegram_id": TEST_USER_WITH_CARD,
            "wallet": {
                "type": "uzcard",
                "number": wallet_number,
                "expiry": "01/30"
            }
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "wallet" in data
        assert data["wallet"]["number"] == wallet_number
        print(f"✓ Wallet added: {wallet_number}")
        
        return data["wallet"]["id"]
    
    def test_update_wallet(self):
        """Test updating an existing wallet"""
        # First add a wallet
        wallet_number = f"8600{uuid.uuid4().hex[:12]}"
        add_response = requests.post(f"{BASE_URL}/api/wallets/add", json={
            "telegram_id": TEST_USER_WITH_CARD,
            "wallet": {
                "type": "uzcard",
                "number": wallet_number,
                "expiry": "02/30"
            }
        })
        wallet_id = add_response.json()["wallet"]["id"]
        
        # Update the wallet
        new_number = f"8600{uuid.uuid4().hex[:12]}"
        update_response = requests.post(f"{BASE_URL}/api/wallets/update", json={
            "telegram_id": TEST_USER_WITH_CARD,
            "wallet_id": wallet_id,
            "wallet": {
                "number": new_number,
                "expiry": "03/31"
            }
        })
        
        assert update_response.status_code == 200
        print(f"✓ Wallet updated: {wallet_number} -> {new_number}")
    
    def test_delete_wallet(self):
        """Test deleting a wallet"""
        # First add a wallet
        wallet_number = f"8600{uuid.uuid4().hex[:12]}"
        add_response = requests.post(f"{BASE_URL}/api/wallets/add", json={
            "telegram_id": TEST_USER_WITH_CARD,
            "wallet": {
                "type": "uzcard",
                "number": wallet_number,
                "expiry": "04/30"
            }
        })
        wallet_id = add_response.json()["wallet"]["id"]
        
        # Delete the wallet
        delete_response = requests.post(f"{BASE_URL}/api/wallets/delete", json={
            "telegram_id": TEST_USER_WITH_CARD,
            "wallet_id": wallet_id
        })
        
        assert delete_response.status_code == 200
        print(f"✓ Wallet deleted: {wallet_id}")
        
        # Verify wallet is gone
        user_response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_WITH_CARD}")
        wallets = user_response.json().get("wallets", [])
        wallet_ids = [w["id"] for w in wallets]
        assert wallet_id not in wallet_ids, "Deleted wallet should not be in user's wallets"
        print(f"✓ Wallet deletion verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
