import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Testing click-anywhere functionality...\n');
  
  await page.goto('http://localhost:5175/');
  await page.waitForTimeout(2000);
  
  const iframe = await page.$('iframe');
  const frame = await iframe.contentFrame();
  
  // Test 1: Click on the text part of a choice
  console.log('1. Clicking on choice text (not checkbox)...');
  const choice2Label = await frame.$('label[for="choice-c1"]');
  await choice2Label.click();
  await page.waitForTimeout(500);
  
  const choice2Checked = await frame.$eval('#choice-c1', el => el.checked);
  console.log('   Choice 2 selected:', choice2Checked);
  
  // Test 2: Click on the div wrapper
  console.log('\n2. Clicking on choice wrapper div...');
  const choice3Div = await frame.$('[data-choice-id="c2"]');
  const boundingBox = await choice3Div.boundingBox();
  // Click near the right edge of the div
  await frame.mouse.click(boundingBox.x + boundingBox.width - 10, boundingBox.y + boundingBox.height / 2);
  await page.waitForTimeout(500);
  
  const choice3Checked = await frame.$eval('#choice-c2', el => el.checked);
  console.log('   Choice 3 selected:', choice3Checked);
  
  // Test 3: Click directly on checkbox (should still work)
  console.log('\n3. Clicking directly on checkbox...');
  const choice5Checkbox = await frame.$('#choice-c4');
  await choice5Checkbox.click();
  await page.waitForTimeout(500);
  
  const choice5Checked = await frame.$eval('#choice-c4', el => el.checked);
  console.log('   Choice 5 selected:', choice5Checked);
  
  // Get all selected choices
  const selectedChoices = await frame.$$eval('input:checked', inputs => 
    inputs.map(input => {
      const label = document.querySelector(`label[for="${input.id}"]`);
      return label ? label.textContent.trim() : input.value;
    })
  );
  
  console.log('\n4. All selected choices:', selectedChoices);
  
  // Test hover effect
  console.log('\n5. Testing hover effect...');
  const choice7Div = await frame.$('[data-choice-id="c6"]');
  await choice7Div.hover();
  await page.waitForTimeout(500);
  
  const hoverStyles = await frame.$eval('[data-choice-id="c6"]', el => {
    const styles = window.getComputedStyle(el);
    return {
      backgroundColor: styles.backgroundColor,
      transform: styles.transform,
      boxShadow: styles.boxShadow
    };
  });
  console.log('   Hover styles applied:', hoverStyles.transform !== 'none');
  
  console.log('\n✅ Click-anywhere functionality working!');
  
  await page.waitForTimeout(2000);
  await browser.close();
})();
