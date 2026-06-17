from selenium import webdriver
from selenium.webdriver.common.by import By
import time

options = webdriver.ChromeOptions()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')
options.add_argument('--window-size=1280,800')
driver = webdriver.Chrome(options=options)

driver.get('http://localhost:8082')
time.sleep(5)

# Print all input elements
inputs = driver.find_elements(By.TAG_NAME, 'input')
print(f'Found {len(inputs)} input elements')
for i, el in enumerate(inputs):
    html = el.get_attribute('outerHTML')
    print(f'Input {i}: {html}')

# Print all textareas
textareas = driver.find_elements(By.TAG_NAME, 'textarea')
print(f'Found {len(textareas)} textarea elements')
for i, el in enumerate(textareas):
    html = el.get_attribute('outerHTML')
    print(f'Textarea {i}: {html}')

# Print all divs with role=textbox
textboxes = driver.find_elements(By.XPATH, '//*[@role="textbox"]')
print(f'Found {len(textboxes)} role=textbox elements')
for i, el in enumerate(textboxes):
    html = el.get_attribute('outerHTML')
    print(f'Textbox {i}: {html}')

driver.quit()
