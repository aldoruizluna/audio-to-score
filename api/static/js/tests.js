/**
 * tests.js
 * Simple testing framework for the Audio-to-Score application
 */

const TestRunner = (function() {
    // Test results storage
    const testResults = [];
    let totalTests = 0;
    let passedTests = 0;
    
    /**
     * Assert that a condition is true
     * @param {string} testName - Name of the test
     * @param {boolean} condition - Condition to test
     * @param {string} message - Message to display on failure
     */
    function assert(testName, condition, message) {
        totalTests++;
        const result = {
            name: testName,
            passed: condition,
            message: message || 'Test failed'
        };
        
        testResults.push(result);
        
        if (condition) {
            passedTests++;
            console.log(`✅ PASS: ${testName}`);
        } else {
            console.error(`❌ FAIL: ${testName} - ${message}`);
        }
    }
    
    /**
     * Run all tests and display results
     */
    function runAllTests() {
        console.log('📋 Starting Audio-to-Score tests...');
        console.log('============================================');
        
        // Test module existence
        console.log('🔍 TESTING MODULE EXISTENCE:');
        testModuleExistence();
        
        // Test UI Controller
        console.log('🔍 TESTING UI CONTROLLER:');
        testUIController();
        
        // Test History Manager
        console.log('🔍 TESTING HISTORY MANAGER:');
        testHistoryManager();
        
        // Test Result Renderer
        console.log('🔍 TESTING RESULT RENDERER:');
        testResultRenderer();
        
        // Test Audio Processor
        console.log('🔍 TESTING AUDIO PROCESSOR:');
        testAudioProcessor();
        
        // Log summary
        console.log('============================================');
        console.log(`🏁 TEST SUMMARY: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
        if (passedTests === totalTests) {
            console.log('🎉 ALL TESTS PASSED! The refactoring was successful!');
        } else {
            console.log(`⚠️ ${totalTests - passedTests} test(s) failed. Review the failures above.`);
        }
        console.log('============================================');
        
        // Display results in the UI
        displayResults();
    }
    
    /**
     * Test that all required modules exist
     */
    function testModuleExistence() {
        assert('AudioProcessor module exists', 
            typeof AudioProcessor !== 'undefined', 
            'AudioProcessor module is missing');
            
        assert('UIController module exists', 
            typeof UIController !== 'undefined', 
            'UIController module is missing');
            
        assert('HistoryManager module exists', 
            typeof HistoryManager !== 'undefined', 
            'HistoryManager module is missing');
            
        assert('ResultRenderer module exists', 
            typeof ResultRenderer !== 'undefined', 
            'ResultRenderer module is missing');
    }
    
    /**
     * Test UI Controller functionality
     */
    function testUIController() {
        // Test existence of key methods
        assert('UIController.init exists', 
            typeof UIController.init === 'function', 
            'UIController.init is not a function');
            
        assert('UIController.getElements exists', 
            typeof UIController.getElements === 'function', 
            'UIController.getElements is not a function');
            
        assert('UIController.showError exists', 
            typeof UIController.showError === 'function', 
            'UIController.showError is not a function');
            
        // Test UI state management - can only be done if properly initialized
        try {
            const elements = UIController.getElements();
            assert('UIController elements initialized', 
                elements !== null && typeof elements === 'object', 
                'UIController elements not properly initialized');
        } catch (e) {
            assert('UIController elements initialization', false, 
                `Error accessing UI elements: ${e.message}`);
        }
    }
    
    /**
     * Test History Manager functionality
     */
    function testHistoryManager() {
        // Test existence of key methods
        assert('HistoryManager.init exists', 
            typeof HistoryManager.init === 'function', 
            'HistoryManager.init is not a function');
            
        assert('HistoryManager.getHistory exists', 
            typeof HistoryManager.getHistory === 'function', 
            'HistoryManager.getHistory is not a function');
            
        assert('HistoryManager.saveToHistory exists', 
            typeof HistoryManager.saveToHistory === 'function', 
            'HistoryManager.saveToHistory is not a function');
            
        // Test history initial loading
        try {
            const history = HistoryManager.getHistory();
            assert('HistoryManager returns history array', 
                Array.isArray(history), 
                'HistoryManager.getHistory should return an array');
        } catch (e) {
            assert('HistoryManager history initialization', false, 
                `Error accessing history: ${e.message}`);
        }
    }
    
    /**
     * Test Result Renderer functionality
     */
    function testResultRenderer() {
        // Test existence of key methods
        assert('ResultRenderer.renderTablature exists', 
            typeof ResultRenderer.renderTablature === 'function', 
            'ResultRenderer.renderTablature is not a function');
            
        assert('ResultRenderer.renderSimpleTablature exists', 
            typeof ResultRenderer.renderSimpleTablature === 'function', 
            'ResultRenderer.renderSimpleTablature is not a function');
            
        // Test simple tablature rendering with empty data
        try {
            const emptyResult = ResultRenderer.renderSimpleTablature([]);
            assert('ResultRenderer handles empty notes array', 
                typeof emptyResult === 'string' && emptyResult.includes('No tablature data'), 
                'ResultRenderer should handle empty notes array gracefully');
        } catch (e) {
            assert('ResultRenderer empty data handling', false, 
                `Error in simple tablature rendering: ${e.message}`);
        }
    }
    
    /**
     * Test Audio Processor functionality
     */
    function testAudioProcessor() {
        // Test existence of key methods
        assert('AudioProcessor.setCurrentJobId exists', 
            typeof AudioProcessor.setCurrentJobId === 'function', 
            'AudioProcessor.setCurrentJobId is not a function');
            
        assert('AudioProcessor.getCurrentJobId exists', 
            typeof AudioProcessor.getCurrentJobId === 'function', 
            'AudioProcessor.getCurrentJobId is not a function');
            
        // Test job ID setting/getting
        try {
            const testJobId = 'test-job-id-' + Date.now();
            AudioProcessor.setCurrentJobId(testJobId);
            const retrievedId = AudioProcessor.getCurrentJobId();
            
            assert('AudioProcessor job ID getter/setter works', 
                retrievedId === testJobId, 
                `AudioProcessor job ID getter/setter failed: got ${retrievedId}, expected ${testJobId}`);
        } catch (e) {
            assert('AudioProcessor job ID management', false, 
                `Error in job ID management: ${e.message}`);
        }
    }
    
    /**
     * Display test results in the UI
     */
    function displayResults() {
        const testResultsContainer = document.createElement('div');
        testResultsContainer.className = 'test-results';
        testResultsContainer.style.cssText = 'position: fixed; top: 10px; right: 10px; ' + 
            'background: #f5f5f5; border: 1px solid #ddd; padding: 15px; ' + 
            'box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 9999; max-width: 400px; ' + 
            'max-height: 80vh; overflow-y: auto; border-radius: 5px;';
        
        // Add header
        const header = document.createElement('h3');
        header.textContent = `Tests: ${passedTests}/${totalTests} passed`;
        header.style.margin = '0 0 10px 0';
        header.style.color = passedTests === totalTests ? 'green' : 'red';
        testResultsContainer.appendChild(header);
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.cssText = 'position: absolute; top: 10px; right: 10px; ' + 
            'background: #ddd; border: none; padding: 5px 10px; cursor: pointer; ' + 
            'border-radius: 3px;';
        closeButton.onclick = function() {
            document.body.removeChild(testResultsContainer);
        };
        testResultsContainer.appendChild(closeButton);
        
        // Add test results
        testResults.forEach(result => {
            const testEl = document.createElement('div');
            testEl.className = 'test-result';
            testEl.style.cssText = 'margin: 5px 0; padding: 5px; ' + 
                `border-left: 3px solid ${result.passed ? 'green' : 'red'};`;
            
            const statusIndicator = result.passed ? '✅' : '❌';
            testEl.innerHTML = `<strong>${statusIndicator} ${result.name}</strong>`;
            
            if (!result.passed) {
                const errorMsg = document.createElement('div');
                errorMsg.style.cssText = 'margin-top: 3px; color: red; font-size: 0.9em;';
                errorMsg.textContent = result.message;
                testEl.appendChild(errorMsg);
            }
            
            testResultsContainer.appendChild(testEl);
        });
        
        document.body.appendChild(testResultsContainer);
    }
    
    // Reset test results
    function resetTestResults() {
        testResults.length = 0;
        totalTests = 0;
        passedTests = 0;
    }
    
    // Public API
    return {
        runAllTests: function() {
            resetTestResults();
            runAllTests();
        },
        testModuleExistence: function() {
            resetTestResults();
            testModuleExistence();
            displayResults();
        },
        testUIController: function() {
            resetTestResults();
            testUIController();
            displayResults();
        },
        testHistoryManager: function() {
            resetTestResults();
            testHistoryManager();
            displayResults();
        },
        testResultRenderer: function() {
            resetTestResults();
            testResultRenderer();
            displayResults();
        },
        testAudioProcessor: function() {
            resetTestResults();
            testAudioProcessor();
            displayResults();
        }
    };
})();
