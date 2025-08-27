/**
 * PCI Strategy Runtime Dispatcher
 * This is the main PCI module that reads JSON configuration and dynamically loads strategies
 */
define(['qtiCustomInteractionContext'], function(qtiCustomInteractionContext) {
  'use strict';

  // Strategy cache to avoid reloading
  const loadedStrategies = {};

  const PciStrategyRuntime = {
    typeIdentifier: 'strategy-runtime',
    
    /**
     * Register the PCI with the interaction context
     */
    initialize: function() {
      qtiCustomInteractionContext.register(this);
    },

    /**
     * Get an instance of this PCI
     */
    getInstance: function(dom, config, state) {
      const instance = new PciStrategyRuntimeInstance(dom, config, state);
      
      // Initialize and notify when ready
      instance.initialize().then(() => {
        config.onready(instance, state);
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
        
        // Create strategy instance
        const ctx = {
          dom: this.dom.querySelector('.qti-interaction-markup') || this.dom,
          config: this.config,
          spec: this.spec,
          state: this.state
        };
        
        this.strategyInstance = strategyModule.create(ctx);
        
        // Mount the strategy
        if (this.strategyInstance && this.strategyInstance.mount) {
          this.strategyInstance.mount();
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

      // 1. Try primary configuration module (if provided)
      if (this.config.primaryConfiguration) {
        config = this.config.primaryConfiguration;
        console.log('[PCI Strategy Runtime] Using primary configuration module');
        return config;
      }

      // 2. Try external JSON file (if data-config-href is present)
      const configHref = this.dom.getAttribute('data-config-href');
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

      // 3. Try inline JSON (last resort)
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
     * Clean up when the interaction is destroyed
     */
    oncompleted: function() {
      if (this.strategyInstance && this.strategyInstance.dispose) {
        this.strategyInstance.dispose();
      }
    }
  };

  // Initialize and register the PCI
  PciStrategyRuntime.initialize();

  return PciStrategyRuntime;
});
