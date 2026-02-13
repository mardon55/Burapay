import requests
import sys
from datetime import datetime
import json

class WalletSyncTester:
    def __init__(self, base_url="https://manga-shunaqa.preview.emergentagent.com/api"):
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
                    print(f"   Response: {json.dumps(response_data, indent=2)[:300]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
            
            return success, response.json() if response.text else {}
            
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}
    
    def test_add_specific_wallet(self):
        """Test adding the specific wallet 9860000000000000"""
        return self.run_test(
            "Add Specific Wallet (9860000000000000)",
            "POST",
            "wallets/add",
            200,
            data={
                "telegram_id": self.test_user_id,
                "wallet": {
                    "type": "uzcard",
                    "number": "9860000000000000",
                    "name": "Test Sync Card"
                }
            }
        )
    
    def test_get_user_wallets(self):
        """Test getting user profile to check wallets"""
        success, response = self.run_test(
            "Get User Profile (Check Wallets)",
            "GET",
            f"user/{self.test_user_id}",
            200
        )
        
        if success:
            wallets = response.get('wallets', [])
            print(f"   Found {len(wallets)} wallets:")
            for wallet in wallets:
                print(f"     - {wallet.get('type', 'unknown')}: {wallet.get('number', 'no number')}")
            
            # Check if our specific wallet is present
            target_wallet = None
            for wallet in wallets:
                if wallet.get('number') == '9860000000000000':
                    target_wallet = wallet
                    break
            
            if target_wallet:
                print(f"   ✅ Target wallet found: {target_wallet}")
                return True, target_wallet
            else:
                print(f"   ❌ Target wallet '9860000000000000' not found in wallets")
                return False, None
        
        return success, None

def main():
    print("🚀 Starting Wallet Synchronization Test...")
    tester = WalletSyncTester()
    
    # Step 1: Add the specific wallet
    print("\n=== STEP 1: Adding wallet 9860000000000000 ===")
    add_success, add_response = tester.test_add_specific_wallet()
    
    if not add_success:
        print("❌ Failed to add wallet, stopping test")
        return 1
    
    # Step 2: Verify wallet is in user profile
    print("\n=== STEP 2: Verifying wallet in user profile ===")
    profile_success, target_wallet = tester.test_get_user_wallets()
    
    if not profile_success or not target_wallet:
        print("❌ Wallet not found in user profile after adding")
        return 1
    
    print(f"\n✅ Wallet synchronization test completed successfully!")
    print(f"   Wallet ID: {target_wallet.get('id')}")
    print(f"   Wallet Type: {target_wallet.get('type')}")
    print(f"   Wallet Number: {target_wallet.get('number')}")
    
    # Print final results
    print(f"\n📊 Final Results:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())