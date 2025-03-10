/**
 * main.js
 * Main controller that integrates all UI modules
 */

import ElementsController from './elements.js';
import FileHandler from './fileHandler.js';
import FormHandler from './formHandler.js';
import ViewController from './viewController.js';
import EventHandler from './eventHandler.js';

const UIController = (function() {
    // Public API
    return {
        /**
         * Initialize the UI
         */
        init: function() {
            // Initialize elements first (needed by other modules)
            ElementsController.init();
            
            // Initialize form with default values
            FormHandler.initForm();
            
            // Setup all event listeners
            EventHandler.setupEventListeners();
            
            console.log('Audio-to-Score UI initialized');
            return this;
        },
        
        // Expose individual controllers to allow direct access if needed
        elements: ElementsController,
        file: FileHandler,
        form: FormHandler,
        view: ViewController,
        events: EventHandler,
        
        /**
         * Get form data for transcription
         * @returns {Object} - Form data including instrument, tuning, tempo
         */
        getFormData: function() {
            return FormHandler.getFormData();
        },
        
        /**
         * Get the current selected file
         * @returns {File|null} - The currently selected file
         */
        getSelectedFile: function() {
            return FileHandler.getSelectedFile();
        },
        
        /**
         * Show error message
         * @param {string} message - Error message to display
         */
        showError: function(message) {
            ViewController.showError(message);
            return this;
        },
        
        /**
         * Reset to upload screen
         */
        resetToUploadScreen: function() {
            ViewController.resetToUploadScreen();
            return this;
        },
        
        /**
         * Get UI elements
         * @returns {Object} - Cached UI elements
         */
        getElements: function() {
            return ElementsController.getElements();
        }
    };
})();

export default UIController;
