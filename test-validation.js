import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('1. Navigating to app...');
  await page.goto('http://localhost:5175/');
  await page.waitForTimeout(2000);
  
  // Get iframe
  const iframe = await page.$('iframe');
  if (!iframe) {
    console.log('ERROR: No iframe found');
    await browser.close();
    return;
  }
  
  const frame = await iframe.contentFrame();
  
  console.log('\n2. Testing validation features...');
  
  // Test 1: Click Check Answer without selecting anything
  console.log('\n--- Test 1: Check without selection ---');
  const checkButton = await frame.$('.qti-check-button');
  if (checkButton) {
    await checkButton.click();
    await page.waitForTimeout(500);
    
    const feedback = await frame.$eval('.qti-feedback', el => ({
      visible: el.offsetHeight > 0,
      text: el.textContent.trim()
    }));
    console.log('Feedback:', feedback);
  }
  
  // Test 2: Select wrong answers
  console.log('\n--- Test 2: Select wrong answers (4, 6, 8) ---');
  await frame.click('input[value="c3"]'); // 4
  await frame.click('input[value="c5"]'); // 6
  await frame.click('input[value="c7"]'); // 8
  await checkButton.click();
  await page.waitForTimeout(500);
  
  const wrongFeedback = await frame.$eval('.qti-feedback', el => ({
    class: el.className,
    text: el.textContent.trim()
  }));
  console.log('Wrong answer feedback:', wrongFeedback);
  
  // Check highlighting
  const highlighted = await frame.$$eval('.qti-simple-choice', choices => 
    choices.map(el => ({
      text: el.querySelector('label').textContent.trim(),
      classes: el.className
    }))
  );
  console.log('Choice highlighting:', highlighted);
  
  // Test 3: Clear and select correct answers
  console.log('\n--- Test 3: Select correct answers (2, 3, 5, 7) ---');
  // Clear wrong answers
  await frame.click('input[value="c3"]'); // uncheck 4
  await frame.click('input[value="c5"]'); // uncheck 6
  await frame.click('input[value="c7"]'); // uncheck 8
  
  // Select correct answers
  await frame.click('input[value="c1"]'); // 2
  await frame.click('input[value="c2"]'); // 3
  await frame.click('input[value="c4"]'); // 5
  await frame.click('input[value="c6"]'); // 7
  
  await checkButton.click();
  await page.waitForTimeout(500);
  
  const correctFeedback = await frame.$eval('.qti-feedback', el => ({
    class: el.className,
    text: el.textContent.trim()
  }));
  console.log('Correct answer feedback:', correctFeedback);
  
  // Test QTI response processing
  console.log('\n--- Test 4: QTI Response Processing ---');
  const response = await frame.evaluate(() => {
    const pci = window.qtiCustomInteractionContext?.customInteractions?.['strategy-runtime'];
    if (pci && pci.getInstance) {
      const instance = pci.getInstance();
      return {
        response: instance.getResponse(),
        score: instance.getScore(),
        processedResponse: instance.processResponse()
      };
    }
    return null;
  });
  console.log('QTI Response:', response);
  
  console.log('\n✅ All tests completed!');
  
  await page.waitForTimeout(3000);
  await browser.close();
})();
