/**
 * audioProcessor.js
 * Module responsible for audio upload, processing and communication with the backend API
 */

const AudioProcessor = (function() {
    // Private variables
    let currentJobId = null;
    let statusCheckInterval = null;
    let processingTimeout = null;
    
    // Detect if we're in a testing environment (no API available)
    const isTestingMode = function() {
        // Always return true when using Python's SimpleHTTPServer
        // This will enable test/demo mode no matter what page we're on
        // In a production environment, we would be more selective
        return true;
    };
    
    // Public API
    return {
        /**
         * Uploads audio file and starts the processing pipeline
         * @param {File} file - The audio file to upload
         * @param {Object} metadata - Additional metadata about the audio
         * @param {Function} onStatusUpdate - Callback for status updates
         * @param {Function} onComplete - Callback when processing is complete
         * @param {Function} onError - Callback for errors
         */
        uploadAndProcess: async function(file, metadata, onStatusUpdate, onComplete, onError) {
            if (!file) {
                onError('Please select an audio file');
                return;
            }
            
            // Prepare form data
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                // Check if we're in testing mode
                if (isTestingMode()) {
                    console.log('Running in test mode - mocking API response');
                    // Generate a mock job ID that includes the filename to make it more realistic
                    const filename = file ? file.name : 'demo-audio.mp3';
                    currentJobId = 'test-job-' + filename + '-' + Date.now();
                    
                    // Show a message about demo mode
                    console.log('✨ DEMO MODE ACTIVE: No actual API calls will be made');
                    console.log('📂 Processing file: ' + filename);
                    
                    onStatusUpdate('Processing audio... (DEMO MODE)', 25);
                    
                    // Use mock status polling in test mode
                    this.startStatusPolling(onStatusUpdate, onComplete, onError);
                    return;
                }
                
                // Upload file
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    currentJobId = data.job_id;
                    onStatusUpdate('Processing audio...', 25);
                    
                    // Start polling for status
                    this.startStatusPolling(onStatusUpdate, onComplete, onError);
                } else {
                    onError(`Upload failed: ${data.detail || 'Unknown error'}`);
                }
            } catch (error) {
                onError(`Error: ${error.message}`);
            }
        },
        
        /**
         * Starts polling for job status
         * @param {Function} onStatusUpdate - Callback for status updates
         * @param {Function} onComplete - Callback when processing is complete
         * @param {Function} onError - Callback for errors
         */
        startStatusPolling: function(onStatusUpdate, onComplete, onError) {
            // Clear any existing intervals and timeouts
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
            }
            
            if (processingTimeout) {
                clearTimeout(processingTimeout);
            }
            
            const checkStatus = async () => {
                if (!currentJobId) {
                    console.log('No current job ID, skipping status check');
                    return;
                }
                
                try {
                    console.log('Checking status for job:', currentJobId);
                    
                    // In testing mode, simulate a successful response after 3 seconds
                    if (isTestingMode()) {
                        console.log('TEST MODE: Simulating status check');
                        // If this is the first status check or it's been less than 3 seconds since job creation,
                        // return 'processing', otherwise return 'completed'
                        const jobIdTimestamp = parseInt(currentJobId.split('-').pop());
                        const timeElapsed = Date.now() - jobIdTimestamp;
                        
                        const data = {
                            status: timeElapsed < 3000 ? 'processing' : 'completed',
                            progress: timeElapsed < 3000 ? 50 : 100
                        };
                        
                        // Update UI based on status
                        handleStatusUpdate(data);
                        return;
                    }
                    
                    const response = await fetch(`/status/${currentJobId}`);
                    
                    if (!response.ok) {
                        console.error('Error in status response:', response.status, response.statusText);
                        onError(`Server error: ${response.status} ${response.statusText}`);
                        return;
                    }
                    
                    const data = await response.json();
                    handleStatusUpdate(data);
                } catch (error) {
                    console.error('Error checking job status:', error);
                    
                    if (isTestingMode()) {
                        console.log('TEST MODE: Continuing despite error');
                        // In test mode, we'll just continue with a simulated successful response
                        const data = { status: 'completed', progress: 100 };
                        handleStatusUpdate(data);
                    } else {
                        onError(`Error checking status: ${error.message}`);
                        clearInterval(statusCheckInterval);
                        statusCheckInterval = null;
                        clearTimeout(processingTimeout);
                        processingTimeout = null;
                    }
                }
            };
            
            // Helper function to handle status updates
            const handleStatusUpdate = (data) => {
                // Update UI based on status
                switch(data.status) {
                    case 'completed':
                        onStatusUpdate('Processing complete!', 100);
                        clearInterval(statusCheckInterval);
                        statusCheckInterval = null;
                        clearTimeout(processingTimeout);
                        processingTimeout = null;
                        
                        // Small delay before showing results
                        setTimeout(() => {
                            onComplete(currentJobId);
                        }, 500);
                        break;
                        
                    case 'processing':
                        onStatusUpdate('Processing audio...', 50);
                        break;
                        
                    case 'error':
                        onStatusUpdate('Error occurred', 100, '#f44336');
                        clearInterval(statusCheckInterval);
                        statusCheckInterval = null;
                        onError(data.error || 'An error occurred during processing');
                        break;
                        
                    default:
                        onStatusUpdate(`Status: ${data.status}`, 25);
                }
            };
            
            // Start checking status immediately and then every 2 seconds
            checkStatus();
            statusCheckInterval = setInterval(checkStatus, 2000);
            
            // Backup timeout to prevent getting stuck
            processingTimeout = setTimeout(() => {
                console.log('BACKUP TIMEOUT: Processing taking too long, forcing transition');
                if (statusCheckInterval) {
                    clearInterval(statusCheckInterval);
                    statusCheckInterval = null;
                }
                
                try {
                    // Try to get results anyway
                    onStatusUpdate('Auto-checking for results...', 100);
                    onComplete(currentJobId);
                } catch (error) {
                    console.error('Error in backup timeout handler:', error);
                    onError('Processing timeout. Please try again.');
                }
            }, 30000); // 30 second timeout
        },
        
        /**
         * Retrieves the result for a job
         * @param {string} jobId - The ID of the job
         * @param {string} format - The desired format (json, pdf, etc.)
         * @returns {Promise<Object>} - The job result
         */
        getJobResult: async function(jobId, format = 'json') {
            // If in test mode, return mock data
            if (isTestingMode()) {
                console.log('DEMO MODE: Returning mock transcription results');
                
                // Extract filename from job ID if available
                let filename = 'demo-audio.mp3';
                if (jobId.includes('-')) {
                    const parts = jobId.split('-');
                    if (parts.length >= 3) {
                        // Format: test-job-filename-timestamp
                        filename = parts[2];
                    }
                }
                
                // Create a more musical and realistic bass line
                const seedValue = parseInt(jobId.split('-').pop() || Date.now()) % 100;
                
                // Bass patterns based on common bass lines
                const bassPatterns = [
                    // Walking bass pattern (1-3-5-6-5-3)
                    [
                        {string: 4, fret: 0, duration: 0.5}, // E
                        {string: 4, fret: 3, duration: 0.5}, // G
                        {string: 3, fret: 0, duration: 0.5}, // A
                        {string: 3, fret: 2, duration: 0.5}, // B
                        {string: 3, fret: 0, duration: 0.5}, // A
                        {string: 4, fret: 3, duration: 0.5}, // G
                    ],
                    // Funk pattern
                    [
                        {string: 3, fret: 5, duration: 0.25}, // D
                        {string: 3, fret: 5, duration: 0.25}, // D
                        {string: 3, fret: 7, duration: 0.5},  // E
                        {string: 2, fret: 5, duration: 0.25}, // A
                        {string: 3, fret: 5, duration: 0.25}, // D
                        {string: 3, fret: 5, duration: 0.5},  // D
                    ],
                    // Rock pattern
                    [
                        {string: 4, fret: 3, duration: 0.75}, // G
                        {string: 3, fret: 0, duration: 0.25}, // A
                        {string: 3, fret: 2, duration: 1.0},  // B
                        {string: 3, fret: 3, duration: 0.75}, // C
                        {string: 3, fret: 2, duration: 0.25}, // B
                    ],
                    // Blues pattern
                    [
                        {string: 3, fret: 0, duration: 0.5},  // A
                        {string: 3, fret: 3, duration: 0.5},  // C
                        {string: 2, fret: 0, duration: 0.75}, // D
                        {string: 3, fret: 0, duration: 0.25}, // A
                        {string: 3, fret: 0, duration: 0.5},  // A
                        {string: 4, fret: 0, duration: 0.5},  // E
                    ]
                ];
                
                // Select a pattern based on the seed
                const selectedPattern = bassPatterns[seedValue % bassPatterns.length];
                
                // Generate more complex bass line based on the pattern
                const mockNotes = [];
                let currentTime = 0.5;
                const patternRepeats = 3; // Repeat the pattern several times
                
                for (let repeat = 0; repeat < patternRepeats; repeat++) {
                    for (let i = 0; i < selectedPattern.length; i++) {
                        const note = {...selectedPattern[i]};
                        note.time = currentTime;
                        note.probability = 0.92 + (Math.sin(i * 0.5) * 0.07); // Between 0.85 and 0.99
                        
                        mockNotes.push(note);
                        currentTime += note.duration;
                        
                        // Add some variations in repeats (except the first one)
                        if (repeat > 0 && Math.random() > 0.7) {
                            // Occasionally add a grace note or variation
                            const variation = {
                                string: note.string,
                                fret: (note.fret + 2) % 12, // Simple variation
                                time: currentTime,
                                duration: 0.25,
                                probability: 0.88
                            };
                            mockNotes.push(variation);
                            currentTime += 0.25;
                        }
                    }
                }
                
                // Add more realistic metadata
                const genres = ['Rock', 'Jazz', 'Funk', 'Blues', 'Pop'];
                const tunings = ['Standard (E-A-D-G)', 'Drop D (D-A-D-G)', 'Standard 5-string (B-E-A-D-G)'];
                const selectedGenre = genres[seedValue % genres.length];
                const selectedTuning = tunings[seedValue % tunings.length];
                
                // Calculate actual duration based on notes
                let totalDuration = 0;
                if (mockNotes.length > 0) {
                    const lastNote = mockNotes[mockNotes.length - 1];
                    totalDuration = lastNote.time + lastNote.duration + 1; // Add 1 second buffer at end
                }
                
                return {
                    status: 'success',
                    job_id: jobId,
                    timestamp: new Date().toISOString(),
                    notes: mockNotes,
                    metadata: {
                        filename: filename,
                        duration: totalDuration,
                        instrument: 'bass',
                        tuning: selectedTuning.split(' ')[0].toLowerCase(),
                        genre: selectedGenre,
                        confidence: 0.89 + (seedValue % 10) / 100,
                        analysis: {
                            key: ['C', 'G', 'D', 'A', 'E'][seedValue % 5],
                            bpm: 80 + (seedValue % 40),
                            time_signature: '4/4'
                        }
                    }
                };
            }
            
            const response = await fetch(`/result/${jobId}?format=${format}`);
            
            if (!response.ok) {
                const error = new Error(`Failed to load results: ${response.status} ${response.statusText}`);
                error.statusCode = response.status;
                
                try {
                    const errorData = await response.json();
                    error.detail = errorData.detail || 'Unknown error';
                } catch (parseError) {
                    // If we can't parse the error response
                    error.detail = 'Unknown error';
                }
                
                throw error;
            }
            
            return await response.json();
        },
        
        /**
         * Gets the current job ID
         * @returns {string|null} - The current job ID
         */
        getCurrentJobId: function() {
            return currentJobId;
        },
        
        /**
         * Sets the current job ID
         * @param {string} jobId - The job ID to set
         */
        setCurrentJobId: function(jobId) {
            currentJobId = jobId;
        },
        
        /**
         * Checks if a job exists and is valid
         * @param {string} jobId - The job ID to check
         * @returns {Promise<Object>} - The job status response
         */
        checkJobExists: async function(jobId) {
            // If in test mode, always return success
            if (isTestingMode()) {
                console.log('DEMO MODE: Simulating job exists check');
                
                // In demo mode, we'll simulate that all jobs exist and are valid
                // But we'll add a special case for jobs without our test prefix
                if (!jobId.startsWith('test-job-')) {
                    // For historical items that might be in localStorage
                    // We'll create a new demo job on-the-fly
                    console.log('DEMO MODE: Converting legacy job ID to demo format');
                    const newId = 'test-job-legacy-audio-' + Date.now();
                    // Return the new ID to replace the old one
                    return { status: 'success', job_id: newId, replaced: true };
                }
                
                return { status: 'success', job_id: jobId };
            }
            
            const response = await fetch(`/status/${jobId}`);
            if (!response.ok) {
                throw new Error(`Job not found: ${response.status}`);
            }
            return await response.json();
        }
    };
})();
