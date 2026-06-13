import time
from appium import webdriver
from appium.options.android import UiAutomator2Options
from appium.webdriver.common.appiumby import AppiumBy
from openpyxl import Workbook
from datetime import datetime
import os

# --- Configuration ---
# Update this path if the APK is located elsewhere
APK_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "cybershield.apk")) 
APPIUM_SERVER_URL = "http://127.0.0.1:4723"

def run_appium_tests():
    print("Starting Appium UI Automation Tests...")
    
    options = UiAutomator2Options()
    options.platform_name = 'Android'
    options.automation_name = 'UiAutomator2'
    
    # Check if we have an APK to install/run
    if os.path.exists(APK_PATH):
        options.app = APK_PATH
    else:
        print(f"Warning: APK not found at {APK_PATH}.")
        print("Please build the APK or update the APK_PATH. For now, attempting to connect assuming it's installed.")
        # Attempting to launch Expo Go as a fallback for React Native local testing
        options.app_package = 'host.exp.exponent'
        options.app_activity = 'host.exp.exponent.LauncherActivity'
    
    options.auto_grant_permissions = True
    options.no_reset = False

    driver = None
    results = []

    try:
        # Initialize WebDriver
        driver = webdriver.Remote(APPIUM_SERVER_URL, options=options)
        driver.implicitly_wait(10)
        print("App launched successfully.")

        # Test Case 1: App Launch
        results.append({
            "Test Case": "App Launch",
            "Status": "Passed",
            "Details": "Successfully connected to Appium server and launched the app/environment",
            "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })

        # Test Case 2: Basic UI Interaction (Example)
        # Note: Since the exact accessibility IDs for CyberShield might differ, these are placeholder interactions.
        time.sleep(3)
        try:
            # Example: Looking for a generic URL Scan button
            # Replace 'URL Scan' with the actual accessibilityLabel defined in the React Native code.
            scan_btn = driver.find_element(AppiumBy.ACCESSIBILITY_ID, "URL Scan")
            scan_btn.click()
            results.append({
                "Test Case": "Navigate to URL Scan",
                "Status": "Passed",
                "Details": "Successfully found and clicked URL Scan element",
                "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
        except Exception as e:
            results.append({
                "Test Case": "Navigate to URL Scan",
                "Status": "Failed",
                "Details": f"Element not found or interactable: {str(e)[:100]}...",
                "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })

    except Exception as e:
        print(f"Critical error during Appium execution: {e}")
        results.append({
            "Test Case": "App Initialization",
            "Status": "Failed",
            "Details": f"Failed to start session. Is Appium server running and Emulator attached? Error: {str(e)[:100]}...",
            "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
    finally:
        if driver:
            driver.quit()

    generate_excel_report(results)

def generate_excel_report(results):
    wb = Workbook()
    ws = wb.active
    ws.title = "Appium Test Report"

    # Headers
    headers = ["Test Case", "Status", "Details", "Timestamp"]
    ws.append(headers)

    for res in results:
        ws.append([res["Test Case"], res["Status"], res["Details"], res["Timestamp"]])

    report_path = os.path.join(os.path.dirname(__file__), "CyberShield_Appium_Test_Report.xlsx")
    wb.save(report_path)
    print(f"Test complete. Report saved to: {report_path}")

if __name__ == '__main__':
    run_appium_tests()
