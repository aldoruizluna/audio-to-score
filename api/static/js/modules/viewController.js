/**
 * viewController.js
 * Module for managing UI view states and transitions
 */

import ElementsController from './elements.js';
import FileHandler from './fileHandler.js';

const ViewController = (function() {
    // UI state
    let uploadSectionVisible = true;
    let processingContainerVisible = false;
    let resultsContainerVisible = false;
    
    /**
     * Apply fade-in animation to an element
     * @param {HTMLElement} element - Element to animate
     * @param {Function} callback - Optional callback after animation
     */
    function fadeIn(element, callback) {
        if (!element) return;
        
        element.style.opacity = '0';
        element.style.display = 'block';
        
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
            
            if (typeof callback === 'function') {
                setTimeout(callback, 300);
            }
        }, 10);
    }
    
    /**
     * Apply fade-out animation to an element
     * @param {HTMLElement} element - Element to animate
     * @param {Function} callback - Optional callback after animation
     */
    function fadeOut(element, callback) {
        if (!element) return;
        
        element.style.opacity = '1';
        
        setTimeout(() => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                element.style.display = 'none';
                
                if (typeof callback === 'function') {
                    callback();
                }
            }, 300);
        }, 10);
    }
    
    /**
     * Update the processing status display
     * @param {string} message - Status message to display
     * @param {number} progress - Progress percentage (0-100)
     * @param {string} color - Color for the progress bar
     */
    function updateStatus(message, progress, color = '#4CAF50') {
        const elements = ElementsController.getElements();
        
        if (elements.statusMessage) {
            elements.statusMessage.textContent = message;
        }
        
        if (elements.progressIndicator) {
            elements.progressIndicator.style.width = `${progress}%`;
            elements.progressIndicator.style.backgroundColor = color;
        }
    }
    
    /**
     * Show an error message to the user
     * @param {string} message - Error message to display
     */
    function showError(message) {
        const elements = ElementsController.getElements();
        
        console.error(message);
        
        // Create error element if it doesn't exist
        let errorElement = document.getElementById('error-message');
        
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'error-message';
            errorElement.className = 'error-message';
            
            // Create close button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'error-close-btn';
            closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', () => {
                if (errorElement && errorElement.parentNode) {
                    errorElement.parentNode.removeChild(errorElement);
                }
            });
            
            errorElement.appendChild(closeBtn);
            
            // Create message container
            const messageContainer = document.createElement('div');
            messageContainer.className = 'error-content';
            errorElement.appendChild(messageContainer);
            
            // Create error icon
            const icon = document.createElement('div');
            icon.className = 'error-icon';
            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z" fill="currentColor"/></svg>';
            messageContainer.appendChild(icon);
            
            // Create text container
            const textContainer = document.createElement('div');
            textContainer.className = 'error-text';
            messageContainer.appendChild(textContainer);
            
            // Add to document
            document.body.appendChild(errorElement);
        }
        
        // Update error message text
        const textContainer = errorElement.querySelector('.error-text');
        if (textContainer) {
            textContainer.textContent = message;
        }
        
        // Remove any existing animation classes
        errorElement.classList.remove('slide-in', 'slide-out');
        
        // Add slide-in animation
        errorElement.classList.add('slide-in');
        
        // Auto-dismiss after 8 seconds
        setTimeout(() => {
            if (errorElement && document.body.contains(errorElement)) {
                errorElement.classList.remove('slide-in');
                errorElement.classList.add('slide-out');
                
                setTimeout(() => {
                    if (errorElement && errorElement.parentNode) {
                        errorElement.parentNode.removeChild(errorElement);
                    }
                }, 500);
            }
        }, 8000);
    }
    
    // Public API
    return {
        /**
         * Switch to the processing view
         */
        showProcessingView: function() {
            const elements = ElementsController.getElements();
            
            // Hide upload section
            if (elements.uploadSection) {
                elements.uploadSection.style.display = 'none';
                uploadSectionVisible = false;
            }
            
            // Show processing container
            if (elements.processingContainer) {
                elements.processingContainer.style.display = 'block';
                processingContainerVisible = true;
            }
            
            // Reset and hide results container
            if (elements.resultsContainer) {
                elements.resultsContainer.style.display = 'none';
                resultsContainerVisible = false;
            }
            
            // Reset progress indicator
            updateStatus('Preparing audio for processing...', 0);
            return this;
        },
        
        /**
         * Switch to the results view
         */
        showResultsView: function() {
            const elements = ElementsController.getElements();
            
            // Hide processing container
            if (elements.processingContainer) {
                elements.processingContainer.style.display = 'none';
                processingContainerVisible = false;
            }
            
            // Show results container
            if (elements.resultsContainer) {
                elements.resultsContainer.style.display = 'block';
                resultsContainerVisible = true;
            }
            return this;
        },
        
        /**
         * Reset to the upload screen
         */
        resetToUploadScreen: function() {
            const elements = ElementsController.getElements();
            
            // Reset file selection
            FileHandler.clearFileSelection();
            
            // Reset the UI state
            uploadSectionVisible = true;
            processingContainerVisible = false;
            resultsContainerVisible = false;
            
            // Show upload section with animation
            if (elements.uploadSection) {
                elements.uploadSection.style.opacity = '0';
                elements.uploadSection.style.transform = 'translateY(20px)';
                elements.uploadSection.style.display = 'block';
                
                setTimeout(() => {
                    elements.uploadSection.style.opacity = '1';
                    elements.uploadSection.style.transform = 'translateY(0)';
                }, 10);
            }
            
            // Hide processing container
            if (elements.processingContainer) {
                elements.processingContainer.style.display = 'none';
            }
            
            // Hide results container with animation
            if (elements.resultsContainer) {
                fadeOut(elements.resultsContainer);
            }
            
            // Reset tab selection
            if (elements.tabButtons && elements.tabPanes) {
                elements.tabButtons.forEach((button, index) => {
                    if (index === 0) {
                        button.classList.add('active');
                    } else {
                        button.classList.remove('active');
                    }
                });
                
                elements.tabPanes.forEach((pane, index) => {
                    if (index === 0) {
                        pane.classList.add('active');
                    } else {
                        pane.classList.remove('active');
                    }
                });
            }
            
            return this;
        },
        
        /**
         * Update the processing status display
         * @param {string} message - Status message to display
         * @param {number} progress - Progress percentage (0-100)
         * @param {string} color - Color for the progress bar
         */
        updateStatus: function(message, progress, color = '#4CAF50') {
            updateStatus(message, progress, color);
            return this;
        },
        
        /**
         * Show error message
         * @param {string} message - Error message to display
         */
        showError: function(message) {
            showError(message);
            return this;
        }
    };
})();

export default ViewController;
