# Developer Notes - PCI Strategy Runtime

## Critical AMD/RequireJS Module Pattern

### The Problem We Solved
The initial implementation had a subtle but critical bug where the strategy module returned before defining its constructor function:

```javascript
// WRONG - This will fail!
define([], function() {
  return {
    create: function(ctx) {
      return new MyConstructor(ctx); // MyConstructor is undefined!
    }
  };
  
  function MyConstructor(ctx) { // This never executes!
    // ...
  }
});
```

### The Solution
Always follow this pattern in AMD modules:

```javascript
// CORRECT - Define everything first, then return
define([], function() {
  // 1. Define constructors
  function MyConstructor(ctx) {
    // ...
  }
  
  // 2. Define prototypes
  MyConstructor.prototype = {
    // ...
  };
  
  // 3. Return module interface LAST
  return {
    create: function(ctx) {
      return new MyConstructor(ctx); // Now MyConstructor exists!
    }
  };
});
```

## Key Rules for AMD Modules

1. **Code after return is unreachable** - JavaScript stops executing at the return statement
2. **Define before referencing** - All functions must be defined before they are used in the return object
3. **Return last** - The module return statement should always be the last executable code

## Testing Your PCI Module

To verify your module loads correctly:

1. Check the browser console for errors like:
   - `Uncaught ReferenceError: [Constructor] is not defined`
   - `TypeError: [Constructor] is not a constructor`

2. Use the Playwright debug script:
   ```bash
   node check-iframe-console.js
   ```

3. Look for successful initialization logs:
   ```
   [PCI Strategy Runtime] Strategy instance created
   [MCQ Strategy] Mounting with props: {...}
   ```

## Module Structure Files

- `pci-runtime.js` - Main PCI dispatcher (follows correct pattern)
- `strategies/strategy-mcq.js` - MCQ implementation (follows correct pattern)
- `config-mcq-test.js` - Configuration module (simple object return)

Each file contains inline comments marking the critical ordering requirements.
