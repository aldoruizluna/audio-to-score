/**
 * fileHandler.js
 * Module for handling file selection, validation, and updates
 */

import ElementsController from './elements.js';

const FileHandler = (function() {
    // File state
    let selectedFile = null;
    
    /**
     * Clear all file selection UI elements
     */
    function clearFileSelectionUI() {
        const elements = ElementsController.getElements();
        
        // Reset file name display
        if (elements.fileNameDisplay) {
            elements.fileNameDisplay.textContent = '';
            elements.fileNameDisplay.style.display = 'none';
        }
        
        // Hide file selected indicator
        if (elements.fileSelectedIndicator) {
            elements.fileSelectedIndicator.style.display = 'none';
            elements.fileSelectedIndicator.style.visibility = 'hidden';
            elements.fileSelectedIndicator.style.opacity = '0';
        }
        
        // Remove file-selected class from drop zone
        if (elements.dropZone) {
            elements.dropZone.classList.remove('file-selected');
        }
        
        // Reset file input
        if (elements.fileInput) {
            elements.fileInput.value = '';
        }
        
        // Reset internal state
        selectedFile = null;
        
        // Ensure start button is disabled
        if (elements.startTranscriptionBtn) {
            elements.startTranscriptionBtn.classList.add('disabled-btn');
            elements.startTranscriptionBtn.disabled = true;
        }
    }
    
    // Public API
    return {
        /**
         * Handle the selected file
         * @param {File} file - The selected audio file
         */
        handleFile: function(file) {
            if (!file) {
                console.error('No file provided to handleFile');
                return;
            }
            
            const elements = ElementsController.getElements();
            
            // Log file type for debugging
            if (file.type && !file.type.startsWith('audio/')) {
                console.log('Processing non-audio file for testing:', file.type);
            }
            
            // Update internal state
            selectedFile = file;
            
            // Update UI
            // 1. Update file name display
            if (elements.fileNameDisplay) {
                elements.fileNameDisplay.textContent = file.name;
                elements.fileNameDisplay.style.display = 'block';
            }
            
            // 2. Add file-selected class to drop zone
            if (elements.dropZone) {
                elements.dropZone.classList.add('file-selected');
            }
            
            // 3. Show the file selected indicator with robust display logic
            if (elements.fileSelectedIndicator) {
                console.log('Showing file selected indicator');
                
                // Set a direct attribute to bypass any style issues
                elements.fileSelectedIndicator.setAttribute('data-state', 'visible');
                
                // Force display with multiple methods for redundancy
                elements.fileSelectedIndicator.style.display = 'flex';
                elements.fileSelectedIndicator.style.visibility = 'visible';
                elements.fileSelectedIndicator.style.opacity = '1';
                elements.fileSelectedIndicator.style.height = 'auto';
                elements.fileSelectedIndicator.style.overflow = 'visible';
                
                // Remove any classes that might hide it
                elements.fileSelectedIndicator.classList.remove('hidden');
                
                // Force immediate rendering
                elements.fileSelectedIndicator.offsetHeight; // Force reflow
                
                // Inject a direct style tag if needed
                const styleId = 'force-indicator-style';
                if (!document.getElementById(styleId)) {
                    const style = document.createElement('style');
                    style.id = styleId;
                    style.textContent = `
                        [data-state="visible"] {
                            display: flex !important;
                            visibility: visible !important;
                            opacity: 1 !important;
                            height: auto !important;
                            margin: 15px auto !important;
                        }
                    `;
                    document.head.appendChild(style);
                }
            }
            
            // 4. Update the hint text
            const hintElement = document.querySelector('.hint');
            if (hintElement) {
                hintElement.classList.add('file-selected');
                hintElement.textContent = 'File selected! Configure options below.';
            }
            
            // 5. Enable the start button
            if (elements.startTranscriptionBtn) {
                elements.startTranscriptionBtn.classList.remove('disabled-btn');
                elements.startTranscriptionBtn.disabled = false;
            }
            
            // 6. Show the options panel with animation
            if (elements.optionsPanel) {
                if (elements.optionsPanel.style.display === 'none' || elements.optionsPanel.style.display === '') {
                    elements.optionsPanel.style.display = 'block';
                    elements.optionsPanel.style.opacity = '0';
                    elements.optionsPanel.style.transform = 'translateY(20px)';
                    
                    // Trigger animation
                    setTimeout(() => {
                        elements.optionsPanel.style.opacity = '1';
                        elements.optionsPanel.style.transform = 'translateY(0)';
                    }, 10);
                }
            }
        },
        
        /**
         * Get the current selected file
         * @returns {File|null} - The currently selected file
         */
        getSelectedFile: function() {
            return selectedFile;
        },
        
        /**
         * Clear file selection UI and state
         */
        clearFileSelection: function() {
            clearFileSelectionUI();
        }
    };
})();

export default FileHandler;
