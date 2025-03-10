/**
 * test-runner.js
 * Command-line test runner for our refactored JavaScript modules
 */

// Mock browser environment objects needed by our modules
global.document = {
    createElement: () => ({
        className: '',
        style: {},
        innerHTML: '',
        appendChild: () => {},
        addEventListener: () => {}
    }),
    addEventListener: () => {}
};

global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

global.console = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
};

// Mock our modules
global.UIController = {
    init: () => {},
    getElements: () => ({
        fileNameDisplay: {},
        historyList: {},
        noHistoryMessage: { classList: { add: () => {}, remove: () => {} } }
    }),
    showError: () => {},
    showProcessingView: () => {}, 
    updateStatus: () => {},
    showResultsView: () => {},
    resetToUploadScreen: () => {},
    getFormData: () => ({})
};

global.AudioProcessor = {
    setCurrentJobId: (id) => { global.AudioProcessor.currentJobId = id; },
    getCurrentJobId: () => global.AudioProcessor.currentJobId,
    getJobResult: () => Promise.resolve({}),
    checkJobExists: () => Promise.resolve({ status: 'success' }),
    uploadAndProcess: () => {}
};

global.HistoryManager = {
    init: () => {},
    getHistory: () => [],
    saveToHistory: () => {},
    removeFromHistory: () => {},
    renderHistoryList: () => {},
    selectHistoryItem: () => {}
};

global.ResultRenderer = {
    displayResults: () => {},
    renderTablature: () => '',
    renderSimpleTablature: (notes) => {
        if (!notes || !Array.isArray(notes) || notes.length === 0) {
            return '<p>No tablature data available</p>';
        }
        return '<div class="tablature-container"></div>';
    },
    renderChordChart: () => ''
};

// Define TestRunner
global.TestRunner = {
    testResults: [],
    totalTests: 0,
    passedTests: 0,
    
    assert: function(testName, condition, message) {
        this.totalTests++;
        const result = {
            name: testName,
            passed: condition,
            message: message || 'Test failed'
        };
        
        this.testResults.push(result);
        
        if (condition) {
            this.passedTests++;
            console.log(`✅ PASS: ${testName}`);
        } else {
            console.error(`❌ FAIL: ${testName} - ${message}`);
        }
    },
    
    runAllTests: function() {
        this.resetTestResults();
        
        console.log('📋 Starting Audio-to-Score tests...');
        console.log('============================================');
        
        // Test module existence
        console.log('🔍 TESTING MODULE EXISTENCE:');
        this.testModuleExistence();
        
        // Test UI Controller
        console.log('\n🔍 TESTING UI CONTROLLER:');
        this.testUIController();
        
        // Test History Manager
        console.log('\n🔍 TESTING HISTORY MANAGER:');
        this.testHistoryManager();
        
        // Test Result Renderer
        console.log('\n🔍 TESTING RESULT RENDERER:');
        this.testResultRenderer();
        
        // Test Audio Processor
        console.log('\n🔍 TESTING AUDIO PROCESSOR:');
        this.testAudioProcessor();
        
        // Log summary
        console.log('\n============================================');
        console.log(`🏁 TEST SUMMARY: ${this.passedTests}/${this.totalTests} tests passed (${Math.round(this.passedTests/this.totalTests*100)}%)`);
        if (this.passedTests === this.totalTests) {
            console.log('🎉 ALL TESTS PASSED! The refactoring was successful!');
        } else {
            console.log(`⚠️ ${this.totalTests - this.passedTests} test(s) failed. Review the failures above.`);
        }
        console.log('============================================');
    },
    
    testModuleExistence: function() {
        this.assert('AudioProcessor module exists', 
            typeof AudioProcessor !== 'undefined', 
            'AudioProcessor module is missing');
            
        this.assert('UIController module exists', 
            typeof UIController !== 'undefined', 
            'UIController module is missing');
            
        this.assert('HistoryManager module exists', 
            typeof HistoryManager !== 'undefined', 
            'HistoryManager module is missing');
            
        this.assert('ResultRenderer module exists', 
            typeof ResultRenderer !== 'undefined', 
            'ResultRenderer module is missing');
    },
    
    testUIController: function() {
        // Test existence of key methods
        this.assert('UIController.init exists', 
            typeof UIController.init === 'function', 
            'UIController.init is not a function');
            
        this.assert('UIController.getElements exists', 
            typeof UIController.getElements === 'function', 
            'UIController.getElements is not a function');
            
        this.assert('UIController.showError exists', 
            typeof UIController.showError === 'function', 
            'UIController.showError is not a function');
    },
    
    testHistoryManager: function() {
        // Test existence of key methods
        this.assert('HistoryManager.init exists', 
            typeof HistoryManager.init === 'function', 
            'HistoryManager.init is not a function');
            
        this.assert('HistoryManager.getHistory exists', 
            typeof HistoryManager.getHistory === 'function', 
            'HistoryManager.getHistory is not a function');
            
        this.assert('HistoryManager.saveToHistory exists', 
            typeof HistoryManager.saveToHistory === 'function', 
            'HistoryManager.saveToHistory is not a function');
    },
    
    testResultRenderer: function() {
        // Test existence of key methods
        this.assert('ResultRenderer.renderTablature exists', 
            typeof ResultRenderer.renderTablature === 'function', 
            'ResultRenderer.renderTablature is not a function');
            
        this.assert('ResultRenderer.renderSimpleTablature exists', 
            typeof ResultRenderer.renderSimpleTablature === 'function', 
            'ResultRenderer.renderSimpleTablature is not a function');
            
        // Test simple tablature rendering with empty data
        const emptyResult = ResultRenderer.renderSimpleTablature([]);
        this.assert('ResultRenderer handles empty notes array', 
            typeof emptyResult === 'string' && emptyResult.includes('No tablature data'), 
            'ResultRenderer should handle empty notes array gracefully');
    },
    
    testAudioProcessor: function() {
        // Test existence of key methods
        this.assert('AudioProcessor.setCurrentJobId exists', 
            typeof AudioProcessor.setCurrentJobId === 'function', 
            'AudioProcessor.setCurrentJobId is not a function');
            
        this.assert('AudioProcessor.getCurrentJobId exists', 
            typeof AudioProcessor.getCurrentJobId === 'function', 
            'AudioProcessor.getCurrentJobId is not a function');
            
        // Test job ID setting/getting
        const testJobId = 'test-job-id-' + Date.now();
        AudioProcessor.setCurrentJobId(testJobId);
        const retrievedId = AudioProcessor.getCurrentJobId();
        
        this.assert('AudioProcessor job ID getter/setter works', 
            retrievedId === testJobId, 
            `AudioProcessor job ID getter/setter failed: got ${retrievedId}, expected ${testJobId}`);
    },
    
    resetTestResults: function() {
        this.testResults = [];
        this.totalTests = 0;
        this.passedTests = 0;
    }
};

// Run all tests
TestRunner.runAllTests();
