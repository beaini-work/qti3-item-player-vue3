<template>
  <div>
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
    <button ref="btnPrev" type="button" @click="handlePrevItem" class="btn btn-sm btn-outline-primary">Prev</button>
    <button ref="btnNext" type="button" @click="handleNextItem" class="btn btn-sm btn-outline-primary">Next</button>
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
        
        // Show error message to user
        Swal.fire({
          icon: 'error',
          title: 'Failed to Load QTI Items',
          text: `Could not load QTI items from files: ${error.message}`,
          confirmButtonText: 'OK'
        })
      }
    },

    loadFirstItem () {
      this.loadItemAtIndex(0)
    },

    handleNextItem () {
      console.log('[Controller][NextItem][' + this.currentItem + ']')
      if (!this.isTestStarted) {
        this.isTestStarted = true
        this.loadFirstItem()
        return
      }

      this.initiateNavigateNextItem()
    },

    handlePrevItem () {
      console.log('[Controller][PrevItem][' + this.currentItem + ']')
      if (this.currentItem === 0) return

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
    },

    handleItemCatalogEvent (event) {
      console.log('[ItemCatalogEvent][Type: ' + event.type + ']', event)
    }

  },

  async mounted () {
    await this.initialize()
  }
}
</script>

<style>
</style>
