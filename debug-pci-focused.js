import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const page = await browser.newPage();
  
  // Navigate directly to the app (using the correct port)
  console.log('1. Navigating to app...');
  await page.goto('http://localhost:5175/');
  await page.waitForLoadState('networkidle');
  
  // Since we reordered items, strategy-runtime-mcq-test should load first automatically
  console.log('2. Waiting for strategy-runtime-mcq-test to load (should be first item)...');
  
  // Wait for the item to load
  console.log('3. Waiting for item to load...');
  await page.waitForTimeout(3000);
  
  // Check for iframe
  const iframe = await page.$('iframe');
  if (!iframe) {
    console.log('ERROR: No iframe found!');
    await browser.close();
    return;
  }
  
  console.log('4. Iframe found! Analyzing...');
  
  // Get iframe src
  const iframeSrc = await iframe.getAttribute('src');
  console.log('   Iframe src:', iframeSrc);
  
  // Get the frame object
  const frame = await iframe.contentFrame();
  if (!frame) {
    console.log('ERROR: Cannot access iframe content!');
    await browser.close();
    return;
  }
  
  // Check what's loaded in the iframe
  const iframeAnalysis = await frame.evaluate(() => {
    // Check for key objects
    const analysis = {
      url: window.location.href,
      hasRequireJS: typeof require !== 'undefined',
      hasDefine: typeof define !== 'undefined',
      hasQtiContext: typeof qtiCustomInteractionContext !== 'undefined',
      hasQtiAPI: typeof QTI_PCI_API !== 'undefined',
    };
    
    // If context exists, check what's registered
    if (typeof qtiCustomInteractionContext !== 'undefined') {
      analysis.registeredPCIs = Object.keys(qtiCustomInteractionContext.customInteractions || {});
      analysis.contextMethods = Object.keys(qtiCustomInteractionContext).filter(k => typeof qtiCustomInteractionContext[k] === 'function');
    }
    
    // Check DOM elements
    analysis.hasPciElement = !!document.getElementById('qti3-player-pci-element');
    analysis.hasMarkupDiv = !!document.querySelector('.qti-interaction-markup');
    
    // Check if our PCI content rendered
    analysis.hasChoiceInteraction = !!document.querySelector('.qti-choice-interaction');
    analysis.numberOfChoices = document.querySelectorAll('.qti-simple-choice').length;
    
    // Get the PCI element content
    const pciEl = document.getElementById('qti3-player-pci-element');
    if (pciEl) {
      analysis.pciElementHTML = pciEl.innerHTML.substring(0, 500);
    }
    
    return analysis;
  });
  
  console.log('\n5. IFRAME ANALYSIS RESULTS:');
  console.log('   URL:', iframeAnalysis.url);
  console.log('   Has RequireJS:', iframeAnalysis.hasRequireJS);
  console.log('   Has Define:', iframeAnalysis.hasDefine);
  console.log('   Has QTI Context:', iframeAnalysis.hasQtiContext);
  console.log('   Has QTI API:', iframeAnalysis.hasQtiAPI);
  console.log('   Registered PCIs:', iframeAnalysis.registeredPCIs);
  console.log('   Has PCI Element:', iframeAnalysis.hasPciElement);
  console.log('   Has Markup Div:', iframeAnalysis.hasMarkupDiv);
  console.log('   Has Choice Interaction:', iframeAnalysis.hasChoiceInteraction);
  console.log('   Number of Choices:', iframeAnalysis.numberOfChoices);
  console.log('   PCI Element Content:', iframeAnalysis.pciElementHTML);
  
  // Check console logs in iframe
  console.log('\n6. Checking for console messages in iframe...');
  
  // Inject console interceptor
  await frame.evaluate(() => {
    window.capturedLogs = [];
    const originalLog = console.log;
    console.log = function(...args) {
      window.capturedLogs.push(args.join(' '));
      originalLog.apply(console, args);
    };
  });
  
  // Trigger any pending operations
  await page.waitForTimeout(1000);
  
  // Get captured logs
  const logs = await frame.evaluate(() => window.capturedLogs || []);
  console.log('   Captured logs:', logs.length > 0 ? logs : 'No logs captured');
  
  // Check network requests for our PCI files
  console.log('\n7. Checking network requests...');
  const requests = [];
  page.on('request', request => {
    if (request.url().includes('strategy-runtime')) {
      requests.push(request.url());
    }
  });
  
  // Reload the iframe to capture requests
  await page.reload();
  await page.waitForTimeout(2000);
  
  console.log('   Strategy-runtime requests:', requests);
  
  // Take screenshot
  await page.screenshot({ path: 'pci-debug-screenshot.png', fullPage: true });
  console.log('\n8. Screenshot saved as pci-debug-screenshot.png');
  
  console.log('\n9. SUMMARY:');
  if (iframeAnalysis.hasQtiContext && iframeAnalysis.registeredPCIs && iframeAnalysis.registeredPCIs.length > 0) {
    console.log('   ✓ PCI Context loaded and PCI registered');
  } else {
    console.log('   ✗ PCI Context or registration issue');
  }
  
  if (iframeAnalysis.hasChoiceInteraction && iframeAnalysis.numberOfChoices > 0) {
    console.log('   ✓ MCQ UI rendered with', iframeAnalysis.numberOfChoices, 'choices');
  } else {
    console.log('   ✗ MCQ UI not rendered');
  }
  
  console.log('\nBrowser will remain open. Press Ctrl+C to exit.');
  
  // Keep browser open
  await new Promise(() => {});
})();
