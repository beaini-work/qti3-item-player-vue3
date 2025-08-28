/**
 * MCQ (Multiple Choice Question) Strategy
 * Supports both single and multiple selection modes
 * 
 * IMPORTANT: AMD Module Structure
 * ================================
 * In AMD/RequireJS modules, code after a return statement is unreachable.
 * Always define your functions, constructors, and prototypes BEFORE the return statement.
 * 
 * Correct order:
 * 1. Define constructor functions
 * 2. Define prototypes
 * 3. Return the module interface
 * 
 * DO NOT put function definitions after the return statement!
 */
define([], function() {
  'use strict';

  // 1. Define the constructor FIRST (before any return statements)
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

  // 2. Define the prototype methods (still before the return statement)
  McqStrategy.prototype = {
    /**
     * Mount the strategy and create the UI
     */
    mount: function() {
      console.log('[MCQ Strategy] Mounting with props:', this.props);
      console.log('[MCQ Strategy] DOM element:', this.dom);
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
      console.log('[MCQ Strategy] Rendering, DOM before:', this.dom.innerHTML);
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
      // Add Check Answer button
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'qti-button-container';
      
      const checkButton = document.createElement('button');
      checkButton.className = 'qti-check-button';
      checkButton.textContent = 'Check Answer';
      checkButton.type = 'button';
      
      const self = this;
      checkButton.addEventListener('click', function() {
        self.showFeedback();
        // Notify parent about the check action
        if (self.config && self.config.oncheck) {
          self.config.oncheck(self.checkAnswer());
        }
      });
      
      buttonContainer.appendChild(checkButton);
      container.appendChild(buttonContainer);
      
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
      
      // Make the entire choice wrapper clickable
      wrapper.style.cursor = 'pointer';
      wrapper.addEventListener('click', function(e) {
        // If the click wasn't directly on the input or label, trigger the input
        if (!input.contains(e.target) && e.target !== input) {
          e.preventDefault();
          e.stopPropagation();
          input.click();
        }
      });
      
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
      
      // Clear any previous feedback when user changes answer
      this.clearFeedback();
      
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
     * Check if the current answer is correct
     * Returns: boolean
     */
    checkAnswer: function() {
      const correct = this.props.correct || [];
      const selected = Array.from(this.selectedChoices);
      
      // For single choice
      if (!this.isMultiple) {
        return selected.length === 1 && correct.includes(selected[0]);
      }
      
      // For multiple choice - must match exactly
      if (selected.length !== correct.length) {
        return false;
      }
      
      return selected.every(choice => correct.includes(choice)) &&
             correct.every(choice => selected.includes(choice));
    },
    
    /**
     * Show feedback for the current answer
     * Returns: boolean (true if correct)
     */
    showFeedback: function() {
      const isCorrect = this.checkAnswer();
      const feedbackDiv = this.dom.querySelector('.qti-feedback') || this.createFeedbackElement();
      
      if (isCorrect) {
        feedbackDiv.className = 'qti-feedback qti-feedback-correct';
        feedbackDiv.innerHTML = '<div class="feedback-icon">✓</div><div class="feedback-text">Correct! Well done.</div>';
      } else {
        const selected = Array.from(this.selectedChoices);
        const correct = this.props.correct || [];
        
        let feedbackText = 'Not quite right. ';
        if (selected.length === 0) {
          feedbackText += 'Please select an answer.';
        } else if (!this.isMultiple) {
          const correctChoice = this.props.choices.find(c => c.id === correct[0]);
          feedbackText += 'The correct answer is: ' + (correctChoice ? correctChoice.text : correct[0]) + '.';
        } else {
          const correctTexts = correct.map(id => {
            const choice = this.props.choices.find(c => c.id === id);
            return choice ? choice.text : id;
          });
          feedbackText += 'The correct answers are: ' + correctTexts.join(', ') + '.';
        }
        
        feedbackDiv.className = 'qti-feedback qti-feedback-incorrect';
        feedbackDiv.innerHTML = '<div class="feedback-icon">✗</div><div class="feedback-text">' + feedbackText + '</div>';
      }
      
      // Highlight correct and incorrect choices
      this.highlightChoices();
      
      // Trigger resize notification after feedback is displayed
      this.notifyResize();
      
      return isCorrect;
    },
    
    /**
     * Create feedback element if it doesn't exist
     */
    createFeedbackElement: function() {
      const feedbackDiv = document.createElement('div');
      feedbackDiv.className = 'qti-feedback';
      const container = this.dom.querySelector('.qti-choice-interaction');
      container.appendChild(feedbackDiv);
      return feedbackDiv;
    },
    
    /**
     * Clear feedback display
     */
    clearFeedback: function() {
      const feedbackDiv = this.dom.querySelector('.qti-feedback');
      if (feedbackDiv) {
        feedbackDiv.className = 'qti-feedback';
        feedbackDiv.innerHTML = '';
        
        // Trigger resize after clearing feedback
        this.notifyResize();
      }
      
      // Remove choice highlighting
      const choices = this.dom.querySelectorAll('.qti-simple-choice');
      choices.forEach(choice => {
        choice.classList.remove('choice-correct', 'choice-incorrect', 'choice-missed');
      });
    },
    
    /**
     * Highlight correct and incorrect choices
     */
    highlightChoices: function() {
      const correct = this.props.correct || [];
      const selected = Array.from(this.selectedChoices);
      
      const choices = this.dom.querySelectorAll('.qti-simple-choice');
      choices.forEach(choice => {
        const input = choice.querySelector('input');
        const choiceId = input.value;
        
        if (correct.includes(choiceId)) {
          if (selected.includes(choiceId)) {
            choice.classList.add('choice-correct');
          } else {
            choice.classList.add('choice-missed');
          }
        } else if (selected.includes(choiceId)) {
          choice.classList.add('choice-incorrect');
        }
      });
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
     * Notify parent about content resize
     * Framework-agnostic approach using multiple methods
     */
    notifyResize: function() {
      // Small delay to ensure DOM updates are complete
      setTimeout(() => {
        // Method 1: Dispatch custom event (framework-agnostic)
        const container = this.dom.querySelector('.qti-choice-interaction');
        if (container) {
          const height = container.scrollHeight;
          const event = new CustomEvent('strategy-content-resize', {
            bubbles: true,
            detail: { height: height + 40 } // Add buffer for margins
          });
          this.dom.dispatchEvent(event);
        }
        
        // Method 2: Trigger DOM mutation by changing a data attribute
        // This will trigger any MutationObserver watching the element
        this.dom.setAttribute('data-feedback-visible', 
          this.dom.querySelector('.qti-feedback:not(:empty)') ? 'true' : 'false');
        
        // Method 3: If there's a resize callback from the parent
        if (this.config && typeof this.config.onResize === 'function') {
          this.config.onResize(this.dom.scrollHeight);
        }
      }, 50);
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

  // 3. Return the module interface LAST (after all definitions)
  // WARNING: Any code after this return statement will NOT be executed!
  return {
    /**
     * Create a new MCQ strategy instance
     * This factory function can now safely reference McqStrategy because it was defined above
     */
    create: function(ctx) {
      return new McqStrategy(ctx);
    }
  };
  
  // ⚠️ NEVER PUT CODE HERE - IT WILL BE UNREACHABLE!
});
