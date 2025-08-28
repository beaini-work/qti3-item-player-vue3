/**
 * PCI Strategy Runtime Dispatcher
 * This is the main PCI module that reads JSON configuration and dynamically loads strategies
 * 
 * CORE DESIGN PRINCIPLE: FRAMEWORK AGNOSTICISM
 * =============================================
 * This PCI runtime MUST remain independent of any specific rendering framework.
 * It should work equally well in:
 * - QTI 3.0 players
 * - Custom assessment platforms
 * - Standalone web applications
 * - Any future rendering environment
 * 
 * Framework Independence Rules:
 * 1. Use standard Web APIs only (DOM, CustomEvent, etc.)
 * 2. Never hardcode framework-specific message formats
 * 3. Provide multiple integration patterns for flexibility
 * 4. Avoid assumptions about the hosting environment
 * 5. Make framework-specific features optional/pluggable
 * 
 * Integration Approaches (in order of preference):
 * - Standard DOM manipulation (works with any observer)
 * - Custom DOM events (framework-neutral communication)
 * - Callback injection (frameworks provide handlers)
 * - Generic messaging (adaptable by any framework)
 * 
 * MODULE STRUCTURE PATTERN:
 * ========================
 * This AMD module follows the pattern:
 * 1. Define all functions and objects
 * 2. Initialize/register components
 * 3. Return the module exports
 * 
 * CRITICAL: Never put executable code after a return statement in AMD modules!
 */
define(['qtiCustomInteractionContext'], function(qtiCustomInteractionContext) {
  'use strict';

  // Note: qtiCustomInteractionContext is the ONLY framework-specific dependency,
  // and it's injected by the host environment. The runtime adapts to whatever
  // context is provided, making it portable across different QTI implementations.
  
  // Strategy cache to avoid reloading
  const loadedStrategies = {};

  // Define the main PCI object
  const PciStrategyRuntime = {
    typeIdentifier: 'strategy-runtime',
    
    /**
     * Register the PCI with the interaction context
     */
    initialize: function() {
      console.log('[PCI Strategy Runtime] Registering with context');
      qtiCustomInteractionContext.register(this);
    },

    /**
     * Get an instance of this PCI
     */
    getInstance: function(dom, config, state) {
      console.log('[PCI Strategy Runtime] getInstance called', {dom, config, state});
      const instance = new PciStrategyRuntimeInstance(dom, config, state);
      
      // Initialize and notify when ready
      instance.initialize().then(() => {
        console.log('[PCI Strategy Runtime] Initialization complete');
        config.onready(instance, state);
        
        // Notify about content size after rendering
        // This is framework-agnostic - we just ensure our DOM element has the right size
        setTimeout(() => {
          instance.notifyContentResize();
        }, 200);
      }).catch((err) => {
        console.error('[PCI Strategy Runtime] Initialization failed:', err);
        // Still notify ready even on error to prevent hanging
        config.onready(instance, state);
      });
      
      return instance;
    }
  };

  /**
   * PCI Strategy Runtime Instance
   * Constructor function defined BEFORE being referenced in getInstance above
   */
  function PciStrategyRuntimeInstance(dom, config, state) {
    this.typeIdentifier = 'strategy-runtime';
    this.dom = dom;
    this.config = config;
    this.state = state;
    this.strategy = null;
    this.strategyInstance = null;
    this.spec = null;
  }

  PciStrategyRuntimeInstance.prototype = {
    /**
     * Initialize the PCI instance
     */
    initialize: async function() {
      try {
        // Load the configuration
        this.spec = await this.loadConfiguration();
        
        if (!this.spec || !this.spec.strategy) {
          throw new Error('Invalid configuration: missing strategy');
        }

        console.log('[PCI Strategy Runtime] Loading strategy:', this.spec.strategy);

        // Load the strategy module
        const strategyModule = await this.loadStrategy(this.spec.strategy);
        console.log('[PCI Strategy Runtime] Strategy module loaded:', strategyModule);
        
        // Create strategy instance
        const ctx = {
          dom: this.dom.querySelector('.qti-interaction-markup') || this.dom,
          config: this.config,
          spec: this.spec,
          state: this.state
        };
        
        console.log('[PCI Strategy Runtime] Creating strategy instance with context:', ctx);
        this.strategyInstance = strategyModule.create(ctx);
        console.log('[PCI Strategy Runtime] Strategy instance created:', this.strategyInstance);
        
        // Mount the strategy
        if (this.strategyInstance && this.strategyInstance.mount) {
          console.log('[PCI Strategy Runtime] Calling mount on strategy');
          this.strategyInstance.mount();
        } else {
          console.log('[PCI Strategy Runtime] ERROR: Strategy has no mount method!');
        }
        
        // If there's a state to restore, do it
        if (this.state && this.strategyInstance && this.strategyInstance.setState) {
          this.strategyInstance.setState(this.state);
        }
        
      } catch (err) {
        console.error('[PCI Strategy Runtime] Failed to initialize:', err);
        throw err;
      }
    },

    /**
     * Load configuration from various sources (fallback chain)
     */
    loadConfiguration: async function() {
      let config = null;
      console.log('[PCI Strategy Runtime] Loading configuration, config object:', this.config);
      console.log('[PCI Strategy Runtime] Config properties:', this.config.properties);

      // 1. Try primary configuration module (if provided)
      if (this.config.primaryConfiguration) {
        config = this.config.primaryConfiguration;
        console.log('[PCI Strategy Runtime] Using primary configuration module');
        return config;
      }

      // 2. Try external JSON file via properties (data-config-href on PCI element)
      // The property name will be 'configHref' (camelCase conversion from data-config-href)
      const configHref = this.config && this.config.properties && this.config.properties.configHref;
      console.log('[PCI Strategy Runtime] Looking for configHref:', configHref);
      if (configHref && typeof fetch !== 'undefined') {
        try {
          const response = await fetch(configHref);
          if (response.ok) {
            config = await response.json();
            console.log('[PCI Strategy Runtime] Loaded external JSON config');
            return config;
          }
        } catch (e) {
          console.warn('[PCI Strategy Runtime] Failed to fetch external config:', e);
        }
      }

      // 3. Try inline JSON (last resort) — if strategy runtime markup embeds it
      const inlineScript = this.dom.querySelector('script[type="application/json"]');
      if (inlineScript) {
        try {
          config = JSON.parse(inlineScript.textContent);
          console.log('[PCI Strategy Runtime] Using inline JSON config');
          return config;
        } catch (e) {
          console.warn('[PCI Strategy Runtime] Failed to parse inline config:', e);
        }
      }

      // 4. Fallback to properties (convert data attributes to config)
      if (this.config.properties) {
        config = {
          strategy: this.config.properties.strategy || 'text-entry',
          props: {}
        };
        
        // Copy all properties except 'strategy' into props
        for (const key in this.config.properties) {
          if (key !== 'strategy') {
            config.props[key] = this.config.properties[key];
          }
        }
        
        console.log('[PCI Strategy Runtime] Using properties as config');
        return config;
      }

      throw new Error('No configuration found');
    },

    /**
     * Load a strategy module dynamically
     */
    loadStrategy: async function(strategyName) {
      // Check cache first
      if (loadedStrategies[strategyName]) {
        return loadedStrategies[strategyName];
      }

      return new Promise((resolve, reject) => {
        // Build the strategy module path
        // Strategies are expected to be in modules/strategies/{strategy-name}.js
        const strategyPath = 'strategy-' + strategyName;
        
        // Use RequireJS to load the strategy module
        require([strategyPath], function(strategyModule) {
          console.log('[PCI Strategy Runtime] Strategy loaded:', strategyName);
          loadedStrategies[strategyName] = strategyModule;
          resolve(strategyModule);
        }, function(err) {
          console.error('[PCI Strategy Runtime] Failed to load strategy:', strategyName, err);
          reject(err);
        });
      });
    },

    /**
     * Get the response value
     */
    getResponse: function() {
      if (this.strategyInstance && this.strategyInstance.getResponse) {
        const response = this.strategyInstance.getResponse();
        // Always return as JSON string for single/string base type
        return typeof response === 'string' ? response : JSON.stringify(response);
      }
      return null;
    },

    /**
     * Get the interaction state
     */
    getState: function() {
      if (this.strategyInstance && this.strategyInstance.getState) {
        return this.strategyInstance.getState();
      }
      return null;
    },

    /**
     * Set the interaction state
     */
    setState: function(state) {
      if (this.strategyInstance && this.strategyInstance.setState) {
        this.strategyInstance.setState(state);
      }
    },

    /**
     * Check validity of the response
     */
    checkValidity: function() {
      if (this.strategyInstance && this.strategyInstance.checkValidity) {
        return this.strategyInstance.checkValidity();
      }
      // Default to true if not implemented
      return true;
    },

    /**
     * Get custom validity message
     */
    getCustomValidity: function() {
      if (this.strategyInstance && this.strategyInstance.getCustomValidity) {
        return this.strategyInstance.getCustomValidity();
      }
      return '';
    },

    /**
     * Handle rendering properties changes (PNP, lifecycle status, etc.)
     */
    setRenderingProperties: function(properties) {
      if (this.strategyInstance && this.strategyInstance.setRenderingProperties) {
        this.strategyInstance.setRenderingProperties(properties);
      }
    },
    
    /**
     * Notify about content resize
     * 
     * FRAMEWORK AGNOSTIC DESIGN:
     * This method demonstrates the core principle of framework independence.
     * It provides multiple ways for ANY framework to handle resize, without
     * being coupled to any specific implementation.
     * 
     * The method is intentionally designed with multiple fallback approaches
     * to ensure compatibility with diverse rendering environments while
     * maintaining zero hard dependencies on any particular framework.
     */
    notifyContentResize: function() {
      if (!this.dom) return;
      
      // Calculate the actual content dimensions
      const container = this.dom.querySelector('.qti-choice-interaction') || this.dom;
      const height = Math.max(
        container.offsetHeight,
        container.scrollHeight,
        container.getBoundingClientRect().height
      );
      const width = Math.max(
        container.offsetWidth,
        container.scrollWidth,
        container.getBoundingClientRect().width
      );
      
      // Add a small buffer for padding/margins
      const adjustedHeight = height + 20;
      
      console.log('[PCI Strategy Runtime] Content requires size:', { width, height: adjustedHeight });
      
      // APPROACH 1: Standard DOM sizing (framework-agnostic)
      // Any resize observer will detect these changes
      this.dom.style.minHeight = adjustedHeight + 'px';
      this.dom.style.height = adjustedHeight + 'px';
      
      // APPROACH 2: Custom event (framework-agnostic)
      // Frameworks can listen for this standard DOM event
      this.dom.dispatchEvent(new CustomEvent('pci-content-resize', {
        bubbles: true,
        detail: { width, height: adjustedHeight }
      }));
      
      // APPROACH 3: Callback pattern (framework can inject resize handler)
      // This allows frameworks to provide their own resize handling
      if (this.config && typeof this.config.onContentResize === 'function') {
        this.config.onContentResize(width, adjustedHeight);
      }
      
      // FALLBACK: If we detect we're in an iframe, notify parent
      // This is only used as a last resort for compatibility
      if (window.parent && window.parent !== window) {
        try {
          // Use a generic message format that frameworks can adapt
          window.parent.postMessage({
            type: 'resize',
            source: 'pci-strategy-runtime',
            dimensions: { width, height: adjustedHeight }
          }, '*');
        } catch (e) {
          // Silently fail if postMessage is blocked
        }
      }
    },

    /**
     * Clean up when the interaction is destroyed
     */
    oncompleted: function() {
      if (this.strategyInstance && this.strategyInstance.dispose) {
        this.strategyInstance.dispose();
      }
    }
  };

  // Initialize and register the PCI (before returning)
  PciStrategyRuntime.initialize();

  // Return the module - this MUST be the last executable statement
  // Anything after this return will not be executed
  return PciStrategyRuntime;
  
  // ⚠️ DO NOT ADD CODE HERE - IT WILL NEVER RUN!
});
