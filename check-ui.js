import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Navigating to app...');
  await page.goto('http://localhost:5175/');
  await page.waitForTimeout(3000);
  
  // Check iframe content
  const iframe = await page.$('iframe');
  if (iframe) {
    const frame = await iframe.contentFrame();
    
    // Check what's in the DOM
    const choices = await frame.$$eval('.qti-simple-choice', elements => 
      elements.map(el => ({
        text: el.textContent.trim(),
        visible: el.offsetHeight > 0
      }))
    );
    
    console.log('\n=== CHOICES FOUND ===');
    console.log('Total choices:', choices.length);
    choices.forEach((choice, i) => {
      console.log(`Choice ${i+1}: "${choice.text}" - Visible: ${choice.visible}`);
    });
    
    // Check iframe dimensions
    const iframeDimensions = await iframe.boundingBox();
    console.log('\n=== IFRAME DIMENSIONS ===');
    console.log('Width:', iframeDimensions?.width);
    console.log('Height:', iframeDimensions?.height);
    
    // Check container dimensions
    const containerHeight = await frame.$eval('.qti-choice-interaction', el => el.offsetHeight);
    console.log('\n=== CONTAINER HEIGHT ===');
    console.log('Container height:', containerHeight, 'px');
  }
  
  await page.waitForTimeout(2000);
  await browser.close();
})();
