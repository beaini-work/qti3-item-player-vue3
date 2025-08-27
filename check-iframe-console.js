import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable verbose console logging
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (text.includes('[PCI') || text.includes('[MCQ')) {
      console.log(`[PAGE ${type.toUpperCase()}]: ${text}`);
    }
  });
  
  page.on('pageerror', err => {
    console.log('[PAGE ERROR]:', err.message);
  });
  
  console.log('1. Navigating to app...');
  await page.goto('http://localhost:5175/');
  await page.waitForLoadState('networkidle');
  
  console.log('2. Waiting for PCI to load...');
  await page.waitForTimeout(3000);
  
  // Find the iframe
  const iframeHandle = await page.$('iframe');
  if (!iframeHandle) {
    console.log('ERROR: No iframe found');
    await browser.close();
    return;
  }
  
  console.log('3. Found iframe, getting content frame...');
  const frame = await iframeHandle.contentFrame();
  
  if (!frame) {
    console.log('ERROR: Cannot access iframe content');
    await browser.close();
    return;
  }
  
  // Listen to iframe console
  await frame.evaluate(() => {
    // Override console.log in the iframe
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = function(...args) {
      window.parent.postMessage({ 
        type: 'iframe-log', 
        message: args.map(a => String(a)).join(' ') 
      }, '*');
      originalLog.apply(console, args);
    };
    
    console.error = function(...args) {
      window.parent.postMessage({ 
        type: 'iframe-error', 
        message: args.map(a => String(a)).join(' ') 
      }, '*');
      originalError.apply(console, args);
    };
  });
  
  // Listen for iframe messages in parent
  await page.evaluate(() => {
    window.addEventListener('message', (e) => {
      if (e.data.type === 'iframe-log') {
        console.log('[IFRAME LOG]:', e.data.message);
      } else if (e.data.type === 'iframe-error') {
        console.error('[IFRAME ERROR]:', e.data.message);
      }
    });
  });
  
  console.log('4. Checking iframe state...');
  
  const iframeState = await frame.evaluate(() => {
    const state = {
      hasContext: typeof qtiCustomInteractionContext !== 'undefined',
      hasAPI: typeof QTI_PCI_API !== 'undefined',
      registeredPCIs: [],
      pciElement: null,
      markupContent: null
    };
    
    if (typeof qtiCustomInteractionContext !== 'undefined') {
      state.registeredPCIs = Object.keys(qtiCustomInteractionContext.customInteractions || {});
    }
    
    const pciEl = document.getElementById('qti3-player-pci-element');
    if (pciEl) {
      state.pciElement = pciEl.innerHTML.substring(0, 200);
    }
    
    const markup = document.querySelector('.qti-interaction-markup');
    if (markup) {
      state.markupContent = markup.innerHTML.substring(0, 200);
    }
    
    // Try to manually trigger the PCI if it exists
    if (typeof qtiCustomInteractionContext !== 'undefined' && state.registeredPCIs.length > 0) {
      console.log('[Manual Check] Found registered PCIs:', state.registeredPCIs);
      const pciName = state.registeredPCIs[0];
      const pci = qtiCustomInteractionContext.customInteractions[pciName];
      console.log('[Manual Check] PCI object:', typeof pci, pci ? Object.keys(pci) : 'null');
    }
    
    return state;
  });
  
  console.log('5. Iframe state:');
  console.log('   Has Context:', iframeState.hasContext);
  console.log('   Has API:', iframeState.hasAPI);
  console.log('   Registered PCIs:', iframeState.registeredPCIs);
  console.log('   PCI Element:', iframeState.pciElement);
  console.log('   Markup Content:', iframeState.markupContent);
  
  // Wait a bit more to capture any async logs
  await page.waitForTimeout(2000);
  
  console.log('\n6. Test complete. Browser will remain open. Press Ctrl+C to exit.');
  
  // Keep browser open
  await new Promise(() => {});
})();
