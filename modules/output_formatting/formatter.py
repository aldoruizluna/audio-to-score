"""Output formatting module for the Audio-to-Score Transcription System.

This module generates human-readable and machine-readable outputs from musical notation data.
"""

import os
import json
from typing import Dict, Any, List, Optional
import logging
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import xml.etree.ElementTree as ET

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class OutputFormatter:
    """Generates various output formats from musical notation data."""
    
    def __init__(self):
        """Initialize the output formatter."""
        self.styles = getSampleStyleSheet()
    
    def generate_pdf(self, tab_json_path: str, output_path: str) -> str:
        """Generate a PDF representation of the tablature.
        
        Args:
            tab_json_path: Path to the tab JSON file
            output_path: Path to save the PDF output
            
        Returns:
            Path to the generated PDF file
        """
        logger.info(f"Generating PDF from {tab_json_path}")
        
        # Load tab data
        with open(tab_json_path, 'r') as f:
            tab_data = json.load(f)
        
        # Create PDF document
        doc = SimpleDocTemplate(output_path, pagesize=letter)
        elements = []
        
        # Add title
        title_style = self.styles['Title']
        elements.append(Paragraph(f"Tablature for {os.path.basename(tab_json_path)}", title_style))
        elements.append(Spacer(1, 12))
        
        # Add instrument and tuning info
        info_style = self.styles['Normal']
        elements.append(Paragraph(f"Instrument: {tab_data.get('instrument', 'Unknown')}", info_style))
        elements.append(Paragraph(f"Tuning: {', '.join(tab_data.get('tuning', []))}", info_style))
        if 'tempo' in tab_data:
            elements.append(Paragraph(f"Tempo: {tab_data['tempo']} BPM", info_style))
        if 'key' in tab_data and 'mode' in tab_data:
            elements.append(Paragraph(f"Key: {tab_data['key']} {tab_data['mode']}", info_style))
        elements.append(Spacer(1, 24))
        
        # Create tablature table
        table_data = []
        
        # Table header
        headers = ['Time (s)', 'Duration (s)', 'String', 'Fret', 'Note', 'Technique']
        table_data.append(headers)
        
        # Add note data
        for note in tab_data.get('notes', []):
            row = [
                f"{note.get('start_time', 0):.2f}",
                f"{note.get('duration', 0):.2f}",
                str(note.get('string', '')) if note.get('string') is not None else '',
                str(note.get('fret', '')) if note.get('fret') is not None else '',
                note.get('note_name', ''),
                note.get('technique', 'normal')
            ]
            table_data.append(row)
        
        # Create table
        if len(table_data) > 1:  # Only create table if we have data
            tab_table = Table(table_data, repeatRows=1)
            tab_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            elements.append(tab_table)
        
        # Build PDF
        doc.build(elements)
        logger.info(f"PDF generated successfully: {output_path}")
        
        return output_path
    
    def generate_html(self, tab_json_path: str, musicxml_path: str, output_path: str) -> str:
        """Generate an interactive HTML representation of the tablature.
        
        Args:
            tab_json_path: Path to the tab JSON file
            musicxml_path: Path to the MusicXML file
            output_path: Path to save the HTML output
            
        Returns:
            Path to the generated HTML file
        """
        logger.info(f"Generating HTML from {tab_json_path} and {musicxml_path}")
        
        # Load tab data
        with open(tab_json_path, 'r') as f:
            tab_data = json.load(f)
        
        # Create basic HTML structure
        html = f'''
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Interactive Tablature</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                h1 {{ color: #333; }}
                .info {{ margin-bottom: 20px; }}
                .tab-container {{ 
                    display: grid; 
                    grid-template-columns: repeat({tab_data.get('string_count', 6)}, 1fr);
                    border: 1px solid #ccc;
                    margin-bottom: 20px;
                }}
                .string {{ 
                    border-bottom: 1px solid #000; 
                    height: 30px; 
                    position: relative; 
                    text-align: center;
                }}
                .note {{ 
                    position: absolute; 
                    background-color: #3498db; 
                    color: white; 
                    border-radius: 50%; 
                    width: 20px; 
                    height: 20px; 
                    line-height: 20px; 
                    text-align: center; 
                    top: 5px; 
                    transform: translateX(-50%); 
                    cursor: pointer;
                }}
                .note:hover {{ background-color: #2980b9; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
                tr:nth-child(even) {{ background-color: #f9f9f9; }}
                .play-button {{ 
                    padding: 10px 20px; 
                    background-color: #4CAF50; 
                    color: white; 
                    border: none; 
                    cursor: pointer; 
                    margin-bottom: 20px;
                }}
                .play-button:hover {{ background-color: #45a049; }}
            </style>
        </head>
        <body>
            <h1>Interactive Tablature</h1>
            
            <div class="info">
                <p><strong>Instrument:</strong> {tab_data.get('instrument', 'Unknown')}</p>
                <p><strong>Tuning:</strong> {', '.join(tab_data.get('tuning', []))}</p>
        '''
        
        if 'tempo' in tab_data:
            html += f'''        <p><strong>Tempo:</strong> {tab_data['tempo']} BPM</p>
        '''
        
        if 'key' in tab_data and 'mode' in tab_data:
            html += f'''        <p><strong>Key:</strong> {tab_data['key']} {tab_data['mode']}</p>
        '''
        
        html += '''
            </div>
            
            <button class="play-button" id="play-button">Play Tablature</button>
            
            <h2>Tablature Visualization</h2>
            <div class="tab-container" id="tab-container">
        '''
        
        # Add strings
        for i in range(tab_data.get('string_count', 6)):
            html += f'''        <div class="string" id="string-{i+1}">
                    <div class="string-label">{tab_data.get('tuning', [])[i] if i < len(tab_data.get('tuning', [])) else ''}</div>
                </div>
        '''
        
        html += '''
            </div>
            
            <h2>Notes Table</h2>
            <table>
                <tr>
                    <th>Time (s)</th>
                    <th>Duration (s)</th>
                    <th>String</th>
                    <th>Fret</th>
                    <th>Note</th>
                    <th>Technique</th>
                </tr>
        '''
        
        # Add note data to table
        for note in tab_data.get('notes', []):
            html += f'''
                <tr>
                    <td>{note.get('start_time', 0):.2f}</td>
                    <td>{note.get('duration', 0):.2f}</td>
                    <td>{note.get('string', '')}</td>
                    <td>{note.get('fret', '')}</td>
                    <td>{note.get('note_name', '')}</td>
                    <td>{note.get('technique', 'normal')}</td>
                </tr>'''
        
        
        html += '''
            </table>
            
            <script>
                // JavaScript for interactive features
                document.addEventListener('DOMContentLoaded', function() {
                    const tabContainer = document.getElementById('tab-container');
                    const playButton = document.getElementById('play-button');
                    const noteData = '''
        
        
        # Add note data as JSON for JavaScript
        html += json.dumps(tab_data.get('notes', []))
        
        html += ''';
                    
                    // Calculate max duration for visualization
                    const maxTime = noteData.reduce((max, note) => 
                        Math.max(max, note.start_time + note.duration), 0);
                    
                    // Set container width based on max duration
                    tabContainer.style.width = `${Math.max(800, maxTime * 100)}px`;
                    
                    // Add notes to the visualization
                    noteData.forEach(note => {
                        if (note.string && note.fret) {
                            const noteElement = document.createElement('div');
                            noteElement.className = 'note';
                            noteElement.textContent = note.fret;
                            noteElement.style.left = `${note.start_time * 100}px`;
                            noteElement.style.width = `${Math.max(20, note.duration * 50)}px`;
                            noteElement.title = `${note.note_name} - ${note.technique}`;
                            
                            const stringElement = document.getElementById(`string-${note.string}`);
                            if (stringElement) {
                                stringElement.appendChild(noteElement);
                            }
                            
                            // Add click handler to highlight note
                            noteElement.addEventListener('click', function() {
                                // Remove highlight from all notes
                                document.querySelectorAll('.note').forEach(n => {
                                    n.style.backgroundColor = '#3498db';
                                });
                                // Highlight this note
                                this.style.backgroundColor = '#e74c3c';
                            });
                        }
                    });
                    
                    // Simple playback simulation
                    playButton.addEventListener('click', function() {
                        const notes = document.querySelectorAll('.note');
                        let i = 0;
                        
                        // Reset all notes
                        notes.forEach(note => {
                            note.style.backgroundColor = '#3498db';
                        });
                        
                        // Simple animation to show playback
                        const playInterval = setInterval(() => {
                            if (i < notes.length) {
                                if (i > 0) notes[i-1].style.backgroundColor = '#3498db';
                                notes[i].style.backgroundColor = '#e74c3c';
                                i++;
                            } else {
                                clearInterval(playInterval);
                                if (notes.length > 0) notes[notes.length-1].style.backgroundColor = '#3498db';
                            }
                        }, 300);
                    });
                });
            </script>
        </body>
        </html>
        '''
        
        # Write HTML to file
        with open(output_path, 'w') as f:
            f.write(html)
        
        logger.info(f"HTML generated successfully: {output_path}")
        return output_path
    
    def generate_chord_chart(self, tab_json_path: str, output_path: str) -> str:
        """Generate a chord chart from the tablature data.
        
        Args:
            tab_json_path: Path to the tab JSON file
            output_path: Path to save the chord chart output
            
        Returns:
            Path to the generated chord chart file
        """
        logger.info(f"Generating chord chart from {tab_json_path}")
        
        # Load tab data
        with open(tab_json_path, 'r') as f:
            tab_data = json.load(f)
        
        # Process notes to identify chord patterns
        # This is a simplified approach - in a real implementation, you would use
        # more sophisticated chord detection algorithms
        
        # Group notes by start time to identify potential chords
        time_grouped_notes = {}
        for note in tab_data.get('notes', []):
            start_time = round(note.get('start_time', 0), 2)  # Round to handle floating point precision
            if start_time not in time_grouped_notes:
                time_grouped_notes[start_time] = []
            time_grouped_notes[start_time].append(note)
        
        # Identify chords (3+ notes played simultaneously)
        chords = []
        for start_time, notes in time_grouped_notes.items():
            if len(notes) >= 3:  # Consider 3+ notes as a chord
                # Extract note names and fret positions
                note_names = [note.get('note_name', '') for note in notes if note.get('note_name')]
                fret_positions = [
                    (note.get('string', ''), note.get('fret', '')) 
                    for note in notes 
                    if note.get('string') and note.get('fret') is not None
                ]
                
                chord_data = {
                    'start_time': start_time,
                    'duration': notes[0].get('duration', 0),  # Use duration of first note
                    'notes': note_names,
                    'fret_positions': fret_positions
                }
                chords.append(chord_data)
        
        # Create a simple text-based chord chart
        chord_chart = f"Chord Chart for {os.path.basename(tab_json_path)}\n"
        chord_chart += f"Instrument: {tab_data.get('instrument', 'Unknown')}\n"
        chord_chart += f"Tuning: {', '.join(tab_data.get('tuning', []))}\n\n"
        
        if chords:
            chord_chart += "Identified Chords:\n"
            for i, chord in enumerate(chords):
                chord_chart += f"\nChord {i+1} at {chord['start_time']:.2f}s (duration: {chord['duration']:.2f}s):\n"
                chord_chart += f"Notes: {', '.join(chord['notes'])}\n"
                chord_chart += "Fret positions (string, fret):\n"
                for string, fret in chord['fret_positions']:
                    chord_chart += f"  String {string}: Fret {fret}\n"
        else:
            chord_chart += "No chords identified in this tablature."
        
        # Write chord chart to file
        with open(output_path, 'w') as f:
            f.write(chord_chart)
        
        logger.info(f"Chord chart generated successfully: {output_path}")
        return output_path
    
    def process_output(self, mapping_paths: Dict[str, str], output_dir: str) -> Dict[str, str]:
        """Generate all output formats from the mapping data.
        
        Args:
            mapping_paths: Dictionary of paths from the note mapping module
            output_dir: Directory to save formatted outputs
            
        Returns:
            Dictionary containing paths to generated outputs
        """
        logger.info(f"Starting output formatting")
        os.makedirs(output_dir, exist_ok=True)
        
        # Extract paths from mapping
        tab_json_path = mapping_paths.get('tab_json_path')
        musicxml_path = mapping_paths.get('musicxml_path')
        
        if not tab_json_path or not os.path.exists(tab_json_path):
            logger.error(f"Tab JSON file not found: {tab_json_path}")
            return {}
        
        # Get base name for output files
        base_name = os.path.splitext(os.path.basename(tab_json_path))[0].replace('_tab', '')
        
        # Generate PDF
        pdf_path = os.path.join(output_dir, f"{base_name}.pdf")
        pdf_path = self.generate_pdf(tab_json_path, pdf_path)
        
        # Generate HTML
        html_path = os.path.join(output_dir, f"{base_name}.html")
        if musicxml_path and os.path.exists(musicxml_path):
            html_path = self.generate_html(tab_json_path, musicxml_path, html_path)
        
        # Generate chord chart
        chord_chart_path = os.path.join(output_dir, f"{base_name}_chords.txt")
        chord_chart_path = self.generate_chord_chart(tab_json_path, chord_chart_path)
        
        # Return all output paths
        output_paths = {
            "pdf_path": pdf_path,
            "html_path": html_path,
            "chord_chart_path": chord_chart_path,
            "musicxml_path": musicxml_path,
            "tab_json_path": tab_json_path
        }
        
        logger.info(f"Output formatting complete")
        return output_paths
