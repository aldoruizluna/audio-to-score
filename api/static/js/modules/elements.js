/**
 * elements.js
 * Module that handles element caching and DOM references
 */

const ElementsController = (function() {
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
         * Initialize and cache DOM elements
         */
        init: function() {
            cacheElements();
            return this;
        },
        
        /**
         * Get UI elements
         * @returns {Object} - Cached UI elements
         */
        getElements: function() {
            return elements;
        },
        
        /**
         * Refresh element cache (useful after DOM changes)
         */
        refreshCache: function() {
            cacheElements();
            return this;
        }
    };
})();

export default ElementsController;
