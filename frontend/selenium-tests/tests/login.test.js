const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');

describe('CyberShield Login E2E Test', function() {
    this.timeout(90000); // 90 second timeout for full Expo bundling
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

    it('should verify page renders and login successfully', async function() {
        try {
            await driver.get('http://localhost:8081');
            console.log('Waiting 8s for Expo to fully render...');
            await driver.sleep(8000);

            // ── Verification: log page title and check elements are present ──
            const title = await driver.getTitle();
            console.log(`Page title: "${title}"`);

            const bodyText = await driver.findElement(By.css('body')).getText();
            console.log(`Body preview (first 300 chars): ${bodyText.substring(0, 300)}`);

            const allInputs = await driver.findElements(By.css('input'));
            console.log(`Total <input> elements found: ${allInputs.length}`);
            for (let i = 0; i < allInputs.length; i++) {
                const attrs = await driver.executeScript(
                    'var el=arguments[0]; var res={}; for(var a of el.attributes){res[a.name]=a.value;} return JSON.stringify(res);',
                    allInputs[i]
                );
                console.log(`  input[${i}] attrs: ${attrs}`);
            }

            const testIds = await driver.findElements(By.css('[data-testid]'));
            console.log(`Total [data-testid] elements found: ${testIds.length}`);
            for (let i = 0; i < testIds.length; i++) {
                const tid = await testIds[i].getAttribute('data-testid');
                console.log(`  data-testid="${tid}"`);
            }
            // ── End Verification ──

            console.log("Waiting for email input...");
            const emailInput = await driver.wait(
                until.elementLocated(By.css('[data-testid="email"]')),
                20000,
                'Email input element not found'
            );
            await driver.wait(until.elementIsVisible(emailInput), 10000);
            await emailInput.clear();
            await emailInput.sendKeys('devivaraprasadm5032.sse@saveetha.com');

            console.log("Waiting for password input...");
            const passInput = await driver.wait(
                until.elementLocated(By.css('[data-testid="password"]')),
                20000,
                'Password input element not found'
            );
            await passInput.clear();
            await passInput.sendKeys('1234567');

            console.log("Waiting for login button...");
            const loginBtn = await driver.wait(
                until.elementLocated(By.css('[data-testid="login-button"]')),
                20000,
                'Login button not found'
            );
            await loginBtn.click();

            console.log("Waiting for dashboard...");
            const quickScanText = await driver.wait(
                until.elementLocated(By.xpath('//*[contains(text(), "Quick scan")] | //*[text()="Scan"]')),
                20000,
                'Dashboard not found after login'
            );
            assert.ok(quickScanText, 'Quick scan section should be visible after login');
        } catch (error) {
            console.error('Test failed with error:', error.message);
            console.error('Stack:', error.stack);
            throw error;
        }
    });
});
