<template>
  <div class="qti-app-container">
    <!-- Enhanced Navigation Bar -->
    <div class="navigation-bar">
      <div class="nav-section nav-left">
        <button 
          ref="btnPrev" 
          type="button" 
          @click="handlePrevItem" 
          :disabled="isPrevDisabled || isNavigating"
          class="btn btn-primary nav-btn"
          title="Previous Item (←)"
        >
          <span class="btn-icon">←</span>
          <span class="btn-text">Previous</span>
        </button>
      </div>
      
      <div class="nav-section nav-center">
        <!-- Progress Indicator -->
        <div class="progress-container">
          <span class="progress-text">Item {{ currentItem + 1 }} of {{ totalItems }}</span>
          <div class="progress-bar-wrapper">
            <div class="progress-bar" :style="{ width: progressPercentage + '%' }"></div>
          </div>
        </div>
        
        <!-- Item Selector Dropdown -->
        <select 
          v-model="currentItem" 
          @change="handleDirectNavigation"
          :disabled="isNavigating"
          class="item-selector"
        >
          <option v-for="(item, index) in itemConfigs" :key="index" :value="index">
            {{ index + 1 }}. {{ item.identifier }}
          </option>
        </select>
      </div>
      
      <div class="nav-section nav-right">
        <button 
          ref="btnNext" 
          type="button" 
          @click="handleNextItem" 
          :disabled="isNextDisabled || isNavigating"
          class="btn btn-primary nav-btn"
          title="Next Item (→)"
        >
          <span class="btn-text">Next</span>
          <span class="btn-icon">→</span>
        </button>
      </div>
    </div>
    
    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>Loading items...</p>
    </div>
    
    <!-- QTI Player -->
    <Qti3Player
      ref="qti3player"
      :container-class="containerClass"
      :color-class="colorClass"
      :container-padding-class="containerPaddingClass"
      suppress-alert-messages
      suppress-invalid-response-messages
      @notifyQti3PlayerReady="handlePlayerReady"
      @notifyQti3ItemReady="handleItemReady"
      @notifyQti3SuspendAttemptCompleted="handleSuspendAttemptCompleted"
      @notifyQti3EndAttemptCompleted="handleEndAttemptCompleted"
      @notifyQti3ScoreAttemptCompleted="handleScoreAttemptCompleted"
      @notifyQti3ItemAlertEvent="displayItemAlertEvent"
      @notifyQti3ItemCatalogEvent="handleItemCatalogEvent"
    />
    
    <!-- Item Status Bar -->
    <div class="status-bar">
      <div class="status-item">
        <span class="status-label">Status:</span>
        <span class="status-value" :class="statusClass">{{ itemStatus }}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Completed:</span>
        <span class="status-value">{{ completedItems }} / {{ totalItems }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import Qti3Player from '@/components/Qti3Player.vue'
import { PnpFactory } from '@/shared/helpers/PnpFactory'
import { SessionControlFactory } from '@/shared/helpers/SessionControlFactory'
import Swal from 'sweetalert2'
import axios from 'axios'

export default {
  name: 'App',

  components: {
    Qti3Player
  },

  data () {
    return {
      isTestStarted: false,
      currentItem: 0,
      isLoading: false,
      isNavigating: false,
      completedItems: 0,
      itemStatus: 'Not Started',
      itemConfigs: [
        {
          identifier: "q2-choice-interaction-single-cardinality",
          guid: "0000-0000-0002-choice",
          filePath: "qti-items/q2-choice-interaction-single-cardinality.xml"
        },
        {
          identifier: "measuringPh",
          guid: "0000-0000-0003-measuring-ph",
          filePath: "qti-items/measuringPh.xml"
        },
        {
          identifier: "cito-pci-vanilla",
          guid: "0000-0000-0004-cito-vanilla",
          filePath: "qti-items/cito-pci-vanilla.xml"
        },
        {
          identifier: "pci-graphing-interaction-2",
          guid: "0000-0000-0005-graphing",
          filePath: "qti-items/pci-graphing-interaction-2.xml"
        }
      ],
      items: [], // Will be populated with loaded XML content
      containerClass: 'qti3-player-container-fluid',
      colorClass: 'qti3-player-color-default',
      containerPaddingClass: 'qti3-player-container-padding-2',
      itemStates: new Map(),
      sessionControl: null,
      pnp: null,
      qti3Player: null,
      item: null,
      performResponseProcessing: true
    }
  },

  computed: {
    totalItems () {
      return this.items.length || this.itemConfigs.length
    },
    
    progressPercentage () {
      if (this.totalItems === 0) return 0
      return ((this.currentItem + 1) / this.totalItems) * 100
    },
    
    isPrevDisabled () {
      return this.currentItem === 0 || !this.isTestStarted
    },
    
    isNextDisabled () {
      return this.currentItem >= this.totalItems - 1
    },
    
    statusClass () {
      switch (this.itemStatus) {
        case 'Completed': return 'status-completed'
        case 'In Progress': return 'status-in-progress'
        case 'Not Started': return 'status-not-started'
        default: return ''
      }
    }
  },

  methods: {

    async initialize () {
      // Score when navigating
      this.performResponseProcessing = true
      // Load pnp
      this.pnp = new PnpFactory()
      // Load sessionControl
      this.sessionControl = new SessionControlFactory()
      this.sessionControl.setValidateResponses(true)
      this.sessionControl.setShowFeedback(false)
      
      // Load QTI items from files
      await this.loadItemsFromFiles()
    },

    async loadItemsFromFiles () {
      this.isLoading = true
      try {
        this.items = []
        
        for (const config of this.itemConfigs) {
          console.log(`Loading QTI item from: ${config.filePath}`)
          
          const response = await axios.get(config.filePath)
          
          const item = {
            identifier: config.identifier,
            guid: config.guid,
            xml: response.data
          }
          
          this.items.push(item)
        }
        
        console.log(`Successfully loaded ${this.items.length} QTI items`)
        
      } catch (error) {
        console.error('Error loading QTI items:', error)
        
        // Show error message to user with retry option
        const result = await Swal.fire({
          icon: 'error',
          title: 'Failed to Load QTI Items',
          text: `Could not load QTI items from files: ${error.message}`,
          confirmButtonText: 'Retry',
          cancelButtonText: 'Cancel',
          showCancelButton: true
        })
        
        if (result.isConfirmed) {
          await this.loadItemsFromFiles() // Retry loading
        }
      } finally {
        this.isLoading = false
      }
    },
    
    handleDirectNavigation () {
      if (this.isNavigating) return
      
      if (!this.isTestStarted) {
        this.isTestStarted = true
      }
      
      this.isNavigating = true
      
      // Save current state before navigating
      if (this.performResponseProcessing && this.qti3Player) {
        this.qti3Player.endAttempt('directNavigation')
      } else {
        this.loadItemAtIndex(this.currentItem)
        this.isNavigating = false
      }
    },
    
    handleKeyboardNavigation (event) {
      // Arrow key navigation
      if (event.key === 'ArrowLeft' && !this.isPrevDisabled) {
        this.handlePrevItem()
      } else if (event.key === 'ArrowRight' && !this.isNextDisabled) {
        this.handleNextItem()
      } else if (event.key === 'Enter' && !this.isTestStarted) {
        this.handleNextItem() // Start the test
      }
    },

    loadFirstItem () {
      this.loadItemAtIndex(0)
    },

    handleNextItem () {
      if (this.isNavigating || this.isNextDisabled) return
      
      console.log('[Controller][NextItem][' + this.currentItem + ']')
      if (!this.isTestStarted) {
        this.isTestStarted = true
        this.itemStatus = 'In Progress'
        this.loadFirstItem()
        return
      }

      this.isNavigating = true
      this.initiateNavigateNextItem()
    },

    handlePrevItem () {
      if (this.isNavigating || this.isPrevDisabled) return
      
      console.log('[Controller][PrevItem][' + this.currentItem + ']')
      if (this.currentItem === 0) return

      this.isNavigating = true
      this.initiateNavigatePrevItem()
    },

    initiateNavigateNextItem () {
      if (this.performResponseProcessing)
        this.qti3Player.endAttempt('navigateNextItem')
      else
        this.qti3Player.suspendAttempt('navigateNextItem')
    },

    navigateNextItem () {
      console.log('[NavigateNextItem]')

      this.currentItem += 1
      this.loadItemAtIndex(this.currentItem)
      this.isNavigating = false
    },

    initiateNavigatePrevItem () {
      if (this.performResponseProcessing)
        this.qti3Player.endAttempt('navigatePrevItem')
      else
        this.qti3Player.suspendAttempt('navigatePrevItem')
    },

    navigatePrevItem () {
      console.log('[NavigatePrevItem]')

      this.currentItem -= 1
      this.loadItemAtIndex(this.currentItem)
      this.isNavigating = false
    },

    handleEndAttemptCompleted (data) {
      this.evaluateResults(data)
    },

    handleSuspendAttemptCompleted (data) {
      this.evaluateResults(data)
    },

    handleScoreAttemptCompleted () {
    },

    evaluateResults (data) {
      // Save our state
      this.setTestStateItemState(data.state)

      if (data.state.validationMessages.length > 0) {
        // Display validation messages
        this.displayInvalidResponseMessages(data.state.validationMessages)
        // Do not proceed if we have any validationMessages
        return
      }

      this.next(data.target)
    },

    next (action) {
      switch (action) {
        case 'navigateNextItem':
          this.navigateNextItem()
          break

        case 'navigatePrevItem':
          this.navigatePrevItem()
          break

        default:
          // Unknown action --> NOOP
      }
    },

    loadItemAtIndex (index) {
      if (index === null) return
      if (this.items.length === 0) {
        console.warn('No items loaded yet')
        return
      }
      if ((index < 0) || (index >= this.items.length)) {
        console.warn(`Item index ${index} out of range (${this.items.length} items available)`)
        return
      }

      // Build a configuration
      const configuration = this.getConfiguration(this.items[index].guid)

      this.qti3Player.loadItemFromXml(this.items[index].xml, configuration)
    },

    toggleButtonDisabled (buttonRef, disable) {
      if (disable) {
        buttonRef.setAttribute('disabled', '')
      } else {
        buttonRef.removeAttribute('disabled')
      }
    },

    setTestStateItemState (state) {
      console.log('[Controller][SetItemState][' + state.guid + ']', state)
      this.itemStates.set(state.guid, state)
    },

    getTestStateItemState (guid) {
      console.log('[Controller][GetItemState][' + guid + ']', this.itemStates.get(guid))
      return this.itemStates.get(guid)
    },

    getConfiguration (guid) {
      const configuration = {}

      // Fetch prior state from Test State
      const state = this.getTestStateItemState(guid)
      if (typeof state !== 'undefined') {
        configuration.state = state
      }

      // IMPORTANT: Stamp the item's tracking guid onto the configuration
      configuration.guid = guid
      configuration.pnp = this.pnp.getPnp()
      configuration.sessionControl = this.sessionControl.getSessionControl()

      return configuration
    },

    displayItemAlertEvent (event) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: event.icon,
        html: event.message,
        showConfirmButton: false,
        showCloseButton: true,
        timer: 3000,
        timerProgressBar: true
      })
    },

    displayInvalidResponseMessages (messages) {
      messages.forEach((message) => {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            html: message.message,
            showConfirmButton: false,
            showCloseButton: true,
            timer: 3000,
            timerProgressBar: true
          })
      })
    },

    /**
     * @description Event handler for the QTI3Player component's 'notifyQti3PlayerReady'
     * event.  This event is fired upon mounting of the Qti3Player component.
     *
     * The Qti3Player is now ready for XML loading.
     * @param {Component} qti3Player - the Qti3Player component itself
     */
    handlePlayerReady (qti3Player) {
      this.qti3Player = qti3Player
    },

    /**
     * @description Event handler for the QTI3Player component's 'notifyQti3ItemReady'
     * event.  This event is fired upon completion of the qti-assessment-item
     * component's loading of XML.
     * 
     * The inner qti-assessment-item component is passed in the event.
     * @param {Component} item - the qti-assessment-item component itself
     */
    handleItemReady (item) {
      this.item = item
      this.itemStatus = 'In Progress'
      
      // Update completed items count if this item was already completed
      const itemState = this.itemStates.get(this.items[this.currentItem]?.guid)
      if (itemState && itemState.isCompleted) {
        this.itemStatus = 'Completed'
      }
    },

    handleItemCatalogEvent (event) {
      console.log('[ItemCatalogEvent][Type: ' + event.type + ']', event)
    }

  },

  async mounted () {
    await this.initialize()
    
    // Add keyboard event listener
    window.addEventListener('keydown', this.handleKeyboardNavigation)
  },
  
  beforeUnmount () {
    // Clean up keyboard event listener
    window.removeEventListener('keydown', this.handleKeyboardNavigation)
  }
}
</script>

<style scoped>
.qti-app-container {
  position: relative;
  min-height: 100vh;
  padding-top: 80px;
  padding-bottom: 50px;
}

/* Navigation Bar */
.navigation-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 70px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 1000;
}

.nav-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.nav-center {
  flex-direction: column;
  gap: 5px;
}

/* Navigation Buttons */
.nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: white;
  color: #667eea;
  border: 2px solid transparent;
  border-radius: 25px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.nav-btn:hover:not(:disabled) {
  background: #f7f7ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 18px;
}

/* Progress Container */
.progress-container {
  text-align: center;
  color: white;
}

.progress-text {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 5px;
}

.progress-bar-wrapper {
  width: 300px;
  height: 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 5px;
}

.progress-bar {
  height: 100%;
  background: white;
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Item Selector */
.item-selector {
  padding: 8px 15px;
  border-radius: 20px;
  border: 2px solid white;
  background: rgba(255, 255, 255, 0.9);
  color: #667eea;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 200px;
}

.item-selector:hover:not(:disabled) {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.item-selector:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Loading Overlay */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-overlay p {
  margin-top: 20px;
  color: #667eea;
  font-size: 16px;
  font-weight: 500;
}

/* Status Bar */
.status-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
  z-index: 999;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.status-value {
  font-size: 13px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 12px;
}

.status-completed {
  color: #28a745;
  background: #d4edda;
}

.status-in-progress {
  color: #007bff;
  background: #cce5ff;
}

.status-not-started {
  color: #6c757d;
  background: #e2e3e5;
}

/* Responsive Design */
@media (max-width: 768px) {
  .navigation-bar {
    height: auto;
    flex-direction: column;
    padding: 10px;
  }
  
  .nav-section {
    width: 100%;
    justify-content: center;
  }
  
  .progress-bar-wrapper {
    width: 200px;
  }
  
  .item-selector {
    min-width: 150px;
    font-size: 12px;
  }
  
  .qti-app-container {
    padding-top: 150px;
  }
}

/* Keyboard Navigation Indicator */
.nav-btn:focus {
  outline: 3px solid #ffd700;
  outline-offset: 2px;
}
</style>
