/**
 * resultRenderer.js
 * Module responsible for rendering and displaying transcription results
 */

const ResultRenderer = (function() {
    // Public API
    return {
        /**
         * Load and display results for a job
         * @param {string} jobId - The job ID to load results for
         */
        loadAndDisplayResults: async function(jobId) {
            try {
                const resultData = await AudioProcessor.getJobResult(jobId);
                console.log('Result data loaded successfully:', resultData);
                this.displayResults(resultData);
                UIController.showResultsView();
            } catch (error) {
                console.error('Error loading results:', error);
                UIController.showError(`Error retrieving results: ${error.message}`);
            }
        },
        
        /**
         * Display the results in the UI
         * @param {Object} resultData - The transcription result data
         */
        displayResults: function(resultData) {
            const elements = UIController.getElements();
            if (!elements) return;
            
            // Display tablature
            const tablatureDisplay = document.getElementById('tablature-display');
            if (tablatureDisplay) {
                if (resultData.tablature) {
                    tablatureDisplay.innerHTML = this.renderTablature(resultData.tablature);
                } else if (resultData.notes) {
                    // If we have notes but no formatted tablature, create a simple representation
                    tablatureDisplay.innerHTML = this.renderSimpleTablature(resultData.notes);
                } else {
                    tablatureDisplay.innerHTML = '<p>No tablature available</p>';
                }
            }
            
            // Display standard notation (if available)
            const standardNotationDisplay = document.getElementById('standard-notation-display');
            if (standardNotationDisplay) {
                if (resultData.standard_notation) {
                    standardNotationDisplay.innerHTML = `<img src="${resultData.standard_notation}" alt="Standard Notation">`;
                } else {
                    standardNotationDisplay.innerHTML = '<p>Standard notation not available for MVP version</p>';
                }
            }
            
            // Display chord chart (if available)
            const chordChartDisplay = document.getElementById('chord-chart-display');
            if (chordChartDisplay) {
                if (resultData.chord_chart) {
                    chordChartDisplay.innerHTML = this.renderChordChart(resultData.chord_chart);
                } else {
                    chordChartDisplay.innerHTML = '<p>Chord chart not available for MVP version</p>';
                }
            }
            
            // Set up audio player if it exists
            const originalAudio = elements.originalAudio;
            if (originalAudio) {
                if (resultData.audio_url) {
                    originalAudio.src = resultData.audio_url;
                }
            }
        },
        
        /**
         * Render tablature from tablature data
         * @param {Object|string} tablatureData - Tablature data to render
         * @returns {string} - HTML representation of the tablature
         */
        renderTablature: function(tablatureData) {
            // Simple implementation - in a real app, use a dedicated library for rendering
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
        },
        
        /**
         * Render simple tablature from note data
         * @param {Array} notes - Array of note objects
         * @returns {string} - HTML representation of the tablature
         */
        renderSimpleTablature: function(notes) {
            if (!notes || !Array.isArray(notes)) {
                return '<p>No tablature data available</p>';
            }
            
            // Bass guitar has 4 strings with indices 0-3
            const stringNames = ['G', 'D', 'A', 'E'];
            const tabLines = [
                `G:|${'-'.repeat(40)}|\n`,
                `D:|${'-'.repeat(40)}|\n`,
                `A:|${'-'.repeat(40)}|\n`,
                `E:|${'-'.repeat(40)}|\n`
            ];
            
            // Convert tab lines to arrays for easier manipulation
            const tabArrays = tabLines.map(line => line.split(''));
            
            // Sort notes by time
            const sortedNotes = [...notes].sort((a, b) => a.time - b.time);
            
            // Place notes on the tab
            sortedNotes.forEach(note => {
                // Scale time to position (this is a simple implementation)
                const position = Math.floor(note.time * 4) + 3; // +3 to account for the 'X:|' prefix
                
                // Validate string and position to prevent errors
                if (note.string >= 0 && note.string < tabArrays.length && 
                    position >= 0 && position < tabArrays[note.string].length - 1) {
                    
                    // Convert fret to string representation
                    const fretStr = note.fret.toString();
                    
                    // For double digit frets, we need to handle placement differently
                    if (fretStr.length > 1) {
                        // Try to place multi-digit fret numbers if there's space
                        if (position < tabArrays[note.string].length - fretStr.length) {
                            for (let i = 0; i < fretStr.length; i++) {
                                tabArrays[note.string][position + i] = fretStr[i];
                            }
                        } else {
                            // If not enough space, just place the first digit
                            tabArrays[note.string][position] = fretStr[0];
                        }
                    } else {
                        // Single digit fret
                        tabArrays[note.string][position] = fretStr;
                    }
                }
            });
            
            // Reconstruct the tab strings
            const formattedTablature = tabArrays.map(arr => arr.join('')).join('');
            
            return `<div class="tablature-container"><pre class="tablature">Bass Tablature:\n\n${formattedTablature}</pre></div>`;
        },
        
        /**
         * Render chord chart from chord data
         * @param {Object} chordData - Chord data to render
         * @returns {string} - HTML representation of the chord chart
         */
        renderChordChart: function(chordData) {
            // This is a placeholder - in a real app, use a proper chord chart renderer
            let output = '<div class="chord-chart">';
            
            if (Array.isArray(chordData)) {
                chordData.forEach(chord => {
                    output += `<div class="chord"><h3>${chord.name}</h3></div>`;
                });
            } else {
                output += '<p>No chord data available</p>';
            }
            
            output += '</div>';
            return output;
        }
    };
})();
