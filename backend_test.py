import requests
import sys
from datetime import datetime
import json

class TotpayAPITester:
    def __init__(self, base_url="https://burapay-tgapp.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_user_id = 123456789  # Mock user ID from frontend
        
    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
            
            return success, response.json() if response.text else {}
            
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}
    
    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)
    
    def test_login(self):
        """Test login endpoint"""
        return self.run_test(
            "Login/Register User",
            "POST", 
            "auth/login",
            200,
            data={
                "telegram_id": self.test_user_id,
                "first_name": "Test User",
                "username": "testuser"
            }
        )
    
    def test_get_user_profile(self):
        """Test get user profile"""
        return self.run_test(
            "Get User Profile",
            "GET",
            f"user/{self.test_user_id}",
            200
        )
    
    def test_add_wallet(self):
        """Test add wallet"""
        return self.run_test(
            "Add Wallet",
            "POST",
            "wallets/add",
            200,
            data={
                "telegram_id": self.test_user_id,
                "wallet": {
                    "type": "uzcard",
                    "number": "8600123456789012",
                    "name": "Test Card"
                }
            }
        )
    
    def test_create_deposit(self):
        """Test create deposit transaction"""
        success, response = self.run_test(
            "Create Deposit",
            "POST",
            "transactions/create",
            200,
            data={
                "user_id": self.test_user_id,
                "type": "deposit",
                "amount": 100000,
                "currency": "UZS",
                "method": "manual_check"
            }
        )
        return success, response.get('id') if success else None
    
    def test_create_withdraw(self):
        """Test create withdraw transaction"""
        success, response = self.run_test(
            "Create Withdraw",
            "POST",
            "transactions/create",
            200,
            data={
                "user_id": self.test_user_id,
                "type": "withdraw",
                "amount": 50000,
                "currency": "UZS",
                "method": "uzcard",
                "wallet_number": "8600123456789012"
            }
        )
        return success, response.get('id') if success else None
    
    def test_get_transactions(self):
        """Test get user transactions"""
        return self.run_test(
            "Get User Transactions",
            "GET",
            f"transactions/{self.test_user_id}",
            200
        )
    
    def test_get_pending_transactions(self):
        """Test get pending transactions (admin)"""
        return self.run_test(
            "Get Pending Transactions",
            "GET",
            "admin/transactions/pending",
            200
        )
    
    def test_approve_transaction(self, tx_id):
        """Test approve transaction"""
        if not tx_id:
            print("❌ No transaction ID provided for approval test")
            return False, {}
        
        return self.run_test(
            "Approve Transaction",
            "POST",
            f"admin/transactions/{tx_id}/approve",
            200
        )
    
    def test_reject_transaction(self, tx_id):
        """Test reject transaction"""
        if not tx_id:
            print("❌ No transaction ID provided for rejection test")
            return False, {}
            
        return self.run_test(
            "Reject Transaction",
            "POST",
            f"admin/transactions/{tx_id}/reject",
            200
        )

def main():
    print("🚀 Starting Totpay API Tests...")
    tester = TotpayAPITester()
    
    # Test basic endpoints
    tester.test_root_endpoint()
    tester.test_login()
    tester.test_get_user_profile()
    
    # Test wallet functionality
    tester.test_add_wallet()
    
    # Test transaction creation
    deposit_success, deposit_id = tester.test_create_deposit()
    
    # Test transaction history
    tester.test_get_transactions()
    
    # Test admin endpoints
    tester.test_get_pending_transactions()
    
    # Test transaction approval if we have a deposit ID
    if deposit_id:
        tester.test_approve_transaction(deposit_id)
    
    # Test withdraw (should work after deposit is approved and balance is added)
    withdraw_success, withdraw_id = tester.test_create_withdraw()
    
    # Test transaction rejection if we have a withdraw ID
    if withdraw_id:
        tester.test_reject_transaction(withdraw_id)
    
    # Print final results
    print(f"\n📊 Final Results:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())