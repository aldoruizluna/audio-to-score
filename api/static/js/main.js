/**
 * main.js
 * Entry point for the Audio-to-Score Transcription System
 * Coordinates all modules and initializes the application
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all modules
    UIController.init();
    HistoryManager.init();
    
    console.log('Audio-to-Score Transcription System initialized');
    
    // Add direct connection between file selection and start button in demo mode
    if (window.location.port === '8000') { // Running on Python's SimpleHTTPServer
        console.log('Running in demo mode - setting up additional handlers');
        setupDemoModeHandlers();
    }
    
    // Check if we should run tests (via URL parameter or keyboard shortcut)
    checkAndRunTests();
});

/**
 * Check if tests should be run and execute them if needed
 * Provides multiple ways to trigger tests for better developer experience
 */
function checkAndRunTests() {
    // Check for test parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const runTests = urlParams.get('test') === 'true';
    
    if (runTests) {
        // Run tests after a short delay to ensure all modules are fully initialized
        setTimeout(() => {
            console.log('Running automated tests...');
            TestRunner.runAllTests();
        }, 500);
    }
    
    // Set up keyboard shortcut for running tests (Ctrl+Shift+T)
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey && event.key === 'T') {
            event.preventDefault();
            console.log('Running tests via keyboard shortcut...');
            TestRunner.runAllTests();
        }
    });
    
    // Add a test button that provides visual feedback
    const testButton = document.createElement('button');
    testButton.id = 'run-tests-btn';
    testButton.textContent = 'Run Tests';
    testButton.style.cssText = 'position: fixed; bottom: 10px; right: 10px; ' +
        'background: #f5f5f5; border: 1px solid #ddd; padding: 8px 12px; ' +
        'z-index: 9999; opacity: 0.7; border-radius: 4px; cursor: pointer; ' +
        'font-family: "Roboto", sans-serif; font-size: 14px; ' +
        'box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.3s ease;';
    
    // Add hover effect
    testButton.addEventListener('mouseover', () => {
        testButton.style.opacity = '1';
        testButton.style.boxShadow = '0 3px 6px rgba(0,0,0,0.3)';
        testButton.style.background = '#e0e0e0';
    });
    
    testButton.addEventListener('mouseout', () => {
        testButton.style.opacity = '0.7';
        testButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        testButton.style.background = '#f5f5f5';
    });
    
    testButton.addEventListener('click', () => {
        console.log('Running tests via test button...');
        // Visual feedback that tests are running
        testButton.style.background = '#bde0fe'; // Light blue while running
        testButton.textContent = 'Running Tests...';
        testButton.disabled = true;
        
        // Run tests after a brief delay to show the button state change
        setTimeout(() => {
            TestRunner.runAllTests();
            // Reset button after tests complete
            setTimeout(() => {
                testButton.style.background = '#f5f5f5';
                testButton.textContent = 'Run Tests';
                testButton.disabled = false;
            }, 500);
        }, 100);
    });
    
    // Add tooltip
    testButton.title = 'Run diagnostic tests (Ctrl+Shift+T)';
    
    document.body.appendChild(testButton);
    
    // Show a console message about test availability
    console.info('🧪 Testing is available via:\n- URL parameter: ?test=true\n- Keyboard shortcut: Ctrl+Shift+T\n- Test button in bottom-right corner');
}
