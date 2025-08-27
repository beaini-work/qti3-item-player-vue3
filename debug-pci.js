import { chromium } from 'playwright';

(async () => {
  // Launch browser with devtools
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log(`[PAGE LOG]: ${msg.type()} - ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR]:`, err.message);
  });
  
  // Navigate to the app
  console.log('1. Navigating to app...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  
  // Wait for the page to load
  await page.waitForTimeout(1000);
  
  // Look for a dropdown or select element that might contain items
  console.log('2. Looking for item selector...');
  
  // Check if there's a select dropdown
  const selectExists = await page.locator('select').count();
  if (selectExists > 0) {
    console.log('   Found select dropdown, selecting strategy-runtime-mcq-test...');
    await page.selectOption('select', { label: 'strategy-runtime-mcq-test' });
  } else {
    console.log('   No select found, looking for other UI elements...');
    
    // Try to find any element with the text
    const elements = await page.locator('*:has-text("strategy-runtime-mcq-test")').all();
    console.log(`   Found ${elements.length} elements with text "strategy-runtime-mcq-test"`);
    
    if (elements.length > 0) {
      // Click the first one
      await elements[0].click();
    } else {
      // Navigate using Next button to item 6
      console.log('   Navigating to item 6 using Next button...');
      for (let i = 0; i < 5; i++) {
        const nextButton = await page.locator('button:has-text("Next")').first();
        if (await nextButton.count() > 0) {
          await nextButton.click();
          await page.waitForTimeout(500);
          console.log(`   Clicked Next (${i+1}/5)`);
        }
      }
    }
  }
  
  // Wait for iframe to load
  console.log('3. Waiting for PCI iframe...');
  await page.waitForTimeout(2000); // Give it time to load
  
  // Check if iframe exists
  const iframeElement = await page.$('iframe');
  if (iframeElement) {
    console.log('4. Iframe found! Getting frame...');
    const frame = await iframeElement.contentFrame();
    
    if (frame) {
      console.log('5. Checking iframe content...');
      
      // Evaluate in the iframe context
      const iframeData = await frame.evaluate(() => {
        return {
          url: window.location.href,
          hasRequireJS: typeof require !== 'undefined',
          hasDefine: typeof define !== 'undefined',
          hasContext: typeof qtiCustomInteractionContext !== 'undefined',
          hasAPI: typeof QTI_PCI_API !== 'undefined',
          contextKeys: typeof qtiCustomInteractionContext !== 'undefined' 
            ? Object.keys(qtiCustomInteractionContext) 
            : [],
          customInteractions: typeof qtiCustomInteractionContext !== 'undefined' 
            ? Object.keys(qtiCustomInteractionContext.customInteractions || {})
            : [],
          bodyHTML: document.body ? document.body.innerHTML.substring(0, 200) : 'no body',
          scripts: Array.from(document.querySelectorAll('script')).map(s => s.src || 'inline'),
          pciElement: document.getElementById('qti3-player-pci-element')?.innerHTML || 'not found'
        };
      });
      
      console.log('6. Iframe analysis:');
      console.log('   URL:', iframeData.url);
      console.log('   Has RequireJS:', iframeData.hasRequireJS);
      console.log('   Has Define:', iframeData.hasDefine);
      console.log('   Has Context:', iframeData.hasContext);
      console.log('   Has API:', iframeData.hasAPI);
      console.log('   Context Keys:', iframeData.contextKeys);
      console.log('   Registered PCIs:', iframeData.customInteractions);
      console.log('   Scripts loaded:', iframeData.scripts);
      console.log('   PCI Element content:', iframeData.pciElement);
      
      // Try to get console logs from iframe
      const frameLogs = await frame.evaluate(() => {
        // Capture any logs that might be in the iframe
        const logs = [];
        const originalLog = console.log;
        console.log = function(...args) {
          logs.push(args.join(' '));
          originalLog.apply(console, args);
        };
        return logs;
      });
      
      console.log('7. Frame logs:', frameLogs);
      
      // Check parent window for PCI-related data
      const parentData = await page.evaluate(() => {
        const iframe = document.querySelector('iframe');
        return {
          iframeSrc: iframe ? iframe.src : 'no iframe',
          iframeId: iframe ? iframe.id : 'no id',
          networkRequests: performance.getEntriesByType('resource')
            .filter(r => r.name.includes('strategy-runtime'))
            .map(r => ({ name: r.name, status: r.responseStatus || 'unknown' }))
        };
      });
      
      console.log('8. Parent window data:');
      console.log('   Iframe src:', parentData.iframeSrc);
      console.log('   Iframe id:', parentData.iframeId);
      console.log('   Related network requests:', parentData.networkRequests);
      
      // Wait to see if anything renders
      await page.waitForTimeout(3000);
      
      // Take a screenshot for visual debugging
      await page.screenshot({ path: 'pci-debug.png', fullPage: true });
      console.log('9. Screenshot saved as pci-debug.png');
      
      // Check final state
      const finalCheck = await frame.evaluate(() => {
        const markup = document.querySelector('.qti-interaction-markup');
        const choices = document.querySelectorAll('.qti-choice-input');
        return {
          hasMarkup: !!markup,
          markupContent: markup ? markup.innerHTML.substring(0, 100) : 'none',
          choiceCount: choices.length
        };
      });
      
      console.log('10. Final rendering check:');
      console.log('    Has markup container:', finalCheck.hasMarkup);
      console.log('    Markup content:', finalCheck.markupContent);
      console.log('    Number of choices:', finalCheck.choiceCount);
      
    } else {
      console.log('ERROR: Could not access iframe content');
    }
  } else {
    console.log('ERROR: No iframe found on page');
  }
  
  // Keep browser open for manual inspection
  console.log('\nBrowser will stay open for manual inspection. Press Ctrl+C to close.');
  
})();
