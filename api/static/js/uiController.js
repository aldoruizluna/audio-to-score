/**
 * uiController.js
 * Main entry point that coordinates the UI modules
 * This lean file serves as a façade for the modular architecture
 * 
 * TODO: Complete the refactoring of this file by:
 * - Fixing all lint errors
 * - Removing all legacy code that's no longer needed
 * - Ensuring proper module loading across all browsers
 * - Adding comprehensive error handling
 */

// Using ES modules pattern but with compatibility for non-module environments
const UIController = (function() {
    // Module references - to be loaded
    let ElementsController = null;
    let FileHandler = null;
    let FormHandler = null;
    let ViewController = null;
    let EventHandler = null;
    
    // Indicates if modules are loaded
    let modulesLoaded = false;
    
    /**
     * Asynchronously load all modules
     * This will be called when the page loads
     * 
     * TODO: Add retry logic for module loading failures
     * TODO: Implement loading indicators during module initialization
     * TODO: Add timeout handling for module loading
     * TODO: Consider using a dedicated module loader library
     */
    async function loadModules() {
        try {
            console.log('Loading UI modules...');
            
            // In production, these would be proper static imports
            // For development, we're using dynamic loading for compatibility
            ElementsController = await import('./modules/elements.js').then(m => m.default);
            FileHandler = await import('./modules/fileHandler.js').then(m => m.default);
            FormHandler = await import('./modules/formHandler.js').then(m => m.default);
            ViewController = await import('./modules/viewController.js').then(m => m.default);
            EventHandler = await import('./modules/eventHandler.js').then(m => m.default);
            
            modulesLoaded = true;
            console.log('All UI modules loaded successfully');
            
            // Initialize in the proper order
            ElementsController.init();
            FormHandler.initForm();
            EventHandler.setupEventListeners();
            
        } catch (error) {
            console.error('Failed to load UI modules:', error);
            modulesLoaded = false;
        }
    }
    
    // Attempt to load modules when this script runs
    if (typeof window !== 'undefined') {
        // Only in browser context
        window.addEventListener('DOMContentLoaded', function() {
            loadModules().catch(console.error);
        });
    }
    
    // TODO: Add support for server-side rendering environments
    // TODO: Implement feature detection for browser capabilities
    // TODO: Add graceful degradation for older browsers
    
    // Public API - all methods delegate to appropriate modules
    // TODO: Convert this to TypeScript interfaces for better type safety
    // TODO: Add method-level documentation for all public methods
    // TODO: Implement telemetry for tracking module usage
    return {
        /**
         * Initialize the UI
         */
        init: function() {
            // For explicit initialization when needed
            loadModules().catch(console.error);
            return this;
        },
        
        /**
         * Set up all event listeners
         */
        setupEventListeners: function() {
            if (EventHandler && modulesLoaded) {
                EventHandler.setupEventListeners();
                return this;
            }
            console.warn('Event handler module not loaded');
            return this;
                
                elements.dropZone.addEventListener('dragleave', () => {
                    elements.dropZone.classList.remove('active');
                });
                
                elements.dropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    elements.dropZone.classList.remove('active');
                    
                    if (e.dataTransfer.files.length) {
                        self.handleFile(e.dataTransfer.files[0]);
                    }
                });
                
                // Click to select file - Reliable version
                elements.dropZone.addEventListener('click', (e) => {
                    // Important: Don't trigger if clicking on an element that should handle its own click
                    // This prevents conflicts with the label that's already tied to the file input
                    if (e.target.tagName === 'LABEL' || e.target.tagName === 'INPUT' || 
                        e.target.tagName === 'BUTTON' || e.target.closest('label') || 
                        e.target.closest('button')) {
                        console.log('Ignoring click on or within a label/button/input');
                        return;
                    }
                    
                    console.log('Drop zone area clicked, opening file dialog');
                    e.preventDefault(); // Prevent any other default actions
                    e.stopPropagation(); // Stop event bubbling
                    
                    // Ensure file input is ready for a new selection
                    if (elements.fileInput) {
                        // Clear previous selection
                        try {
                            elements.fileInput.value = '';
                        } catch (e) {
                            console.warn('Could not reset file input value:', e);
                        }
                        
                        // Simulate a direct click on the input
                        elements.fileInput.click();
                    }
                });
            }
            
            // File input change - Fixed version
            if (elements.fileInput) {
                // Define a direct handler function
                function fileInputChangeHandler(event) {
                    console.log('File input change event triggered');
                    
                    if (event.target.files && event.target.files.length > 0) {
                        const file = event.target.files[0];
                        console.log('Processing file:', file.name);
                        self.handleFile(file);
                    } else {
                        console.warn('No files selected in change event');
                    }
                }
                
                // Remove any existing listeners to avoid duplicates
                elements.fileInput.removeEventListener('change', fileInputChangeHandler);
                
                // Add the event listener
                elements.fileInput.addEventListener('change', fileInputChangeHandler);
                
                // Debug message to confirm setup
                console.log('File input change listener setup successfully');
            }
            
            // Instrument selection changes tuning options
            if (elements.instrumentSelect) {
                elements.instrumentSelect.addEventListener('change', () => self.updateTuningOptions());
            }
            
            // Start transcription button
            if (elements.startTranscriptionBtn) {
                elements.startTranscriptionBtn.addEventListener('click', () => {
                    if (!selectedFile) {
                        console.error('No file selected');
                        this.showError('Please select an audio file first');
                        return;
                    }
                    console.log('Starting transcription with file:', selectedFile.name);
                    HistoryManager.notifyTranscriptionStarted(selectedFile);
                });
            }
            
            // Tab navigation
            if (elements.tabButtons && elements.tabButtons.length > 0) {
                elements.tabButtons.forEach(button => {
                    button.addEventListener('click', () => {
                        // Remove active class from all buttons and panes
                        elements.tabButtons.forEach(btn => btn.classList.remove('active'));
                        elements.tabPanes.forEach(pane => pane.classList.remove('active'));
                        
                        // Add active class to clicked button and corresponding pane
                        button.classList.add('active');
                        const tabId = button.getAttribute('data-tab');
                        const tabPane = document.getElementById(tabId);
                        if (tabPane) tabPane.classList.add('active');
                    });
                });
            }
            
            // Download buttons
            if (elements.downloadPdfBtn) {
                elements.downloadPdfBtn.addEventListener('click', () => {
                    HistoryManager.downloadResult('pdf');
                });
            }
            
            if (elements.downloadMusicXmlBtn) {
                elements.downloadMusicXmlBtn.addEventListener('click', () => {
                    HistoryManager.downloadResult('musicxml');
                });
            }
            
            // Try again button
            if (elements.tryAgainBtn) {
                elements.tryAgainBtn.addEventListener('click', () => {
                    self.resetToUploadScreen();
                });
            }
        },
        
        /**
         * Clear any existing file selection UI elements
         */
        clearFileSelectionUI: function() {
            console.log('Clearing file selection UI');
            
            // Reset drop zone
            if (elements.dropZone) {
                elements.dropZone.classList.remove('file-selected');
                elements.dropZone.style.borderColor = '';
                elements.dropZone.style.backgroundColor = '';
            }
            
            // Hide file name display
            if (elements.fileNameDisplay) {
                elements.fileNameDisplay.style.display = 'none';
                elements.fileNameDisplay.textContent = '';
            }
            
            // Hide selected indicator
            if (elements.fileSelectedIndicator) {
                elements.fileSelectedIndicator.style.display = 'none';
            }
            
            // Reset hint text
            const hint = elements.dropZone ? elements.dropZone.querySelector('.hint') : null;
            if (hint) {
                hint.textContent = 'Supported formats: MP3, WAV';
                hint.classList.remove('file-selected');
            }
        },
        
        /**
         * Handle the selected file
         * @param {File} file - The selected audio file
         */
        handleFile: function(file) {
            console.log('File selected:', file);
            
            // Check if file exists
            if (!file) {
                console.error('No file provided to handleFile');
                this.showError('Please select a valid audio file');
                return;
            }
            
            // Force accept ANY file type for testing and debugging
            // This removes a common source of frustration during development
            // In production, we would add proper validation here
            if (file.type && !file.type.startsWith('audio/')) {
                console.log('Processing non-audio file for testing:', file.type);
            }
            
            // Update UI
            selectedFile = file;
            console.log('Selected file set:', selectedFile.name);
            
            // Clear any previous file selection UI first
            this.clearFileSelectionUI();
            
            // Add a pulse animation to the drop zone to draw attention
            if (elements.dropZone) {
                elements.dropZone.style.animation = 'pulse 0.5s';
                setTimeout(() => { elements.dropZone.style.animation = ''; }, 500);
                
                // 1. Update the drop zone to show it's selected
                elements.dropZone.classList.add('file-selected');
            }
            
            // 2. Display the filename prominently
            if (elements.fileNameDisplay) {
                console.log('Updating file name display for:', file.name);
                elements.fileNameDisplay.textContent = file.name;
                elements.fileNameDisplay.style.display = 'block';
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
            const hint = elements.dropZone.querySelector('.hint');
            if (hint) {
                hint.textContent = 'Ready to transcribe: ' + file.name;
                hint.classList.add('file-selected');
            }
            
            // Show success message
            this.showSuccess('File selected: ' + file.name);
            
            // Show options panel with a visual transition
            if (elements.optionsPanel) {
                // First make sure it's visible
                elements.optionsPanel.classList.remove('hidden');
                
                // Add a slight animation to draw attention
                elements.optionsPanel.style.animation = 'fadeIn 0.5s ease-in-out';
                
                // Make the start button very prominent
                if (elements.startTranscriptionBtn) {
                    elements.startTranscriptionBtn.style.display = 'block';
                    elements.startTranscriptionBtn.classList.add('ready');
                    // Add a pulsing effect to draw attention
                    elements.startTranscriptionBtn.style.animation = 'pulse 1.5s infinite';
                }
            }
            
            // Scroll to make sure the options panel is visible
            if (elements.optionsPanel) {
                elements.optionsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        },
        
        /**
         * Update tuning options based on selected instrument
         */
        updateTuningOptions: function() {
            if (!elements.instrumentSelect || !elements.tuningSelect) return;
            
            const instrument = elements.instrumentSelect.value;
            const tuningOptions = {
                bass: [
                    { value: 'standard', label: 'Standard (E A D G)' },
                    { value: 'drop-d', label: 'Drop D (D A D G)' },
                    { value: '5-string', label: '5-String (B E A D G)' }
                ],
                guitar: [
                    { value: 'standard', label: 'Standard (E A D G B E)' },
                    { value: 'drop-d', label: 'Drop D (D A D G B E)' },
                    { value: 'open-g', label: 'Open G (D G D G B D)' }
                ],
                ukulele: [
                    { value: 'standard', label: 'Standard (G C E A)' },
                    { value: 'baritone', label: 'Baritone (D G B E)' }
                ]
            };
            
            // Clear current options
            elements.tuningSelect.innerHTML = '';
            
            // Add new options
            if (tuningOptions[instrument]) {
                tuningOptions[instrument].forEach(option => {
                    const optElement = document.createElement('option');
                    optElement.value = option.value;
                    optElement.textContent = option.label;
                    elements.tuningSelect.appendChild(optElement);
                });
            }
        },
        
        /**
         * Update the processing status display
         * @param {string} message - Status message to display
         * @param {number} progress - Progress percentage (0-100)
         * @param {string} color - Color for the progress bar
         */
        updateStatus: function(message, progress, color = '#4CAF50') {
            if (elements.statusMessage) {
                elements.statusMessage.textContent = message;
            }
            
            if (elements.progressIndicator) {
                elements.progressIndicator.style.width = `${progress}%`;
                elements.progressIndicator.style.backgroundColor = color;
            }
        },
        
        /**
         * Show an error message to the user
         * @param {string} message - Error message to display
         */
        showError: function(message) {
            console.error('Error:', message);
            
            // Update status with error message
            this.updateStatus(message, 100, '#f44336');
            
            // If it's a file selection error, highlight the drop zone
            if (message.includes('select') || message.includes('file')) {
                const dropZone = document.getElementById('drop-zone');
                if (dropZone) {
                    // Add error styling to drop zone
                    dropZone.style.borderColor = '#f44336';
                    dropZone.style.backgroundColor = 'rgba(244, 67, 54, 0.1)';
                    
                    // Animate to draw attention
                    dropZone.animate([
                        { transform: 'translateX(-5px)' },
                        { transform: 'translateX(5px)' },
                        { transform: 'translateX(-5px)' },
                        { transform: 'translateX(5px)' },
                        { transform: 'translateX(0)' }
                    ], {
                        duration: 400,
                        iterations: 1
                    });
                    
                    // Reset styling after a short delay
                    setTimeout(() => {
                        dropZone.style.borderColor = '';
                        dropZone.style.backgroundColor = '';
                    }, 2000);
                }
            }
            
            // Create a toast notification for the error
            const errorToast = document.createElement('div');
            errorToast.className = 'error-toast';
            errorToast.textContent = message;
            errorToast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background-color: #f44336;
                color: white;
                padding: 15px 25px;
                border-radius: 4px;
                font-weight: bold;
                z-index: 1000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                opacity: 0;
                transform: translateY(-20px);
                transition: opacity 0.3s, transform 0.3s;
            `;
            
            document.body.appendChild(errorToast);
            
            // Animate in
            setTimeout(() => {
                errorToast.style.opacity = '1';
                errorToast.style.transform = 'translateY(0)';
            }, 10);
            
            // Remove after 5 seconds
            setTimeout(() => {
                errorToast.style.opacity = '0';
                errorToast.style.transform = 'translateY(-20px)';
                setTimeout(() => {
                    document.body.removeChild(errorToast);
                }, 300);
            }, 5000);
        },
        
        /**
         * Switch to the processing view
         */
        showProcessingView: function() {
            uploadSectionVisible = false;
            processingContainerVisible = true;
            resultsContainerVisible = false;
            
            if (elements.uploadSection) elements.uploadSection.classList.add('hidden');
            if (elements.dropZone) elements.dropZone.classList.add('hidden');
            if (elements.optionsPanel) elements.optionsPanel.classList.add('hidden');
            if (elements.processingContainer) elements.processingContainer.classList.remove('hidden');
            if (elements.resultsContainer) elements.resultsContainer.classList.add('hidden');
        },
        
        /**
         * Switch to the results view
         */
        showResultsView: function() {
            uploadSectionVisible = false;
            processingContainerVisible = false;
            resultsContainerVisible = true;
            
            if (elements.processingContainer) elements.processingContainer.classList.add('hidden');
            if (elements.resultsContainer) elements.resultsContainer.classList.remove('hidden');
        },
        
        /**
         * Reset to the upload screen
         */
        resetToUploadScreen: function() {
            uploadSectionVisible = true;
            processingContainerVisible = false;
            resultsContainerVisible = false;
            
            if (elements.uploadSection) elements.uploadSection.classList.remove('hidden');
            if (elements.dropZone) elements.dropZone.classList.remove('hidden');
            if (elements.optionsPanel) elements.optionsPanel.classList.add('hidden'); // Hide options until file selected
            if (elements.processingContainer) elements.processingContainer.classList.add('hidden');
            if (elements.resultsContainer) elements.resultsContainer.classList.add('hidden');
            
            // Reset file selection
            selectedFile = null;
            
            // Reset the file input value
            if (elements.fileInput) {
                try {
                    elements.fileInput.value = '';
                } catch (e) {
                    console.warn('Could not reset file input:', e);
                }
            }
            
            // Clear the filename display
            if (elements.fileNameDisplay) {
                elements.fileNameDisplay.textContent = '';
            }
            
            // Reset the dropzone styling
            const dropZone = document.getElementById('drop-zone');
            if (dropZone) {
                dropZone.style.borderColor = '';
                dropZone.style.backgroundColor = '';
                
                // Show the icon again if it was hidden
                const icon = dropZone.querySelector('.icon');
                if (icon) {
                    icon.style.display = '';
                }
                
                // Reset the hint text
                const hint = dropZone.querySelector('.hint');
                if (hint) {
                    hint.textContent = 'Drag & drop audio file or click to select';
                    hint.style.color = '';
                    hint.style.fontWeight = '';
                }
                
                // Remove any added classes for file selection
                const dropZoneContent = dropZone.querySelector('.drop-zone-content');
                if (dropZoneContent) {
                    dropZoneContent.classList.remove('file-selected');
                }
            }
            
            // Reset the start button styling
            if (elements.startTranscriptionBtn) {
                elements.startTranscriptionBtn.style.backgroundColor = '';
                elements.startTranscriptionBtn.style.color = '';
                elements.startTranscriptionBtn.classList.remove('ready');
            }
            if (elements.fileNameDisplay) elements.fileNameDisplay.textContent = '';
            
            // Reset progress
            if (elements.progressIndicator) {
                elements.progressIndicator.style.backgroundColor = '#4CAF50';
                elements.progressIndicator.style.width = '0%';
            }
            if (elements.statusMessage) elements.statusMessage.textContent = '';
        },
        
        /**
         * Get the current selected file
         * @returns {File|null} - The currently selected file
         */
        getSelectedFile: function() {
            return selectedFile;
        },
        
        /**
         * Get form data for transcription
         * @returns {Object} - Form data including instrument, tuning, tempo
         */
        getFormData: function() {
            return {
                instrument: elements.instrumentSelect ? elements.instrumentSelect.value : 'bass',
                tuning: elements.tuningSelect ? elements.tuningSelect.value : 'standard',
                tempo: (elements.tempoInput && elements.tempoInput.value) ? elements.tempoInput.value : '120'
            };
        },
        
        /**
         * Get UI elements
         * @returns {Object} - Cached UI elements
         */
        /**
         * Get UI elements
         */
        getElements: function() {
            if (ElementsController && modulesLoaded) {
                return ElementsController.getElements();
            }
            
            console.warn('Elements module not loaded');
            return null;
        },
        
        /**
         * Handle file selection
         */
        handleFile: function(file) {
            if (FileHandler && modulesLoaded) {
                return FileHandler.handleFile(file);
            }
            console.warn('File handler module not loaded');
        },
        
        /**
         * Get form data for transcription
         */
        getFormData: function() {
            if (FormHandler && modulesLoaded) {
                return FormHandler.getFormData();
            }
            console.warn('Form handler module not loaded');
            return {};
        },
        
        /**
         * Get selected file
         */
        getSelectedFile: function() {
            if (FileHandler && modulesLoaded) {
                return FileHandler.getSelectedFile();
            }
            console.warn('File handler module not loaded');
            return null;
        },
        
        /**
         * Show processing view
         */
        showProcessingView: function() {
            if (ViewController && modulesLoaded) {
                return ViewController.showProcessingView();
            }
            console.warn('View controller module not loaded');
        },
        
        /**
         * Show results view
         */
        showResultsView: function() {
            if (ViewController && modulesLoaded) {
                return ViewController.showResultsView();
            }
            console.warn('View controller module not loaded');
        },
        
        /**
         * Reset to upload screen
         */
        resetToUploadScreen: function() {
            if (ViewController && modulesLoaded) {
                return ViewController.resetToUploadScreen();
            }
            console.warn('View controller module not loaded');
        },
        
        /**
         * Update processing status
         */
        updateStatus: function(message, progress, color) {
            if (ViewController && modulesLoaded) {
                return ViewController.updateStatus(message, progress, color);
            }
            console.warn('View controller module not loaded');
        },
        
        /**
         * Show error message
         */
        showError: function(message) {
            if (ViewController && modulesLoaded) {
                return ViewController.showError(message);
            }
            console.warn('View controller module not loaded');
            console.error(message);
        },
        
        /**
         * Access to the underlying modules (for advanced usage)
         */
        getModules: function() {
            return {
                elements: ElementsController,
                file: FileHandler,
                form: FormHandler,
                view: ViewController,
                events: EventHandler,
                loaded: modulesLoaded
            };
        }
    };
})();

// TODO: Add type definitions and JSDoc comments throughout the file
// TODO: Implement proper module loading with dynamic imports
// TODO: Add comprehensive error handling for module loading failures
// TODO: Create unit tests for this coordinator module
// TODO: Add performance tracking for module initialization
// TODO: Implement a graceful fallback mechanism for non-module environments
// TODO: Consider implementing lazy loading for modules that aren't immediately needed
// TODO: Add state persistence between page reloads using localStorage

// Support for ES modules export
export default UIController;
