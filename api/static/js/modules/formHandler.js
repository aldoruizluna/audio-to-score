/**
 * formHandler.js
 * Module for handling form data, validation, and option updates
 */

import ElementsController from './elements.js';

const FormHandler = (function() {
    // Default values
    const DEFAULT_TEMPO = 120;
    
    /**
     * Update tuning options based on selected instrument
     */
    function updateTuningOptions() {
        const elements = ElementsController.getElements();
        if (!elements.instrumentSelect || !elements.tuningSelect) return;
        
        const instrument = elements.instrumentSelect.value;
        const tuningSelect = elements.tuningSelect;
        
        // Clear existing options
        while (tuningSelect.firstChild) {
            tuningSelect.removeChild(tuningSelect.firstChild);
        }
        
        // Add new options based on instrument
        if (instrument === 'guitar') {
            const guitarTunings = [
                { value: 'standard', text: 'Standard (E A D G B E)' },
                { value: 'dropD', text: 'Drop D (D A D G B E)' },
                { value: 'openG', text: 'Open G (D G D G B D)' },
                { value: 'dadgad', text: 'DADGAD (D A D G A D)' },
                { value: 'halfStepDown', text: 'Half Step Down (Eb Ab Db Gb Bb Eb)' }
            ];
            
            guitarTunings.forEach(tuning => {
                const option = document.createElement('option');
                option.value = tuning.value;
                option.textContent = tuning.text;
                tuningSelect.appendChild(option);
            });
        } else if (instrument === 'bass') {
            const bassTunings = [
                { value: 'standard', text: 'Standard 4-string (E A D G)' },
                { value: 'dropD', text: 'Drop D (D A D G)' },
                { value: '5string', text: '5-string (B E A D G)' },
                { value: 'halfStepDown', text: 'Half Step Down (Eb Ab Db Gb)' }
            ];
            
            bassTunings.forEach(tuning => {
                const option = document.createElement('option');
                option.value = tuning.value;
                option.textContent = tuning.text;
                tuningSelect.appendChild(option);
            });
        } else {
            // Default option for other instruments
            const option = document.createElement('option');
            option.value = 'standard';
            option.textContent = 'Standard';
            tuningSelect.appendChild(option);
        }
    }
    
    /**
     * Validate form input
     * @returns {boolean} - Whether the form is valid
     */
    function validateForm() {
        const elements = ElementsController.getElements();
        if (!elements.tempoInput) return true;
        
        const tempo = parseInt(elements.tempoInput.value, 10);
        return !isNaN(tempo) && tempo > 0 && tempo <= 300;
    }
    
    // Public API
    return {
        /**
         * Initialize form with default values
         */
        initForm: function() {
            const elements = ElementsController.getElements();
            if (elements.tempoInput) {
                elements.tempoInput.value = DEFAULT_TEMPO;
            }
            
            this.updateTuningOptions();
            return this;
        },
        
        /**
         * Update tuning options based on selected instrument
         */
        updateTuningOptions: function() {
            updateTuningOptions();
            return this;
        },
        
        /**
         * Get form data for transcription
         * @returns {Object} - Form data including instrument, tuning, tempo
         */
        getFormData: function() {
            const elements = ElementsController.getElements();
            return {
                instrument: elements.instrumentSelect ? elements.instrumentSelect.value : 'guitar',
                tuning: elements.tuningSelect ? elements.tuningSelect.value : 'standard',
                tempo: elements.tempoInput ? parseInt(elements.tempoInput.value, 10) : DEFAULT_TEMPO
            };
        },
        
        /**
         * Validate form input
         * @returns {boolean} - Whether the form is valid
         */
        isValid: function() {
            return validateForm();
        }
    };
})();

export default FormHandler;
