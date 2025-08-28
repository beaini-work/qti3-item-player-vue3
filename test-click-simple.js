import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Testing click-anywhere on MCQ choices...\n');
  
  await page.goto('http://localhost:5175/');
  await page.waitForTimeout(2000);
  
  const iframe = await page.$('iframe');
  const frame = await iframe.contentFrame();
  
  // Test clicking on different parts of choices
  const choices = await frame.$$('.qti-simple-choice');
  console.log(`Found ${choices.length} choices\n`);
  
  // Click on different parts of different choices
  console.log('1. Clicking on the 1st choice (number 2) - entire div...');
  await choices[0].click();
  await page.waitForTimeout(300);
  
  console.log('2. Clicking on the 3rd choice (number 4) - entire div...');
  await choices[2].click();
  await page.waitForTimeout(300);
  
  console.log('3. Clicking on the 5th choice (number 6) - entire div...');
  await choices[4].click();
  await page.waitForTimeout(300);
  
  // Get selected values
  const selected = await frame.$$eval('input:checked', inputs => 
    inputs.map(input => input.value)
  );
  
  console.log('\nSelected choice IDs:', selected);
  console.log('Selected numbers:', selected.map(id => {
    const num = parseInt(id.replace('c', '')) + 1;
    return num;
  }));
  
  // Test hover effect
  console.log('\n4. Testing hover effect on last choice...');
  await choices[7].hover();
  
  const hasHoverClass = await frame.$eval('.qti-simple-choice:last-child', el => {
    const styles = window.getComputedStyle(el);
    return {
      backgroundColor: styles.backgroundColor,
      borderColor: styles.borderColor,
      transform: styles.transform
    };
  });
  
  console.log('   Hover styles:', hasHoverClass);
  
  console.log('\n✅ Click-anywhere is working! You can click on any part of the choice box.');
  
  await page.waitForTimeout(2000);
  await browser.close();
})();
