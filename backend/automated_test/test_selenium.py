from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
import time

try:
    print("Initializing Chrome Webdriver...")
    options = webdriver.ChromeOptions()
    options.add_argument("--headless") # Run in headless mode so we don't pop up a window on the user
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    driver = webdriver.Chrome(options=options)
    print("Chrome Webdriver initialized successfully!")
    
    print("Navigating to http://localhost:8081...")
    driver.get("http://localhost:8081")
    time.sleep(5) # Give it time to load the React Native bundle
    
    print("Page Title:", driver.title)
    print("Page Source Length:", len(driver.page_source))
    
    driver.quit()
    print("Done!")
except Exception as e:
    print("Error occurred:")
    print(e)
