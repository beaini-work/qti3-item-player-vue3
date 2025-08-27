# Mini Tech Design — QTI 3 PCI “Strategy Runtime” with JSON-Driven Items

## Goal

Keep the **QTI 3 item XML** virtually static while a **single PCI JavaScript runtime** renders and handles logic. **Per-item JSON** selects a **strategy** (renderer/logic) and supplies props. This avoids LLMs generating XML; they only emit JSON (and optionally helper JS), and the PCI does everything else.

---

## High-Level Architecture

* **Static QTI 3 item “shell”**

  * One `<qti-portable-custom-interaction>` inside the item.
  * One `qti-response-declaration` (e.g., `identifier="RESPONSE"`, `cardinality="single"`, `base-type="string"`).
  * Optional outcome declaration (e.g., `SCORE`).
  * `<qti-interaction-modules>` references the PCI runtime (AMD).
  * `<qti-interaction-markup>` provides a root `<div>` and (optionally) the JSON.

* **PCI runtime (static JS, AMD) — “dispatcher”**

  * Registers with `qtiCustomInteractionContext`.
  * On `getInstance`, reads the spec (JSON), chooses a `strategy`, lazy-loads `modules/strategies/<strategy>.js`, and delegates.
  * Exposes required PCI methods:

    * `getResponse()` → returns a **JSON string** (to match `single/string`).
    * `getState()` / `checkValidity()`; calls `cfg.onready(...)`, optionally `cfg.ondone(...)`.

* **Strategies (modular JS)**

  * Each strategy exports `create(ctx)` and returns: `{ mount, getResponse, getState, checkValidity, dispose }`.
  * The runtime loads them on demand based on JSON: `{ "strategy": "<name>", "props": { ... } }`.

---

## Configuration Options (JSON Delivery)

We will use one of these—**no per-item JS changes**, XML stays fixed:

1. **Config JS module (via `primary-configuration`) — *recommended default***

   * `<qti-interaction-modules primary-configuration="modules/config.js">…`
   * The module returns the spec object.
   * **Pros:** Most compatible with restrictive players; no fetch() or inline scripts needed; allows computed defaults/shared constants while keeping the XML fixed.
   * **Trade-off:** Requires generating a simple JS module per item (but still easier than XML for LLMs).

2. **External JSON file (referenced via `data-*`) — *optimization if player supports***

   * Add `data-config-href="items/xyz.json"` to the PCI element.
   * Runtime `fetch()`es the JSON from the content package.
   * **Pros:** Pure JSON generation for LLMs; CSP/sanitizer friendly; keeps XML minimal.
   * **Watch-out:** Requires player to allow fetch() calls; adds network latency.

3. **Inline JSON (in `<qti-interaction-markup>`) — *rapid prototyping only***

   * A `<script type="application/json" id="pci-config">…</script>` block carries the spec.
   * **Pros:** Simplest for quick testing; self-contained items.
   * **Watch-out:** Many players sanitize or block inline `<script>` (even JSON type).

---

## JSON Shape (example)

```json
{
  "version": "1.0",
  "strategy": "mcq",
  "props": {
    "prompt": "Pick the prime numbers",
    "choices": [{"id":"c1","text":"2"}, {"id":"c2","text":"3"}, {"id":"c3","text":"4"}],
    "correct": ["c1","c2"],
    "multi": true
  },
  "ui": {"shuffle": true}
}
```

* `strategy` selects which module to load.
* `props` are passed to the strategy.
* `ui` is optional display/config.

---

## Response & Scoring

* **Response shape (uniform):** runtime always returns a **JSON string** via `getResponse()` to match `single/string`. No per-strategy changes to the item XML.
* **Scoring options:**

  * **External scoring:** omit `<qti-response-processing>` and score outside the engine.
  * **Static RP template:** reference a fixed template (e.g., standard mapping) so the XML remains unchanged across items/strategies.

---

## Implementation Strategy

### Phase 1: Config JS Module (Maximum Compatibility)
* Start with config JS modules for all items
* Runtime loads config via `primary-configuration`
* Test across all target players to establish baseline compatibility

### Phase 2: Progressive Enhancement
* Add runtime detection for fetch() support
* If available, check for `data-config-href` attribute
* Fall back to config JS module if fetch() fails or is unavailable

### Phase 3: Optimization
* For players with confirmed fetch() support, migrate to pure JSON files
* Keep config JS modules as fallback for restrictive environments
* Maintain both paths in the runtime for maximum flexibility

---

## Packaging Notes

* Place the item XML, `modules/` JS (runtime + strategies), and any JSON files together in the **content package** and include them in `imsmanifest.xml`.
* If using **external JSON**, ensure it’s package-local and fetchable by the player.

---

## Recommendation

* Use **Config JS Module (Option 1)** as the default for maximum compatibility across players.
* Optimize to **External JSON (Option 2)** after confirming player supports fetch() and has acceptable network latency.
* Reserve **Inline JSON (Option 3)** for rapid prototyping/testing only.
* Keep the **strategy pattern**: JSON/config chooses the strategy; runtime lazy-loads and delegates; item XML and runtime JS remain constant.
* Consider implementing a **fallback chain**: Try primary-configuration → external JSON → inline JSON to maximize compatibility.

---

## Known Caveats

* **CSP/Sanitizers**: Inline `<script type="application/json">` may be stripped in some players.
* **Dynamic Loading**: Not all players support dynamic module loading via `import()` - test strategy lazy-loading early.
* **Config JS Generation**: While simpler than XML, LLMs still need to generate valid JS module syntax:
  ```javascript
  // Example: modules/config.js
  define([], function() {
    return {
      version: "1.0",
      strategy: "mcq",
      props: {
        prompt: "Pick the prime numbers",
        choices: [
          {id: "c1", text: "2"},
          {id: "c2", text: "3"},
          {id: "c3", text: "4"}
        ],
        correct: ["c1", "c2"],
        multi: true
      }
    };
  });
  ```
* **Runtime Fallback Example**:
  ```javascript
  // In PCI runtime
  async function loadConfig(element, primaryConfig) {
    // 1. Try external JSON if supported
    const configHref = element.getAttribute('data-config-href');
    if (configHref && typeof fetch !== 'undefined') {
      try {
        const response = await fetch(configHref);
        if (response.ok) return await response.json();
      } catch (e) {
        console.warn('Failed to fetch external config, falling back');
      }
    }
    
    // 2. Use primary configuration module
    if (primaryConfig) return primaryConfig;
    
    // 3. Last resort: check inline JSON
    const inlineScript = element.querySelector('script[type="application/json"]');
    if (inlineScript) {
      try {
        return JSON.parse(inlineScript.textContent);
      } catch (e) {
        console.warn('Failed to parse inline config');
      }
    }
    
    throw new Error('No configuration found');
  }
  ```
