/**
 * demoMode.js
 * Helper functionality to make the demo mode work better
 */

/**
 * Set up additional handlers specifically for demo mode
 * This ensures the file upload process works even with the limited server
 */
function setupDemoModeHandlers() {
    console.log('Setting up Demo Mode handlers');

    // Add a simulated file for faster testing if no files are selected
    const createDemoFile = () => {
        // Create a simulated file object (this will be detected by our demo mode)
        const blob = new Blob(['demo audio content'], { type: 'audio/mp3' });
        return new File([blob], 'demo_audio_file.mp3', { type: 'audio/mp3', lastModified: new Date() });
    };
    
    // Add a handler for the upload button that also works if file selection fails
    const startTranscriptionBtn = document.getElementById('start-transcription-btn');
    if (startTranscriptionBtn) {
        // Add a second click handler that ensures we have a file
        startTranscriptionBtn.addEventListener('click', () => {
            // Get the current selected file
            const selectedFile = UIController.getSelectedFile();
            
            if (!selectedFile) {
                console.log('No file selected in demo mode, creating a simulated file');
                // Create a demo file and set it
                const demoFile = createDemoFile();
                // Handle the file in UI controller
                UIController.handleFile(demoFile);
                // Set a short timeout to allow the file to be registered before starting
                setTimeout(() => {
                    // Now try starting the transcription with our demo file
                    HistoryManager.notifyTranscriptionStarted(demoFile);
                }, 100);
            }
        });
        
        // Make the button more prominent in demo mode
        startTranscriptionBtn.style.backgroundColor = '#4CAF50';
        startTranscriptionBtn.style.color = 'white';
        startTranscriptionBtn.style.fontWeight = 'bold';
        startTranscriptionBtn.textContent = 'Start Demo Transcription';
    }
    
    // Add a demo mode indicator
    const header = document.querySelector('header');
    if (header) {
        const demoIndicator = document.createElement('div');
        demoIndicator.style.background = '#ff9800';
        demoIndicator.style.color = 'white';
        demoIndicator.style.padding = '5px 10px';
        demoIndicator.style.borderRadius = '3px';
        demoIndicator.style.margin = '10px 0';
        demoIndicator.style.fontWeight = 'bold';
        demoIndicator.style.textAlign = 'center';
        demoIndicator.innerHTML = '🚀 DEMO MODE - No real API connection required';
        header.appendChild(demoIndicator);
    }

    // Add a drop zone click enhancement
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        // Add a simulated file drop feature - clicking anywhere creates a demo file
        dropZone.addEventListener('click', (e) => {
            // Don't interfere with normal file input clicks
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') {
                return;
            }

            console.log('Drop zone clicked in demo mode - creating mock file');
            const demoFile = createDemoFile();
            UIController.handleFile(demoFile);
        });

        // Add an indicator that this is a demo drop zone
        const hint = dropZone.querySelector('.hint');
        if (hint) {
            hint.textContent = 'Demo Mode: Click anywhere to create a test file';
            hint.style.color = '#ff9800';
            hint.style.fontWeight = 'bold';
        }
    }
}

// Detect if we're in demo mode
const isDemoMode = () => {
    return window.location.port === '8000';
};

// Auto-initialize if we're in demo mode
if (isDemoMode()) {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Demo mode detected, will initialize helpers');
        setupDemoModeHandlers();
    });
}
