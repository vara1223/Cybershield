from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import os

def capture_demo_screenshots():
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
        
        path1 = os.path.join(screenshot_dir, "01_login_page.png")
        driver.save_screenshot(path1)
        print("Saved: 01_login_page.png")

        # 2. Go to Admin Panel PIN entry
        print("Logging in with Admin credentials to navigate to Admin Panel...")
        email_input = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//*[@placeholder='Email']")
        ))
        email_input.clear()
        email_input.send_keys("admin@cybershield.com")
        
        pass_input = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//*[@placeholder='Password']")
        ))
        pass_input.clear()
        pass_input.send_keys("admin123")
        
        login_btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//*[text()='Log In']")
        ))
        login_btn.click()
        time.sleep(3)
        
        path2 = os.path.join(screenshot_dir, "02_pin_entry_page.png")
        driver.save_screenshot(path2)
        print("Saved: 02_pin_entry_page.png")

        # 3. Enter PIN '1234'
        print("Entering PIN '1234' on numpad...")
        for digit in ['1', '2', '3', '4']:
            key = wait.until(EC.element_to_be_clickable(
                (By.XPATH, f"//*[text()='{digit}']")
            ))
            key.click()
            time.sleep(0.3)
        time.sleep(2)  # Wait for stats animation
        
        path3 = os.path.join(screenshot_dir, "03_admin_dashboard.png")
        driver.save_screenshot(path3)
        print("Saved: 03_admin_dashboard.png")

        # 4. Lock panel back
        print("Locking dashboard...")
        lock_btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//*[contains(text(), 'Lock panel')]")
        ))
        try:
            lock_btn.click()
        except:
            driver.execute_script("arguments[0].click();", lock_btn)
        time.sleep(1)
        
        path4 = os.path.join(screenshot_dir, "04_dashboard_locked.png")
        driver.save_screenshot(path4)
        print("Saved: 04_dashboard_locked.png")

        print("All demo screenshots successfully captured!")

    except Exception as e:
        print(f"Error during screenshot capture: {e}")
    finally:
        driver.quit()

if __name__ == '__main__':
    capture_demo_screenshots()
