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
        // Navigating to the Expo web app (assume it's running locally for this test)
        await driver.get('http://localhost:8081');

        // Wait for Expo to load (usually it takes a few seconds to bundle)
        await driver.sleep(5000); 

        // Locate email input by testID which translates to data-testid in some RN-Web versions
        // or just placeholder if testID mapping isn't active by default
        const emailInput = await driver.wait(until.elementLocated(By.xpath('//*[@data-testid="email" or @placeholder="Email"]')), 10000);
        await emailInput.clear();
        await emailInput.sendKeys('devivaraprasadm5032.sse@saveetha.com');

        const passInput = await driver.wait(until.elementLocated(By.xpath('//*[@data-testid="password" or @placeholder="Password"]')), 10000);
        await passInput.clear();
        await passInput.sendKeys('1234567');

        const loginBtn = await driver.wait(until.elementLocated(By.xpath('//*[@data-testid="login-button" or text()="Log In"]')), 10000);
        await loginBtn.click();

        // Wait for Dashboard to appear
        // Assuming there is some element like "Quick scan" or "Home"
        const quickScanText = await driver.wait(until.elementLocated(By.xpath('//*[contains(text(), "Quick scan") or text()="Scan"]')), 15000);
        assert.ok(quickScanText, 'Quick scan section should be visible after login');
    });
});
