import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Testing feedback resize...\n');
  
  await page.goto('http://localhost:5175/');
  await page.waitForTimeout(2000);
  
  const iframe = await page.$('iframe');
  const frame = await iframe.contentFrame();
  
  // Get initial iframe height
  const initialHeight = await iframe.evaluate(el => el.offsetHeight);
  console.log('1. Initial iframe height:', initialHeight, 'px');
  
  // Click Check Answer to show feedback
  console.log('\n2. Clicking Check Answer...');
  await frame.click('.qti-check-button');
  await page.waitForTimeout(1000);
  
  // Get height after feedback
  const afterFeedbackHeight = await iframe.evaluate(el => el.offsetHeight);
  console.log('   Height after feedback:', afterFeedbackHeight, 'px');
  console.log('   Height increased by:', afterFeedbackHeight - initialHeight, 'px');
  
  // Check if feedback is fully visible
  const feedbackVisible = await frame.$eval('.qti-feedback', el => {
    const rect = el.getBoundingClientRect();
    return {
      visible: el.offsetHeight > 0,
      height: el.offsetHeight,
      bottomPosition: rect.bottom,
      viewportHeight: window.innerHeight,
      fullyVisible: rect.bottom <= window.innerHeight
    };
  });
  
  console.log('\n3. Feedback visibility:');
  console.log('   Visible:', feedbackVisible.visible);
  console.log('   Height:', feedbackVisible.height, 'px');
  console.log('   Fully visible in frame:', feedbackVisible.fullyVisible);
  
  // Select an answer and check again
  console.log('\n4. Selecting an answer and checking again...');
  await frame.click('input[value="c1"]'); // Select 2
  await page.waitForTimeout(500);
  
  // Click check again
  await frame.click('.qti-check-button');
  await page.waitForTimeout(1000);
  
  const finalHeight = await iframe.evaluate(el => el.offsetHeight);
  console.log('   Final iframe height:', finalHeight, 'px');
  
  if (finalHeight > initialHeight) {
    console.log('\n✅ SUCCESS: Iframe properly resizes for feedback!');
  } else {
    console.log('\n⚠️  WARNING: Iframe may not be resizing properly');
  }
  
  await page.waitForTimeout(2000);
  await browser.close();
})();
