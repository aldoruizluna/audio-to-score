/**
 * uiController.js
 * Module responsible for UI state management and user interaction
 */

const UIController = (function() {
    // UI state
    let uploadSectionVisible = true;
    let processingContainerVisible = false;
    let resultsContainerVisible = false;
    let selectedFile = null;
    
    // UI Elements cache
    let elements = null;
    
    /**
     * Initialize UI element references
     */
    function cacheElements() {
        elements = {
            uploadSection: document.getElementById('upload-section'),
            dropZone: document.getElementById('drop-zone'),
            fileInput: document.getElementById('file-input'),
            fileNameDisplay: document.getElementById('file-name-display'),
            fileSelectedIndicator: document.getElementById('file-selected-indicator'),
            optionsPanel: document.getElementById('options-panel'),
            startTranscriptionBtn: document.getElementById('start-transcription-btn'),
            processingContainer: document.getElementById('processing-container'),
            resultsContainer: document.getElementById('results-container'),
            statusMessage: document.getElementById('status-message'),
            progressIndicator: document.getElementById('progress-indicator'),
            tabButtons: document.querySelectorAll('.tab-btn'),
            tabPanes: document.querySelectorAll('.tab-pane'),
            downloadPdfBtn: document.getElementById('download-pdf'),
            downloadMusicXmlBtn: document.getElementById('download-musicxml'),
            originalAudio: document.getElementById('original-audio'),
            tryAgainBtn: document.getElementById('try-again-btn'),
            instrumentSelect: document.getElementById('instrument-select'),
            tuningSelect: document.getElementById('tuning-select'),
            tempoInput: document.getElementById('tempo-input'),
            historyContainer: document.getElementById('history-container'),
            historyList: document.getElementById('history-list'),
            noHistoryMessage: document.getElementById('no-history-message')
        };
    }
    
    // Public API
    return {
        /**
         * Initialize the UI
         */
        init: function() {
            cacheElements();
            this.setupEventListeners();
            this.updateTuningOptions();
        },
        
        /**
         * Set up all event listeners
         */
        setupEventListeners: function() {
            const self = this;
            
            // Drag and drop handlers
            if (elements.dropZone) {
                elements.dropZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    elements.dropZone.classList.add('active');
                });
                
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
                
                // Click to select file
                elements.dropZone.addEventListener('click', (e) => {
                    // Prevent clicking if we're already in a file select dialog
                    if (self.isSelectingFile) {
                        return;
                    }
                    
                    // Create a broader clickable area
                    const isClickable = (
                        e.target === elements.dropZone || 
                        e.target.classList.contains('drop-zone-content') || 
                        e.target.tagName === 'H2' || 
                        e.target.tagName === 'P' || 
                        e.target.classList.contains('icon') || 
                        e.target.tagName === 'svg' || 
                        e.target.tagName === 'path' || 
                        e.target.tagName === 'polyline'
                    );
                        
                    if (isClickable) {
                        console.log('Drop zone clicked, opening file dialog');
                        self.isSelectingFile = true;
                        
                        // Reset the file input to clear any previous selections
                        try {
                            elements.fileInput.value = '';
                        } catch (e) {
                            console.warn('Could not reset file input value:', e);
                        }
                        
                        // Trigger the file input click
                        elements.fileInput.click();
                        
                        // Reset the flag after a timeout (in case the dialog is closed without selecting)
                        setTimeout(() => {
                            self.isSelectingFile = false;
                        }, 1000);
                    }
                });
            }
            
            // File input change
            if (elements.fileInput) {
                // Remove any existing listeners to avoid duplicates
                elements.fileInput.removeEventListener('change', fileInputChangeHandler);
                
                // Define a named handler so we can remove it if needed
                function fileInputChangeHandler(event) {
                    console.log('File input change event triggered');
                    console.log('Files selected:', event.target.files);
                    
                    if (event.target.files && event.target.files.length > 0) {
                        const file = event.target.files[0];
                        console.log('Processing file:', file.name);
                        self.handleFile(file);
                    } else {
                        console.warn('No files selected in change event');
                    }
                }
                
                // Add the event listener
                elements.fileInput.addEventListener('change', fileInputChangeHandler);
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
            
            // Check if file is an audio file or in demo mode accept any file
            if (file.type && !file.type.startsWith('audio/') && window.location.port !== '8000') {
                console.warn('Non-audio file type:', file.type);
                this.showError('Please select an audio file (MP3, WAV, etc)');
                return;
            }
            
            // Update UI
            selectedFile = file;
            console.log('Selected file set:', selectedFile.name);
            
            // Add a pulse animation to the drop zone to draw attention
            if (elements.dropZone) {
                elements.dropZone.style.animation = 'pulse 0.5s';
                setTimeout(() => { elements.dropZone.style.animation = ''; }, 500);
            }
            
            // IMPROVED FILE SELECTION FEEDBACK
            // 1. Update the drop zone to show it's selected
            if (elements.dropZone) {
                elements.dropZone.classList.add('file-selected');
                // Apply direct styling for better visual feedback
                elements.dropZone.style.borderColor = '#4CAF50';
                elements.dropZone.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
            }
            
            // 2. Display the filename prominently
            if (elements.fileNameDisplay) {
                elements.fileNameDisplay.textContent = file.name;
                elements.fileNameDisplay.style.display = 'block';
                // Add animation to draw attention
                elements.fileNameDisplay.style.animation = 'fadeIn 0.5s';
                
                // Show a success message
                this.showSuccess('File selected: ' + file.name);
            }
            
            // 3. Show the file selected indicator
            if (elements.fileSelectedIndicator) {
                elements.fileSelectedIndicator.style.display = 'flex';
            }
            
            // 4. Update the hint text
            const hint = elements.dropZone.querySelector('.hint');
            if (hint) {
                hint.textContent = 'Ready to transcribe: ' + file.name;
                hint.classList.add('file-selected');
            }
            
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
        getElements: function() {
            return elements;
        }
    };
})();
