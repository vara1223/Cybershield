const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');

describe('CyberShield Login E2E Test', function() {
    let driver;

    before(async function() {
        let options = new (require('selenium-webdriver/chrome').Options)();
        options.addArguments('--headless=new'); // Use new headless mode
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        
        if (process.env.CHROME_BIN) {
            options.setChromeBinaryPath(process.env.CHROME_BIN);
        }
        
        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();
    });

    after(async function() {
        if (driver) {
            await driver.quit();
        }
    });

    it('should login successfully with valid credentials', async function() {
        try {
            await driver.get('http://localhost:8081');
            await driver.sleep(5000); 

            console.log("Waiting for email input...");
            const emailInput = await driver.wait(until.elementLocated(By.xpath('//*[@data-testid="email" or @placeholder="Email"]')), 15000);
            await driver.wait(until.elementIsVisible(emailInput), 5000);
            await emailInput.clear();
            await emailInput.sendKeys('devivaraprasadm5032.sse@saveetha.com');

            console.log("Waiting for password input...");
            const passInput = await driver.wait(until.elementLocated(By.xpath('//*[@data-testid="password" or @placeholder="Password"]')), 10000);
            await passInput.clear();
            await passInput.sendKeys('1234567');

            console.log("Waiting for login button...");
            const loginBtn = await driver.wait(until.elementLocated(By.xpath('//*[@data-testid="login-button" or text()="Log In"]')), 10000);
            await loginBtn.click();

            console.log("Waiting for dashboard...");
            const quickScanText = await driver.wait(until.elementLocated(By.xpath('//*[contains(text(), "Quick scan") or text()="Scan"]')), 15000);
            assert.ok(quickScanText, 'Quick scan section should be visible after login');
        } catch (error) {
            console.error('Test failed with error:', error.message);
            console.error('Stack:', error.stack);
            throw error;
        }
    });
});
