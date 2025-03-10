/**
 * eventHandler.js
 * Module for setting up and managing event listeners
 */

import ElementsController from './elements.js';
import FileHandler from './fileHandler.js';
import ViewController from './viewController.js';
import FormHandler from './formHandler.js';

const EventHandler = (function() {
    /**
     * Set up tab navigation event listeners
     */
    function setupTabListeners() {
        const elements = ElementsController.getElements();
        
        if (elements.tabButtons && elements.tabPanes) {
            elements.tabButtons.forEach((button, index) => {
                button.addEventListener('click', () => {
                    // Remove active class from all buttons and panes
                    elements.tabButtons.forEach(btn => btn.classList.remove('active'));
                    elements.tabPanes.forEach(pane => pane.classList.remove('active'));
                    
                    // Add active class to current button and corresponding pane
                    button.classList.add('active');
                    elements.tabPanes[index].classList.add('active');
                });
            });
        }
    }
    
    /**
     * Set up drag and drop event listeners
     */
    function setupDropZoneListeners() {
        const elements = ElementsController.getElements();
        
        if (elements.dropZone) {
            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                elements.dropZone.addEventListener(eventName, preventDefaults, false);
                document.body.addEventListener(eventName, preventDefaults, false);
            });
            
            // Highlight drop zone when item is dragged over it
            ['dragenter', 'dragover'].forEach(eventName => {
                elements.dropZone.addEventListener(eventName, highlight, false);
            });
            
            // Remove highlight when item is dragged away
            ['dragleave', 'drop'].forEach(eventName => {
                elements.dropZone.addEventListener(eventName, unhighlight, false);
            });
            
            // Handle dropped files
            elements.dropZone.addEventListener('drop', handleDrop, false);
            
            // Handle click on drop zone
            elements.dropZone.addEventListener('click', (e) => {
                elements.fileInput.click();
            });
        }
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        function highlight(e) {
            elements.dropZone.classList.add('active');
        }
        
        function unhighlight(e) {
            elements.dropZone.classList.remove('active');
        }
        
        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length) {
                FileHandler.handleFile(files[0]);
            }
        }
    }
    
    /**
     * Set up file input change event listener
     */
    function setupFileInputListener() {
        const elements = ElementsController.getElements();
        
        if (elements.fileInput) {
            elements.fileInput.addEventListener('change', (e) => {
                if (e.target.files.length) {
                    FileHandler.handleFile(e.target.files[0]);
                }
            });
        }
    }
    
    /**
     * Set up form-related event listeners
     */
    function setupFormListeners() {
        const elements = ElementsController.getElements();
        
        // Update tuning options when instrument changes
        if (elements.instrumentSelect) {
            elements.instrumentSelect.addEventListener('change', () => {
                FormHandler.updateTuningOptions();
            });
        }
        
        // Handle transcription button click
        if (elements.startTranscriptionBtn) {
            elements.startTranscriptionBtn.addEventListener('click', () => {
                const file = FileHandler.getSelectedFile();
                if (!file) {
                    ViewController.showError('Please select an audio file first.');
                    return;
                }
                
                if (!FormHandler.isValid()) {
                    ViewController.showError('Please enter a valid tempo between 1 and 300.');
                    return;
                }
                
                // For demo/testing purposes, we'll just show the processing view
                ViewController.showProcessingView();
                
                // In a full implementation, you would send the file to the server here
                // For now, we'll simulate processing with a timeout
                simulateProcessing();
            });
        }
        
        // Handle try again button click
        if (elements.tryAgainBtn) {
            elements.tryAgainBtn.addEventListener('click', () => {
                ViewController.resetToUploadScreen();
            });
        }
    }
    
    /**
     * Simulate processing (for demo purposes)
     */
    function simulateProcessing() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            
            if (progress <= 30) {
                ViewController.updateStatus('Analyzing audio waveform...', progress);
            } else if (progress <= 60) {
                ViewController.updateStatus('Detecting notes and rhythms...', progress);
            } else if (progress <= 90) {
                ViewController.updateStatus('Generating musical notation...', progress);
            } else {
                ViewController.updateStatus('Finalizing score...', progress);
            }
            
            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                    ViewController.showResultsView();
                }, 500);
            }
        }, 200);
    }
    
    // Public API
    return {
        /**
         * Set up all event listeners
         */
        setupEventListeners: function() {
            setupDropZoneListeners();
            setupFileInputListener();
            setupTabListeners();
            setupFormListeners();
            return this;
        }
    };
})();

export default EventHandler;
