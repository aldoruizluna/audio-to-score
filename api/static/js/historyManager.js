/**
 * historyManager.js
 * Module responsible for managing audio history and persistence
 */

const HistoryManager = (function() {
    // Private variables
    let audioHistory = [];
    
    /**
     * Load history from localStorage
     */
    function loadHistory() {
        const savedHistory = localStorage.getItem('audioHistory');
        if (savedHistory) {
            try {
                audioHistory = JSON.parse(savedHistory);
            } catch (error) {
                console.error('Error parsing history:', error);
                // Reset if corrupted
                localStorage.removeItem('audioHistory');
                audioHistory = [];
            }
        }
    }
    
    // Public API
    return {
        /**
         * Initialize the history manager
         */
        init: function() {
            loadHistory();
            this.renderHistoryList();
        },
        
        /**
         * Save a transcription job to history
         * @param {File} file - The audio file
         * @param {string} jobId - The transcription job ID
         * @param {Object} metadata - Additional metadata about the audio
         */
        saveToHistory: function(file, jobId, metadata = {}) {
            // Create a history item
            const timestamp = new Date().toISOString();
            const historyItem = {
                id: `history_${Date.now()}`,
                name: file.name,
                size: file.size,
                type: file.type,
                jobId: jobId,
                timestamp: timestamp,
                dateFormatted: new Date().toLocaleString(),
                metadata: metadata
            };
            
            // Add to history array
            audioHistory.unshift(historyItem); // Add to beginning of array
            
            // Limit history to 10 items
            if (audioHistory.length > 10) {
                audioHistory.pop();
            }
            
            // Save to localStorage
            localStorage.setItem('audioHistory', JSON.stringify(audioHistory));
            
            // Update UI
            this.renderHistoryList();
        },
        
        /**
         * Remove a job from history
         * @param {string} jobId - The job ID to remove
         */
        removeFromHistory: function(jobId) {
            if (!jobId) {
                console.error('Attempted to remove from history with null/undefined jobId');
                return;
            }
            
            console.log(`Attempting to remove job ${jobId} from history`);
            
            // Remove the job from history array
            const initialLength = audioHistory.length;
            audioHistory = audioHistory.filter(item => item.jobId !== jobId);
            
            // Check if anything was removed
            if (initialLength !== audioHistory.length) {
                console.log(`Successfully removed job ${jobId} from history`);
                // Save updated history to localStorage
                localStorage.setItem('audioHistory', JSON.stringify(audioHistory));
                // Update UI
                this.renderHistoryList();
            } else {
                console.warn(`Job ${jobId} not found in history to remove`);
                // Dump current audioHistory for debugging
                console.log('Current history:', audioHistory);
            }
        },
        
        /**
         * Render the history list in the UI
         */
        renderHistoryList: function() {
            const elements = UIController.getElements();
            if (!elements || !elements.historyList) return;
            
            // Clear current list
            while (elements.historyList.firstChild) {
                if (elements.historyList.firstChild !== elements.noHistoryMessage) {
                    elements.historyList.removeChild(elements.historyList.firstChild);
                } else {
                    break;
                }
            }
            
            // Show/hide no history message
            if (audioHistory.length === 0) {
                if (elements.noHistoryMessage) elements.noHistoryMessage.classList.remove('hidden');
            } else {
                if (elements.noHistoryMessage) elements.noHistoryMessage.classList.add('hidden');
                
                // Add history items
                audioHistory.forEach(item => {
                    const historyItem = document.createElement('div');
                    historyItem.className = 'history-item';
                    
                    // Create HTML structure
                    historyItem.innerHTML = `
                        <div class="history-item-content">
                            <div class="file-info">
                                <span class="file-name">${item.name}</span>
                                <span class="file-date">${item.dateFormatted}</span>
                            </div>
                            <div class="file-meta">
                                <span class="instrument">${item.metadata.instrument || 'bass'}</span>
                                <span class="tuning">${item.metadata.tuning || 'standard'}</span>
                            </div>
                        </div>
                    `;
                    
                    // Add click handler
                    historyItem.addEventListener('click', () => this.selectHistoryItem(item));
                    
                    // Add to list
                    elements.historyList.appendChild(historyItem);
                });
            }
        },
        
        /**
         * Select a history item to load
         * @param {Object} item - The history item to load
         */
        selectHistoryItem: async function(item) {
            console.log('Selected history item:', item);
            
            if (!item || !item.jobId) {
                console.error('Invalid history item or missing job ID');
                UIController.showError('Sorry, this history item cannot be loaded.');
                return;
            }
            
            try {
                // We can't directly load the file from history since browsers don't allow storing File objects
                // Instead, we'll use the job ID to load the previous result
                AudioProcessor.setCurrentJobId(item.jobId);
                
                // Update UI state
                UIController.showProcessingView();
                UIController.updateStatus('Loading previous result...', 50);
                
                // Check if the job result exists first
                try {
                    // First check if the job exists (this will convert legacy IDs in demo mode)
                    const statusCheck = await AudioProcessor.checkJobExists(item.jobId);
                    
                    // Handle job ID replacement in demo mode
                    if (statusCheck.replaced && statusCheck.job_id) {
                        console.log('Replacing legacy job ID with new demo ID:', statusCheck.job_id);
                        // Update our item and history with the new job ID
                        item.jobId = statusCheck.job_id;
                        
                        // Update in audioHistory array
                        const index = audioHistory.findIndex(histItem => histItem.id === item.id);
                        if (index !== -1) {
                            audioHistory[index].jobId = statusCheck.job_id;
                            // Save updated history
                            localStorage.setItem('audioHistory', JSON.stringify(audioHistory));
                        }
                        
                        // Update the current job ID
                        AudioProcessor.setCurrentJobId(statusCheck.job_id);
                    }
                    
                    // Get the job result (will work with original or replaced ID)
                    const data = await AudioProcessor.getJobResult(item.jobId);
                    
                    // Result exists, proceed with showing it
                    UIController.updateStatus('Loading complete!', 100);
                    
                    setTimeout(() => {
                        ResultRenderer.displayResults(data);
                        UIController.showResultsView();
                    }, 500);
                } catch (error) {
                    console.error('Error loading history item:', error);
                    
                    // Try to determine if this is due to a missing file
                    try {
                        // If we reach here in demo mode, something went wrong with our mock data
                        // Let's create a special error message for demo mode
                        if (window.location.port === '8000') { // Check if we're running on Python's SimpleHTTPServer
                            console.log('Demo mode - showing helpful error message');
                            UIController.showError('Could not load the previous result in demo mode. This would work with the actual API server.');
                            UIController.resetToUploadScreen();
                            return;
                        }
                        
                        // Normal error handling for production environment
                        const statusData = await AudioProcessor.checkJobExists(item.jobId);
                        console.log('Job status for failed history item:', statusData);
                        
                        // If job is in error state with a message about missing files
                        if (statusData.status === 'error' && statusData.error && 
                            (statusData.error.includes('file no longer exists') || 
                             statusData.error.includes('audio file no longer exists'))) {
                            
                            console.log('Detected missing file, removing from history');
                            UIController.showError('The original audio file has been deleted. Removing from history.');
                            
                            // Remove the item from history
                            this.removeFromHistory(item.jobId);
                            
                            // Return to the upload screen
                            setTimeout(() => {
                                UIController.resetToUploadScreen();
                            }, 2000);
                            
                            return;
                        }
                    } catch (statusError) {
                        console.error('Error checking job status:', statusError);
                    }
                    
                    // Default error message if not a missing file
                    UIController.showError(`Could not load the previous result: ${error.message}`);
                }
            } catch (error) {
                console.error('Error in selectHistoryItem:', error);
                UIController.showError(`Error loading history item: ${error.message}`);
            }
        },
        
        /**
         * Download result in the specified format
         * @param {string} format - The format to download (pdf, musicxml)
         */
        downloadResult: function(format) {
            const jobId = AudioProcessor.getCurrentJobId();
            if (!jobId) {
                console.error('Cannot download without a job ID');
                UIController.showError('No transcription available to download');
                return;
            }
            
            // Create a link and trigger download
            const link = document.createElement('a');
            link.href = `/result/${jobId}?format=${format}`;
            link.download = `transcription.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },
        
        /**
         * Notify that transcription has started
         * @param {File} file - The file being transcribed
         */
        notifyTranscriptionStarted: function(file) {
            if (!file) {
                UIController.showError('Please select an audio file');
                return;
            }
            
            // Show processing UI
            UIController.showProcessingView();
            UIController.updateStatus('Processing audio...', 25);
            
            // Start transcription
            AudioProcessor.uploadAndProcess(
                file,
                UIController.getFormData(),
                // Status update callback
                (message, progress, color) => {
                    UIController.updateStatus(message, progress, color);
                },
                // Complete callback
                (jobId) => {
                    ResultRenderer.loadAndDisplayResults(jobId);
                },
                // Error callback
                (errorMessage) => {
                    UIController.showError(errorMessage);
                }
            );
        },
        
        /**
         * Get the current history items
         * @returns {Array} - Current history items
         */
        getHistory: function() {
            return audioHistory;
        }
    };
})();
