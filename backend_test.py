import requests
import sys
import json
from datetime import datetime

class PowderInventoryAPITester:
    def __init__(self, base_url="https://metamorph-inventory.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_powder_id = None
        self.created_task_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic health endpoint"""
        return self.run_test("Health Check", "GET", "", 200)

    def test_create_powder(self):
        """Test creating a powder"""
        powder_data = {
            "name": "RAL 9016 White",
            "color": "White", 
            "supplier": "AkzoNobel",
            "current_stock_kg": 5.0,
            "safety_stock_kg": 3.0,
            "cost_per_kg": 8.5
        }
        success, response = self.run_test("Create Powder", "POST", "powders", 200, powder_data)
        if success and 'id' in response:
            self.created_powder_id = response['id']
            print(f"   Created powder ID: {self.created_powder_id}")
        return success

    def test_list_powders(self):
        """Test listing powders"""
        success, response = self.run_test("List Powders", "GET", "powders", 200)
        if success:
            print(f"   Found {len(response)} powders")
        return success

    def test_powder_summary(self):
        """Test powder summary endpoint"""
        success, response = self.run_test("Powder Summary", "GET", "powders/summary", 200)
        if success:
            print(f"   Total SKUs: {response.get('total_skus', 0)}")
            print(f"   Total Stock: {response.get('total_stock_kg', 0)} kg")
            print(f"   Low Stock Count: {response.get('low_stock_count', 0)}")
        return success

    def test_receive_stock(self):
        """Test receiving stock for a powder"""
        if not self.created_powder_id:
            print("❌ No powder ID available for stock transaction")
            return False
            
        transaction_data = {
            "type": "receive",
            "quantity_kg": 2.0,
            "note": "Test receive transaction"
        }
        return self.run_test("Receive Stock", "POST", f"powders/{self.created_powder_id}/transactions", 200, transaction_data)

    def test_consume_stock(self):
        """Test consuming stock for a powder"""
        if not self.created_powder_id:
            print("❌ No powder ID available for stock transaction")
            return False
            
        transaction_data = {
            "type": "consume",
            "quantity_kg": 6.0,
            "note": "Test consume transaction"
        }
        return self.run_test("Consume Stock", "POST", f"powders/{self.created_powder_id}/transactions", 200, transaction_data)

    def test_update_powder(self):
        """Test updating a powder"""
        if not self.created_powder_id:
            print("❌ No powder ID available for update")
            return False
            
        update_data = {
            "cost_per_kg": 9.0
        }
        return self.run_test("Update Powder", "PATCH", f"powders/{self.created_powder_id}", 200, update_data)

    def test_create_task(self):
        """Test creating a task"""
        task_data = {
            "title": "Coat batch #1023 in RAL 9005",
            "description": "Prep, coat, cure",
            "assignee": "Amit"
        }
        success, response = self.run_test("Create Task", "POST", "tasks", 200, task_data)
        if success and 'id' in response:
            self.created_task_id = response['id']
            print(f"   Created task ID: {self.created_task_id}")
        return success

    def test_list_today_tasks(self):
        """Test listing today's tasks"""
        success, response = self.run_test("List Today's Tasks", "GET", "tasks/today", 200)
        if success:
            print(f"   Found {len(response)} tasks for today")
        return success

    def test_update_task(self):
        """Test updating a task"""
        if not self.created_task_id:
            print("❌ No task ID available for update")
            return False
            
        update_data = {
            "status": "done"
        }
        return self.run_test("Update Task", "PATCH", f"tasks/{self.created_task_id}", 200, update_data)

def main():
    print("🚀 Starting Powder Inventory API Tests")
    print("=" * 50)
    
    tester = PowderInventoryAPITester()
    
    # Test sequence
    test_sequence = [
        ("Health Check", tester.test_health_check),
        ("Create Powder", tester.test_create_powder),
        ("List Powders", tester.test_list_powders),
        ("Powder Summary", tester.test_powder_summary),
        ("Receive Stock", tester.test_receive_stock),
        ("Consume Stock", tester.test_consume_stock),
        ("Update Powder", tester.test_update_powder),
        ("Create Task", tester.test_create_task),
        ("List Today's Tasks", tester.test_list_today_tasks),
        ("Update Task", tester.test_update_task),
    ]
    
    # Run all tests
    for test_name, test_func in test_sequence:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())