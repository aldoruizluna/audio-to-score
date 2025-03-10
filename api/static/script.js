// Audio-to-Score Transcription System - Frontend Script

let uploadSectionVisible = true;
let processingContainerVisible = false;
let resultsContainerVisible = false;

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const uploadSection = document.getElementById('upload-section');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const optionsPanel = document.getElementById('options-panel');
    const startTranscriptionBtn = document.getElementById('start-transcription-btn');
    const processingContainer = document.getElementById('processing-container');
    const resultsContainer = document.getElementById('results-container');
    const statusMessage = document.getElementById('status-message');
    const progressIndicator = document.getElementById('progress-indicator');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const downloadPdfBtn = document.getElementById('download-pdf');
    const downloadMusicXmlBtn = document.getElementById('download-musicxml');
    const originalAudio = document.getElementById('original-audio');
    const tryAgainBtn = document.getElementById('try-again-btn');
    
    // Variables
    let selectedFile = null;
    let currentJobId = null;
    let statusCheckInterval = null;
    let audioHistory = [];
    const historyContainer = document.getElementById('history-container');
    const historyList = document.getElementById('history-list');
    const noHistoryMessage = document.getElementById('no-history-message');
    
    // Initialize dynamic tuning options based on instrument
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
    
    // Event Listeners
    // Drag and drop handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('active');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    
    // Click to select file - but only delegate to label,
    // since there's already a label with a 'for' attribute that triggers the input
    // This prevents double event triggering
    const fileInputLabel = dropZone.querySelector('label[for="file-input"]');
    if (fileInputLabel) {
        // Remove the existing click on the entire drop zone
        // Only let the label handle the click - this prevents double prompts
        dropZone.addEventListener('click', (e) => {
            // Only trigger if we're clicking the drop zone directly, not a child element
            if (e.target === dropZone || e.target.classList.contains('drop-zone-content')) {
                fileInput.click();
            }
        });
    }
    
    // Make sure we only attach one change listener
    fileInput.removeEventListener('change', handleFileInputChange);
    fileInput.addEventListener('change', handleFileInputChange);
    
    function handleFileInputChange() {
        console.log('File input change detected');
        if (fileInput.files.length) {
            handleFile(fileInput.files[0]);
        }
    }
    
    // Instrument selection changes tuning options
    document.getElementById('instrument-select').addEventListener('change', updateTuningOptions);
    
    // Start transcription button
    startTranscriptionBtn.addEventListener('click', startTranscription);
    
    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to clicked button and its corresponding pane
            button.classList.add('active');
            document.getElementById(button.dataset.tab).classList.add('active');
        });
    });
    
    // Download buttons
    downloadPdfBtn.addEventListener('click', () => downloadResult('pdf'));
    downloadMusicXmlBtn.addEventListener('click', () => downloadResult('musicxml'));
    
    // Functions
    function handleFile(file) {
        // Validate file type
        const validTypes = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3'];
        
        if (!validTypes.includes(file.type)) {
            alert('Please select a valid audio file (MP3 or WAV)');
            return;
        }
        
        selectedFile = file;
        
        // Show file name in drop zone
        dropZone.querySelector('h2').textContent = file.name;
        dropZone.querySelector('p').textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
        
        // Show options panel
        optionsPanel.classList.remove('hidden');
    }
    
    // Audio history functions
    function saveToHistory(file, jobId, metadata = {}) {
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
        renderHistoryList();
    }
    
    function loadHistory() {
        const savedHistory = localStorage.getItem('audioHistory');
        if (savedHistory) {
            try {
                audioHistory = JSON.parse(savedHistory);
                renderHistoryList();
            } catch (error) {
                console.error('Error parsing history:', error);
                // Reset if corrupted
                localStorage.removeItem('audioHistory');
                audioHistory = [];
            }
        }
    }
    
    function removeFromHistory(jobId) {
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
            renderHistoryList();
        } else {
            console.warn(`Job ${jobId} not found in history to remove`);
            // Dump current audioHistory for debugging
            console.log('Current history:', audioHistory);
        }
    }
    
    function renderHistoryList() {
        // Clear current list
        while (historyList.firstChild) {
            if (historyList.firstChild !== noHistoryMessage) {
                historyList.removeChild(historyList.firstChild);
            } else {
                break;
            }
        }
        
        // Show/hide no history message
        if (audioHistory.length === 0) {
            noHistoryMessage.classList.remove('hidden');
        } else {
            noHistoryMessage.classList.add('hidden');
            
            // Add history items
            audioHistory.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.dataset.id = item.id;
                
                // Format file size
                const fileSizeMB = (item.size / (1024 * 1024)).toFixed(2);
                
                historyItem.innerHTML = `
                    <div class="history-item-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 18V5l12-2v13"></path>
                            <circle cx="6" cy="18" r="3"></circle>
                            <circle cx="18" cy="16" r="3"></circle>
                        </svg>
                    </div>
                    <div class="history-item-details">
                        <div class="history-item-name">${item.name}</div>
                        <div class="history-item-meta">${fileSizeMB} MB • ${item.dateFormatted}</div>
                    </div>
                `;
                
                // Add click event
                historyItem.addEventListener('click', () => {
                    selectHistoryItem(item);
                });
                
                historyList.insertBefore(historyItem, historyList.firstChild);
            });
        }
    }
    
    function updateTuningOptions() {
        const instrumentSelect = document.getElementById('instrument-select');
        const tuningSelect = document.getElementById('tuning-select');
        const selectedInstrument = instrumentSelect.value;
        
        // Clear current options
        tuningSelect.innerHTML = '';
        
        // Add new options based on selected instrument
        tuningOptions[selectedInstrument].forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            tuningSelect.appendChild(optionElement);
        });
    }
    
    async function startTranscription() {
        if (!selectedFile) {
            alert('Please select an audio file');
            return;
        }
        
        // Hide options, show processing
        dropZone.classList.add('hidden');
        optionsPanel.classList.add('hidden');
        processingContainer.classList.remove('hidden');
        
        // Prepare form data
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        try {
            // Upload file
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                currentJobId = data.job_id;
                statusMessage.textContent = 'Processing audio...';
                progressIndicator.style.width = '25%';
                
                // Save to history - with safety checks for form elements
                try {
                    const instrumentSelect = document.getElementById('instrument-select');
                    const tuningSelect = document.getElementById('tuning-select');
                    const tempoInput = document.getElementById('tempo-input');
                    
                    saveToHistory(selectedFile, currentJobId, {
                        instrument: instrumentSelect ? instrumentSelect.value : 'bass',
                        tuning: tuningSelect ? tuningSelect.value : 'standard',
                        tempo: (tempoInput && tempoInput.value) ? tempoInput.value : '120'
                    });
                } catch (historyError) {
                    console.error('Error saving to history:', historyError);
                    // Don't stop the main process if history saving fails
                }
                
                // Start polling for status
                checkStatus();
                statusCheckInterval = setInterval(checkStatus, 2000); // Check every 2 seconds
                
                // Backup timeout to prevent getting stuck in processing
                // If after 30 seconds we're still processing, force a transition
                clearTimeout(processingTimeout); // Clear any existing timeout
                processingTimeout = setTimeout(() => {
                    console.log('BACKUP TIMEOUT: Processing taking too long, forcing transition');
                    if (statusCheckInterval) {
                        clearInterval(statusCheckInterval);
                        statusCheckInterval = null;
                    }
                    
                    try {
                        // Try to get results anyway
                        statusMessage.textContent = 'Auto-checking for results...';
                        progressIndicator.style.width = '100%';
                        showResults();
                    } catch (error) {
                        console.error('Error in backup timeout handler:', error);
                        showError('Processing timeout. Please try again.');
                    }
                }, 30000); // 30 second timeout
            } else {
                showError(`Upload failed: ${data.detail || 'Unknown error'}`);
            }
        } catch (error) {
            showError(`Error: ${error.message}`);
        }
    }
    
    // Global timeout to prevent getting stuck in processing
    let processingTimeout = null;

    async function checkStatus() {
        if (!currentJobId) {
            console.log('No current job ID, skipping status check');
            return;
        }
        
        try {
            console.log('Checking status for job:', currentJobId);
            const response = await fetch(`/status/${currentJobId}`);
            console.log('Status response received:', response.status);
            
            if (!response.ok) {
                console.error('Error in status response:', response.status, response.statusText);
                showError(`Server error: ${response.status} ${response.statusText}`);
                return;
            }
            
            const data = await response.json();
            console.log('Status data:', data);  // Debug log
            
            switch (data.status) {
                case 'PENDING':
                    console.log('Job status: PENDING');
                    statusMessage.textContent = 'In queue...';
                    progressIndicator.style.width = '25%';
                    break;
                    
                case 'PROCESSING':
                    console.log('Job status: PROCESSING');
                    statusMessage.textContent = 'Processing audio...';
                    progressIndicator.style.width = '50%';
                    break;
                    
                case 'COMPLETED':
                    console.log('Job status: COMPLETED - stopping interval and showing results');
                    // Make sure to clear any existing intervals or timeouts
                    clearInterval(statusCheckInterval);
                    statusCheckInterval = null;
                    clearTimeout(processingTimeout);
                    processingTimeout = null;
                    
                    statusMessage.textContent = 'Transcription complete!';
                    progressIndicator.style.width = '100%';
                    
                    // Force immediate hard transition to results view
                    console.log('DIRECT TRANSITION: Forcing transition to results');
                    statusMessage.textContent = 'Loading results...';
                    
                    // Use a try-catch to ensure we continue even if an error occurs
                    try {
                        // First, ensure the UI updates to show we're loading results
                        if (processingContainer) {
                            processingContainer.style.display = 'none';
                            processingContainer.classList.add('hidden');
                        }
                        if (resultsContainer) {
                            resultsContainer.style.display = 'block';
                            resultsContainer.classList.remove('hidden');
                        }
                        
                        // Then call the function to load results
                        showResults();
                    } catch (transitionError) {
                        console.error('Error during transition to results:', transitionError);
                        // Try again with a simple approach if the main approach fails
                        try {
                            if (processingContainer) processingContainer.classList.add('hidden');
                            if (resultsContainer) resultsContainer.classList.remove('hidden');
                            showResults();
                        } catch (fallbackError) {
                            console.error('Fallback transition also failed:', fallbackError);
                            showError('Failed to show results. Please refresh the page and try again.');
                        }
                    }
                    break;
                    
                case 'ERROR':
                    clearInterval(statusCheckInterval);
                    statusCheckInterval = null;
                    clearTimeout(processingTimeout);
                    processingTimeout = null;
                    showError(`Error: ${data.error || 'Unknown error'}`);
                    break;
                    
                default:
                    statusMessage.textContent = `Status: ${data.status}`;
            }
        } catch (error) {
            console.error('Status check error:', error);  // Detailed error logging
            showError(`Error checking status: ${error.message}`);
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
            clearTimeout(processingTimeout);
            processingTimeout = null;
        }
    }
    
    async function showResults() {
        console.log('showResults function called with jobId:', currentJobId);
        
        // Cancel any existing intervals and timeouts to avoid conflicts
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
        }
        if (processingTimeout) {
            clearTimeout(processingTimeout);
            processingTimeout = null;
        }
        
        try {
            // Ensure UI state is correct before continuing
            // This makes sure we don't get stuck in processing view
            if (processingContainer) {
                processingContainer.style.display = 'none';
                processingContainer.classList.add('hidden');
            }
            if (resultsContainer) {
                resultsContainer.style.display = 'block';
                resultsContainer.classList.remove('hidden');
            }
            
            // Update state tracking variables
            uploadSectionVisible = false;
            processingContainerVisible = false;
            resultsContainerVisible = true;
            
            // Now try to fetch the results for the job
            console.log('Attempting to fetch results for job:', currentJobId);
            // Fetch results with a timeout - don't get stuck on network requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            try {
                const response = await fetch(`/result/${currentJobId}?format=json`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                console.log('Result response received:', response.status, response.statusText);
                
                if (response.ok) {
                    console.log('Response is OK, parsing JSON...');
                    const resultData = await response.json();
                    console.log('Result data parsed successfully:', resultData);
                    
                    // Display tablature - check if element exists
                    console.log('Finding tablature display element');
                    const tablatureDisplay = document.getElementById('tablature-display');
                    if (!tablatureDisplay) {
                        console.error('tablature-display element not found!');
                    } else if (resultData.tablature) {
                        console.log('Rendering tablature with tablature data');
                        tablatureDisplay.innerHTML = renderTablature(resultData.tablature);
                    } else if (resultData.notes) {
                        console.log('Rendering tablature with raw notes data');
                        // If we have notes but no formatted tablature, create a simple representation
                        tablatureDisplay.innerHTML = renderSimpleTablature(resultData.notes);
                    } else {
                        console.log('No tablature data found');
                        tablatureDisplay.innerHTML = '<p>No tablature available</p>';
                    }
                    
                    // Display standard notation (if available)
                    console.log('Finding standard notation display element');
                    const standardNotationDisplay = document.getElementById('standard-notation-display');
                    if (standardNotationDisplay) {  // Check if element exists
                        if (resultData.standard_notation) {
                            console.log('Setting standard notation image');
                            standardNotationDisplay.innerHTML = `<img src="${resultData.standard_notation}" alt="Standard Notation">`;
                        } else {
                            console.log('No standard notation available');
                            standardNotationDisplay.innerHTML = '<p>Standard notation not available for MVP version</p>';
                        }
                    } else {
                        console.warn('standard-notation-display element not found');
                    }
                    
                    // Display chord chart (if available)
                    console.log('Finding chord chart display element');
                    const chordChartDisplay = document.getElementById('chord-chart-display');
                    if (chordChartDisplay) {  // Check if element exists
                        if (resultData.chord_chart) {
                            console.log('Rendering chord chart');
                            chordChartDisplay.innerHTML = renderChordChart(resultData.chord_chart);
                        } else {
                            console.log('No chord chart available');
                            chordChartDisplay.innerHTML = '<p>Chord chart not available for MVP version</p>';
                        }
                    } else {
                        console.warn('chord-chart-display element not found');
                    }
                    
                    // Set up audio player if it exists
                    console.log('Setting up audio player');
                    if (originalAudio) {
                        if (resultData.audio_url) {
                            console.log('Setting audio source');
                            originalAudio.src = resultData.audio_url;
                        } else {
                            console.log('No audio URL available');
                        }
                    } else {
                        console.warn('originalAudio element not found');
                    }
                } else {
                    console.error('Result response not OK:', response.status, response.statusText);
                    
                    // Try to get more detailed error information from the response
                    try {
                        const errorData = await response.json();
                        const errorDetail = errorData.detail || 'Unknown error';
                        console.error('Error detail:', errorDetail);
                        
                        // Check if this is a file missing error
                        if (errorDetail.includes('file no longer exists') || errorDetail.includes('audio file no longer exists')) {
                            // This is a case where the original file was deleted from the filesystem
                            showError(`The original audio file for this job has been deleted from the server.`);
                            
                            // Remove from history if the file no longer exists
                            removeFromHistory(currentJobId);
                        } else {
                            showError(`Failed to load results: ${errorDetail}`);
                        }
                    } catch (parseError) {
                        // If we can't parse the error response, show generic message
                        showError(`Failed to load results: ${response.status} ${response.statusText}`);
                    }
                }
            } catch (innerError) {
                // Handle errors from the fetch request
                clearTimeout(timeoutId);
                console.error('Error in fetch request:', innerError);
                showError(`Error retrieving results: ${innerError.message}`);
            }
        } catch (error) {
            console.error('Exception in showResults:', error);
            showError(`Error loading results: ${error.message}`);
            
            // Force UI update even on error - show some results
            if (processingContainer) processingContainer.classList.add('hidden');
            if (resultsContainer) resultsContainer.classList.remove('hidden');
            
            // Display error message in the results container
            const tablatureDisplay = document.getElementById('tablature-display');
            if (tablatureDisplay) {
                tablatureDisplay.innerHTML = `<div class="error-message"><h3>Error Processing Result</h3><p>${error.message}</p></div>`;
            }
        }
    }
    
    function renderTablature(tablatureData) {
        // Simple implementation - in a real app, use a dedicated library for rendering
        // This is just a basic ASCII-style representation
        let output = '<div class="tablature-container"><pre class="tablature">';
        
        if (tablatureData.strings && Array.isArray(tablatureData.strings)) {
            // Create an empty tab staff
            const strings = tablatureData.strings;
            const stringCount = strings.length;
            
            // ASCII tablature representation
            // Headers
            output += 'Bass Tablature:\n\n';
            
            // String labels and fret lines
            for (let i = 0; i < stringCount; i++) {
                const string = strings[i];
                output += `${string.name}:|`;
                
                // Create a 20-space line with notes placed at appropriate positions
                const line = Array(20).fill('-');
                
                // Place fret numbers on the line
                if (string.notes && Array.isArray(string.notes)) {
                    string.notes.forEach(note => {
                        // Basic positioning - this is simplified
                        const position = Math.floor(note.time * 4) + 1;
                        if (position < line.length) {
                            line[position] = note.fret.toString();
                        }
                    });
                }
                
                output += line.join('') + '|\n';
            }
        } else if (typeof tablatureData === 'string') {
            // Handle case where tablature is already formatted as a string
            output += tablatureData;
        } else {
            output += 'Tablature data format not supported';
        }
        
        output += '</pre></div>';
        return output;
    }
    
    function renderSimpleTablature(notes) {
        // Fallback function to render tablature from basic note data
        if (!notes || !Array.isArray(notes)) {
            return '<p>No tablature data available</p>';
        }
        
        // Bass guitar has 4 strings with indices 0-3
        const stringNames = ['G', 'D', 'A', 'E'];
        const tabLines = [
            `G:|${'-'.repeat(20)}|
`,
            `D:|${'-'.repeat(20)}|
`,
            `A:|${'-'.repeat(20)}|
`,
            `E:|${'-'.repeat(20)}|
`
        ];
        
        // Simple render of note positions
        notes.forEach(note => {
            // Only process notes that have string and fret information
            if (typeof note.string === 'number' && typeof note.fret === 'number') {
                const stringIndex = note.string;
                if (stringIndex >= 0 && stringIndex < tabLines.length) {
                    // Create a position based on note timing
                    const position = Math.floor(note.time * 4) + 2;  // *4 to space notes, +2 to offset from beginning
                    
                    // Replace the dash at position with the fret number
                    if (position < 20) {  // Stay within line bounds
                        const parts = tabLines[stringIndex].split('');
                        parts[position] = note.fret.toString();
                        tabLines[stringIndex] = parts.join('');
                    }
                }
            }
        });
        
        return `<div class="tablature-container"><pre class="tablature">Bass Tablature:

${tabLines.join('')}</pre></div>`;
    }
    
    function renderChordChart(chordData) {
        // Simple implementation - in a real app, use a dedicated library for rendering
        let output = '<div class="chord-chart">';
        
        if (Array.isArray(chordData)) {
            chordData.forEach(chord => {
                output += `<div class="chord"><h4>${chord.name}</h4><p>${chord.position}</p></div>`;
            });
        } else {
            output += '<p>No chord data available</p>';
        }
        
        output += '</div>';
        return output;
    }
    
    function downloadResult(format) {
        if (!currentJobId) return;
        
        window.open(`/result/${currentJobId}?format=${format}`, '_blank');
    }
    
    function showError(message) {
        console.error('Error:', message);
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.style.color = 'red';
        }
        if (progressIndicator) {
            progressIndicator.style.backgroundColor = 'red';
        }
        clearInterval(statusCheckInterval);
        
        // Make sure we're not stuck in the processing view
        setTimeout(() => {
            if (processingContainer && !processingContainer.classList.contains('hidden')) {
                console.log('Error occurred - returning to upload view');
                processingContainer.classList.add('hidden');
                
                // Show upload section again instead of results
                if (uploadSection) uploadSection.classList.remove('hidden');
                if (dropZone) dropZone.classList.remove('hidden');
                if (optionsPanel) optionsPanel.classList.add('hidden');
                
                // Reset the selected file
                selectedFile = null;
                currentJobId = null;
                
                // Alert the user about the error
                alert(`Error: ${message}\n\nPlease try again with a different file or settings.`);
            }
        }, 1500);  // Force UI update after 1.5 seconds if still stuck
    }
    
    // Helper function to select a history item
    function selectHistoryItem(item) {
        console.log('Selected history item:', item);
        
        if (!item || !item.jobId) {
            console.error('Invalid history item or missing job ID');
            alert('Sorry, this history item cannot be loaded.');
            return;
        }
        
        try {
            // We can't directly load the file from history since browsers don't allow storing File objects
            // Instead, we'll use the job ID to load the previous result
            currentJobId = item.jobId;
            
            // Reset UI states
            uploadSectionVisible = false;
            processingContainerVisible = true;
            resultsContainerVisible = false;
            
            // Update UI visibility
            if (uploadSection) uploadSection.classList.add('hidden');
            if (dropZone) dropZone.classList.add('hidden');
            if (optionsPanel) optionsPanel.classList.add('hidden');
            if (processingContainer) processingContainer.classList.remove('hidden');
            if (resultsContainer) resultsContainer.classList.add('hidden');
            
            // Update status display
            if (statusMessage) statusMessage.textContent = 'Loading previous result...';
            if (progressIndicator) {
                progressIndicator.style.backgroundColor = '#4CAF50'; // Reset to green
                progressIndicator.style.width = '50%';
            }
            
            // Check if the job result exists first
            fetch(`/result/${currentJobId}?format=json`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Result not found (Status ${response.status})`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Result exists, proceed with showing it
                    if (progressIndicator) progressIndicator.style.width = '100%';
                    if (statusMessage) statusMessage.textContent = 'Loading complete!';
                    
                    setTimeout(() => {
                        showResults();
                    }, 500);
                })
                .catch(async error => {
                    console.error('Error loading history item:', error);
                    
                    // Try to determine if this is due to a missing file
                    try {
                        // Check job status to see if the file is missing
                        const statusResponse = await fetch(`/status/${currentJobId}`);
                        if (statusResponse.ok) {
                            const statusData = await statusResponse.json();
                            console.log('Job status for failed history item:', statusData);
                            
                            // If job is in error state with a message about missing files
                            if (statusData.status === 'error' && statusData.error && 
                                (statusData.error.includes('file no longer exists') || 
                                 statusData.error.includes('audio file no longer exists'))) {
                                
                                console.log('Detected missing file, removing from history');
                                showError(`The original audio file has been deleted. Removing from history.`);
                                
                                // Remove the item from history
                                removeFromHistory(currentJobId);
                                
                                // Return to the upload screen
                                setTimeout(() => {
                                    resetToUploadScreen();
                                }, 2000);
                                
                                return;
                            }
                        }
                    } catch (statusError) {
                        console.error('Error checking job status:', statusError);
                    }
                    
                    // Default error message if not a missing file
                    showError(`Could not load the previous result: ${error.message}`);
                });
        } catch (error) {
            console.error('Error in selectHistoryItem:', error);
            showError(`Error loading history item: ${error.message}`);
        }
    }
    
    // Function to reset UI to the upload screen
    function resetToUploadScreen() {
        // Reset state variables
        uploadSectionVisible = true;
        processingContainerVisible = false;
        resultsContainerVisible = false;
        
        // Update UI visibility
        if (uploadSection) uploadSection.classList.remove('hidden');
        if (dropZone) dropZone.classList.remove('hidden');
        if (optionsPanel) optionsPanel.classList.remove('hidden');
        if (processingContainer) processingContainer.classList.add('hidden');
        if (resultsContainer) resultsContainer.classList.add('hidden');
        
        // Reset file selection
        selectedFile = null;
        if (fileNameDisplay) fileNameDisplay.textContent = '';
        
        // Reset progress
        if (progressIndicator) {
            progressIndicator.style.backgroundColor = '#4CAF50';
            progressIndicator.style.width = '0%';
        }
        if (statusMessage) statusMessage.textContent = '';
    }
    
    // Initialize the application
    function init() {
        // Initialize the tuning options
        updateTuningOptions();
        
        // Load history from localStorage
        loadHistory();
    }
    
    // Initialize the app when DOM is ready
    init();
});
