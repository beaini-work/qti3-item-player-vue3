/**
 * MCQ (Multiple Choice Question) Strategy
 * Supports both single and multiple selection modes
 */
define([], function() {
  'use strict';

  return {
    /**
     * Create a new MCQ strategy instance
     */
    create: function(ctx) {
      return new McqStrategy(ctx);
    }
  };

  function McqStrategy(ctx) {
    this.dom = ctx.dom;
    this.config = ctx.config;
    this.spec = ctx.spec;
    this.state = ctx.state;
    this.props = (this.spec && this.spec.props) || {};
    this.ui = (this.spec && this.spec.ui) || {};
    this.selectedChoices = new Set();
    this.isMultiple = this.props.multi || false;
  }

  McqStrategy.prototype = {
    /**
     * Mount the strategy and create the UI
     */
    mount: function() {
      this.injectStyles();
      this.render();
      this.attachEventListeners();
      
      // Restore state if provided
      if (this.state) {
        this.setState(this.state);
      }
    },

    /**
     * Inject strategy styles if not already present
     */
    injectStyles: function() {
      const styleId = 'qti-strategy-styles';
      if (!document.getElementById(styleId)) {
        const link = document.createElement('link');
        link.id = styleId;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = '/qti-items/strategy-runtime/modules/strategies/strategy-styles.css';
        document.head.appendChild(link);
      }
    },

    /**
     * Render the MCQ interface
     */
    render: function() {
      // Clear existing content
      this.dom.innerHTML = '';
      
      // Create container
      const container = document.createElement('div');
      container.className = 'qti-choice-interaction';
      
      // Add prompt if provided
      if (this.props.prompt) {
        const prompt = document.createElement('div');
        prompt.className = 'qti-prompt';
        prompt.innerHTML = this.props.prompt;
        container.appendChild(prompt);
      }
      
      // Create choice list
      const choiceList = document.createElement('div');
      choiceList.className = 'qti-choice-list';
      
      // Get choices (shuffle if requested)
      let choices = this.props.choices || [];
      if (this.ui.shuffle) {
        choices = this.shuffleArray([...choices]);
      }
      
      // Render each choice
      choices.forEach((choice, index) => {
        const choiceElement = this.createChoiceElement(choice, index);
        choiceList.appendChild(choiceElement);
      });
      
      container.appendChild(choiceList);
      this.dom.appendChild(container);
      
      // Store reference to choice list
      this.choiceList = choiceList;
    },

    /**
     * Create a choice element
     */
    createChoiceElement: function(choice, index) {
      const wrapper = document.createElement('div');
      wrapper.className = 'qti-simple-choice';
      wrapper.setAttribute('data-choice-id', choice.id);
      
      const label = document.createElement('label');
      label.className = 'qti-choice-label';
      
      const input = document.createElement('input');
      input.type = this.isMultiple ? 'checkbox' : 'radio';
      input.name = 'mcq-choice';
      input.value = choice.id;
      input.id = 'choice-' + choice.id;
      input.className = 'qti-choice-input';
      
      const content = document.createElement('span');
      content.className = 'qti-choice-content';
      content.innerHTML = choice.text || choice.label || '';
      
      // Add image if provided
      if (choice.image) {
        const img = document.createElement('img');
        img.src = choice.image;
        img.className = 'qti-choice-image';
        content.appendChild(img);
      }
      
      label.appendChild(input);
      label.appendChild(content);
      wrapper.appendChild(label);
      
      return wrapper;
    },

    /**
     * Shuffle an array (Fisher-Yates algorithm)
     */
    shuffleArray: function(array) {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    },

    /**
     * Attach event listeners
     */
    attachEventListeners: function() {
      if (!this.choiceList) return;
      
      const self = this;
      const inputs = this.choiceList.querySelectorAll('input[type="checkbox"], input[type="radio"]');
      
      inputs.forEach(function(input) {
        input.addEventListener('change', function(e) {
          self.handleChoiceChange(e);
        });
      });
    },

    /**
     * Handle choice selection change
     */
    handleChoiceChange: function(event) {
      const input = event.target;
      const choiceId = input.value;
      
      if (this.isMultiple) {
        // Multiple selection mode
        if (input.checked) {
          this.selectedChoices.add(choiceId);
        } else {
          this.selectedChoices.delete(choiceId);
        }
      } else {
        // Single selection mode
        this.selectedChoices.clear();
        if (input.checked) {
          this.selectedChoices.add(choiceId);
        }
      }
      
      // Fire interaction changed event
      this.fireInteractionChanged();
    },

    /**
     * Fire qti-interaction-changed event
     */
    fireInteractionChanged: function() {
      const event = new CustomEvent('qti-interaction-changed', {
        detail: {
          interaction: this,
          responseIdentifier: this.config.responseIdentifier,
          valid: this.checkValidity(),
          value: this.getResponse()
        },
        bubbles: true,
        cancelable: true
      });
      
      this.dom.dispatchEvent(event);
    },

    /**
     * Get the response value
     */
    getResponse: function() {
      const selected = Array.from(this.selectedChoices);
      
      // Return format based on cardinality
      if (this.isMultiple) {
        return {
          type: 'multiple',
          choices: selected
        };
      } else {
        return {
          type: 'single',
          choice: selected.length > 0 ? selected[0] : null
        };
      }
    },

    /**
     * Get the interaction state
     */
    getState: function() {
      return {
        selectedChoices: Array.from(this.selectedChoices),
        isMultiple: this.isMultiple
      };
    },

    /**
     * Set the interaction state
     */
    setState: function(state) {
      if (!state) return;
      
      // Clear current selections
      this.selectedChoices.clear();
      
      // Restore selections
      if (state.selectedChoices && Array.isArray(state.selectedChoices)) {
        state.selectedChoices.forEach(id => this.selectedChoices.add(id));
      }
      
      // Update UI
      this.updateUI();
    },

    /**
     * Update UI based on current state
     */
    updateUI: function() {
      if (!this.choiceList) return;
      
      const inputs = this.choiceList.querySelectorAll('input[type="checkbox"], input[type="radio"]');
      inputs.forEach(input => {
        input.checked = this.selectedChoices.has(input.value);
      });
    },

    /**
     * Check validity of the response
     */
    checkValidity: function() {
      // Valid if at least one choice is selected
      return this.selectedChoices.size > 0;
    },

    /**
     * Get custom validity message
     */
    getCustomValidity: function() {
      if (this.selectedChoices.size === 0) {
        return 'Please select at least one option';
      }
      return '';
    },

    /**
     * Handle rendering properties changes
     */
    setRenderingProperties: function(properties) {
      // Could handle accessibility settings, display preferences, etc.
      console.log('[MCQ Strategy] Rendering properties updated:', properties);
    },

    /**
     * Clean up
     */
    dispose: function() {
      // Remove event listeners
      if (this.choiceList) {
        const inputs = this.choiceList.querySelectorAll('input[type="checkbox"], input[type="radio"]');
        inputs.forEach(input => {
          input.removeEventListener('change', this.handleChoiceChange);
        });
      }
      
      // Clear DOM
      if (this.dom) {
        this.dom.innerHTML = '';
      }
      
      // Clear references
      this.choiceList = null;
      this.selectedChoices.clear();
    }
  };
});
