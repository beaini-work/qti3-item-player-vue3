# PCI Strategy Runtime - Minimal POC

## What This Demonstrates

A **single PCI runtime** that renders interactions based on **JSON configuration** instead of hardcoded XML. This allows LLMs to generate simple JSON instead of complex QTI XML.

## Files Created (Minimal Set)

```
strategy-runtime/
├── README.md                           # This file
├── strategy-runtime-mcq-test.xml       # Static QTI item shell
└── modules/
    ├── module_resolution.js            # Module path mappings  
    ├── pci-runtime.js                  # Main PCI dispatcher
    ├── config-mcq-test.js              # JSON config as AMD module
    └── strategies/
        ├── strategy-mcq.js             # MCQ strategy implementation
        └── strategy-styles.css         # Basic styling
```

## How It Works

1. **Static XML** (`strategy-runtime-mcq-test.xml`):
   - Never changes regardless of content
   - Points to config module via `primary-configuration`
   - Response is always `single/string` containing JSON

2. **Config Module** (`config-mcq-test.js`):
   - AMD module that returns JSON configuration
   - Specifies which strategy to use (`"mcq"`)
   - Contains all question content as `props`

3. **Runtime** (`pci-runtime.js`):
   - Reads configuration
   - Dynamically loads the specified strategy
   - Passes config to strategy

4. **Strategy** (`strategy-mcq.js`):
   - Renders UI based on config props
   - Handles user interaction
   - Returns JSON response

## Test It

1. Run `npm run dev`
2. Open browser to http://localhost:5173/
3. Click "strategy-runtime-mcq-test"
4. You'll see a multiple choice question about prime numbers
5. Select answers and see the JSON response in console

## The Key Insight

The XML stays **completely static**. Only the JSON changes. This means:
- LLMs only generate simple JSON
- No XML parsing/generation complexity
- Same runtime handles all interaction types
- Easy to validate and test

## Next Steps

Once this works, we can:
1. Add more strategies (text-entry, drag-drop, etc.)
2. Support external JSON files (not just AMD modules)  
3. Add inline JSON option for prototyping
4. Implement proper scoring/validation

But first, let's verify this minimal slice works correctly.
