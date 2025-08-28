import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Testing QTI Response Processing...\n');
  
  await page.goto('http://localhost:5175/');
  await page.waitForTimeout(2000);
  
  // Select correct answers
  const iframe = await page.$('iframe');
  const frame = await iframe.contentFrame();
  
  console.log('1. Selecting correct answers (2, 3, 5, 7)...');
  await frame.click('input[value="c1"]'); // 2
  await frame.click('input[value="c2"]'); // 3
  await frame.click('input[value="c4"]'); // 5
  await frame.click('input[value="c6"]'); // 7
  
  await page.waitForTimeout(500);
  
  // Get response through Vue component
  const vueResponse = await page.evaluate(() => {
    const app = document.querySelector('#app')?.__vue_app__;
    if (app) {
      const pciComponent = document.querySelector('.qti-portable-custom-interaction')?.__vueParentComponent;
      if (pciComponent && pciComponent.proxy) {
        return {
          response: pciComponent.proxy.response,
          responseIdentifier: pciComponent.proxy.responseIdentifier,
          isValid: pciComponent.proxy.isValid
        };
      }
    }
    return null;
  });
  
  console.log('\n2. Vue Component Response:', vueResponse);
  
  // Click Check Answer
  console.log('\n3. Clicking Check Answer...');
  await frame.click('.qti-check-button');
  await page.waitForTimeout(500);
  
  const feedback = await frame.$eval('.qti-feedback', el => el.textContent.trim());
  console.log('   Feedback:', feedback);
  
  // Check the score
  const scoreInfo = await frame.evaluate(() => {
    // Try to access the PCI instance directly in the iframe
    if (window.customInteractionInstance) {
      const instance = window.customInteractionInstance;
      return {
        score: instance.getScore ? instance.getScore() : 'N/A',
        response: instance.getResponse ? instance.getResponse() : 'N/A',
        processedResponse: instance.processResponse ? instance.processResponse() : 'N/A'
      };
    }
    return { error: 'Instance not found in iframe' };
  });
  
  console.log('\n4. Scoring Information:', scoreInfo);
  
  console.log('\n✅ Test completed!');
  
  await page.waitForTimeout(2000);
  await browser.close();
})();
