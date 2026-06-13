from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import os

def capture_user_screenshots():
    screenshot_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "testreports", "screenshots"))
    os.makedirs(screenshot_dir, exist_ok=True)
    print(f"Screenshots will be saved to: {screenshot_dir}")

    print("Initializing headless Chrome WebDriver...")
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,800")
    
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 10)

    try:
        # 1. Login Page
        print("Navigating to http://localhost:8081...")
        driver.get("http://localhost:8081")
        time.sleep(5)  # Wait for Expo app compilation/loading
        
        # 2. Enter Credentials
        print("Entering User Credentials...")
        email_input = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//*[@placeholder='Email']")
        ))
        email_input.clear()
        email_input.send_keys("devivaraprasadm5032.sse@saveetha.com")
        
        pass_input = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//*[@placeholder='Password']")
        ))
        pass_input.clear()
        pass_input.send_keys("1234567")
        
        path1 = os.path.join(screenshot_dir, "05_user_login_filled.png")
        driver.save_screenshot(path1)
        print("Saved: 05_user_login_filled.png")

        # 3. Click Login
        print("Clicking Log In...")
        login_btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//*[text()='Log In']")
        ))
        login_btn.click()
        time.sleep(5) 
        
        # 4. User Dashboard / Main Screen
        path2 = os.path.join(screenshot_dir, "06_user_dashboard.png")
        driver.save_screenshot(path2)
        print("Saved: 06_user_dashboard.png")
        
        # 5. History Tab
        print("Clicking History tab...")
        try:
            history_tab = driver.find_element(By.XPATH, "//*[text()='History']")
            history_tab.click()
            time.sleep(2)
            path_hist = os.path.join(screenshot_dir, "08_user_history_tab.png")
            driver.save_screenshot(path_hist)
            print("Saved: 08_user_history_tab.png")
        except:
            print("History tab not found.")

        # 6. Tools via Home Screen (Go back to Home)
        print("Going back to Home tab...")
        try:
            home_tab = driver.find_element(By.XPATH, "//*[text()='Home']")
            home_tab.click()
            time.sleep(2)
        except:
            pass

        print("Clicking QR code tool...")
        try:
            qr_tool = driver.find_element(By.XPATH, "//*[text()='QR code']")
            qr_tool.click()
            time.sleep(2)
            path_tool = os.path.join(screenshot_dir, "09_user_tool_qrcode.png")
            driver.save_screenshot(path_tool)
            print("Saved: 09_user_tool_qrcode.png")
        except:
            print("QR code tool not found.")
            
        print("All user demo screenshots successfully captured!")

    except Exception as e:
        print(f"Error during user screenshot capture: {e}")
    finally:
        driver.quit()

if __name__ == '__main__':
    capture_user_screenshots()
