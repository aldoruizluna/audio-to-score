"""Note mapping module for the Audio-to-Score Transcription System.

This module converts audio features (pitch, onset/offset) into standard musical notation
and instrument-specific tablature.
"""

import os
import json
import numpy as np
from typing import Dict, Any, List, Tuple, Optional
import music21 as m21
import logging
from enum import Enum

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class StringInstrument(Enum):
    """Enum representing supported string instruments."""
    GUITAR = "guitar"
    BASS = "bass"
    UKULELE = "ukulele"


class TuningPreset(Enum):
    """Enum representing standard tunings for string instruments."""
    GUITAR_STANDARD = ["E2", "A2", "D3", "G3", "B3", "E4"]  # Standard guitar tuning
    GUITAR_DROP_D = ["D2", "A2", "D3", "G3", "B3", "E4"]  # Drop D guitar tuning
    BASS_STANDARD = ["E1", "A1", "D2", "G2"]  # Standard 4-string bass tuning
    BASS_5STRING = ["B0", "E1", "A1", "D2", "G2"]  # 5-string bass tuning
    UKULELE_STANDARD = ["G4", "C4", "E4", "A4"]  # Standard ukulele tuning


class NoteMapper:
    """Maps audio features to musical notation and tablature."""
    
    def __init__(self, instrument_type: str = "bass", 
                 tuning: Optional[List[str]] = None):
        """Initialize the note mapper.
        
        Args:
            instrument_type: The instrument type (bass, guitar, piano, drums, etc.)
            tuning: Custom tuning as a list of string pitches (high to low)
                   If None, uses the standard tuning for the instrument
        """
        # Map instrument_type string to StringInstrument enum if applicable
        if instrument_type.lower() in [e.value for e in StringInstrument]:
            self.instrument = StringInstrument(instrument_type.lower())
        else:
            # Default to bass for non-string instruments (we'll handle them differently)
            self.instrument = StringInstrument.BASS
            
        self.instrument_type = instrument_type.lower()
        
        # Set default tuning based on instrument if not specified
        if tuning is None:
            if self.instrument == StringInstrument.GUITAR:
                self.tuning = TuningPreset.GUITAR_STANDARD.value
            elif self.instrument == StringInstrument.BASS:
                self.tuning = TuningPreset.BASS_STANDARD.value
            elif self.instrument == StringInstrument.UKULELE:
                self.tuning = TuningPreset.UKULELE_STANDARD.value
            else:
                # Default tuning for non-string instruments (not actually used)
                self.tuning = []
        else:
            self.tuning = tuning
        
        # Convert tuning strings to music21 pitches if we have a string instrument
        if self.tuning:
            self.tuning_pitches = [m21.pitch.Pitch(note) for note in self.tuning]
            self.string_count = len(self.tuning)
        else:
            self.tuning_pitches = []
            self.string_count = 0
        
        logger.info(f"Initialized {instrument_type} mapper")
    
    def frequency_to_pitch(self, frequency: float) -> m21.pitch.Pitch:
        """Convert a frequency in Hz to a music21 pitch object.
        
        Args:
            frequency: Frequency in Hz
            
        Returns:
            music21 Pitch object
        """
        # Handle silent frames or very low frequencies
        if frequency < 20:  # Below audible range
            return None
        
        # Convert frequency to music21 pitch
        pitch = m21.pitch.Pitch()
        pitch.frequency = frequency
        return pitch
    
    def pitch_to_note(self, pitch: m21.pitch.Pitch, duration: float) -> m21.note.Note:
        """Convert a pitch to a music21 note with duration.
        
        Args:
            pitch: music21 Pitch object
            duration: Duration in seconds
            
        Returns:
            music21 Note object
        """
        if pitch is None:
            return m21.note.Rest(quarterLength=duration)
        
        # Convert seconds to quarter notes (assuming 60 BPM as default)
        quarter_length = duration
        
        # Create the note
        note = m21.note.Note(pitch)
        note.quarterLength = quarter_length
        
        return note
    
    def pitch_to_string_fret(self, pitch: m21.pitch.Pitch) -> Tuple[int, int]:
        """Map a pitch to string number and fret position.
        
        Args:
            pitch: music21 Pitch object
            
        Returns:
            Tuple of (string_number, fret_number)
            String numbers are 0-indexed from highest to lowest pitch
        """
        if pitch is None:
            return (-1, -1)  # Invalid string/fret for rests
        
        pitch_midi = pitch.midi
        
        # Find all possible positions for this pitch
        positions = []
        
        for string_idx, open_pitch in enumerate(self.tuning_pitches):
            open_pitch_midi = open_pitch.midi
            fret = pitch_midi - open_pitch_midi
            
            # Check if the pitch can be played on this string
            if 0 <= fret <= 24:  # Assuming 24 frets maximum
                positions.append((string_idx, fret))
        
        if not positions:
            # If no valid position found, find the closest match
            closest_string = 0
            closest_fret = 0
            min_distance = float('inf')
            
            for string_idx, open_pitch in enumerate(self.tuning_pitches):
                open_pitch_midi = open_pitch.midi
                fret = pitch_midi - open_pitch_midi
                
                if fret < 0:
                    distance = abs(fret)
                    if distance < min_distance:
                        min_distance = distance
                        closest_string = string_idx
                        closest_fret = 0
                elif fret > 24:
                    distance = fret - 24
                    if distance < min_distance:
                        min_distance = distance
                        closest_string = string_idx
                        closest_fret = 24
            
            return (closest_string, closest_fret)
        
        # Select the best position based on playing efficiency
        # Prefer lower fret numbers and middle strings
        def position_score(pos):
            string_idx, fret = pos
            # Penalize high fret positions and extreme strings
            fret_penalty = fret * 2
            string_penalty = abs(string_idx - (self.string_count // 2)) * 5
            return fret_penalty + string_penalty
        
        best_position = min(positions, key=position_score)
        return best_position
    
    def map_frequencies_to_notes(self, onset_times: np.ndarray, time: np.ndarray, frequency: np.ndarray, confidence: np.ndarray, tempo: float = 120.0, key: str = 'C', is_polyphonic: bool = False) -> Dict[str, Any]:
        """Map frequency data to musical notes.
        
        Args:
            onset_times: Array of note onset times in seconds
            time: Array of time points from pitch detection
            frequency: Array of frequency values in Hz
            confidence: Array of confidence values for each frequency
            tempo: Estimated tempo in BPM
            key: Estimated musical key
            is_polyphonic: Whether the audio is polyphonic (contains chords)
            
        Returns:
            Dictionary with note mapping results
        """
        logger.info(f"Mapping frequencies to notes for {self.instrument_type}")
        
        # Filter out low-confidence pitch estimates
        confidence_threshold = 0.8  # Only keep confident pitch estimates
        valid_indices = confidence > confidence_threshold
        filtered_time = time[valid_indices]
        filtered_frequency = frequency[valid_indices]
        
        # Initialize note data
        notes = []
        
        # Process each onset
        for i, onset in enumerate(onset_times):
            # Determine note end time (next onset or end of audio)
            if i < len(onset_times) - 1:
                end_time = onset_times[i + 1]
            else:
                end_time = filtered_time[-1] if len(filtered_time) > 0 else onset + 0.5  # Default to 0.5s note
            
            # Duration in seconds
            duration = end_time - onset
            
            # Find all pitch estimates within this note's timespan
            note_indices = (filtered_time >= onset) & (filtered_time < end_time)
            note_frequencies = filtered_frequency[note_indices]
            
            if len(note_frequencies) == 0:
                # Skip if no valid frequencies for this note
                continue
            
            # Calculate median frequency for this note
            median_freq = np.median(note_frequencies)
            
            # Convert frequency to pitch
            pitch_obj = self.frequency_to_pitch(median_freq)
            if pitch_obj is None:
                # Skip silent frames
                continue
            
            # Calculate note properties
            midi_note = pitch_obj.midi
            note_name = pitch_obj.nameWithOctave
            
            # For string instruments, find string and fret
            if self.instrument_type in [e.value for e in StringInstrument]:
                string_idx, fret = self.pitch_to_string_fret(pitch_obj)
            else:
                string_idx, fret = -1, -1  # Not applicable
            
            # Calculate note duration in quarter notes based on tempo
            quarters_per_second = tempo / 60.0
            quarter_length = duration * quarters_per_second
            
            # Add the note to our results
            note_data = {
                "onset": float(onset),
                "duration": float(duration),
                "frequency": float(median_freq),
                "midi": int(midi_note),
                "note": note_name,
                "quarter_length": float(quarter_length)
            }
            
            # Add string instrument specific data if applicable
            if string_idx >= 0:
                note_data["string"] = int(string_idx)
                note_data["fret"] = int(fret)
            
            notes.append(note_data)
        
        # Organize results
        results = {
            "notes": notes,
            "tempo": float(tempo),
            "key": key,
            "is_polyphonic": bool(is_polyphonic),
            "instrument": self.instrument_type
        }
        
        return results

    def create_score(self, features: Dict[str, Any], tempo: Optional[float] = None) -> m21.stream.Score:
        """Create a music21 score from the extracted features.
        
        Args:
            features: Dictionary of extracted audio features
            tempo: Optional tempo override (BPM)
            
        Returns:
            music21 Score object
        """
        logger.info("Creating music score from features")
        
        # Create a new score
        score = m21.stream.Score()
        
        # Add metadata
        score.insert(0, m21.metadata.Metadata())
        score.metadata.title = "Transcribed Score"
        score.metadata.composer = "Audio-to-Score System"
        
        # Get tempo from features or use provided value
        if tempo is None and "rhythm" in features:
            tempo = features["rhythm"].get("tempo", 60.0)
        else:
            tempo = tempo or 60.0
        
        # Add tempo marking
        score.insert(0, m21.tempo.MetronomeMark(number=tempo))
        
        # Create standard notation part
        standard_part = m21.stream.Part()
        standard_part.id = 'standard'
        
        # Create tablature part
        tab_part = m21.stream.Part()
        tab_part.id = 'tablature'
        
        # Add instrument
        if self.instrument == StringInstrument.GUITAR:
            instrument = m21.instrument.Guitar()
        elif self.instrument == StringInstrument.BASS:
            instrument = m21.instrument.ElectricBass()
        elif self.instrument == StringInstrument.UKULELE:
            instrument = m21.instrument.Ukulele()
        
        standard_part.insert(0, instrument)
        
        # Create a measure
        standard_measure = m21.stream.Measure(number=1)
        tab_measure = m21.stream.Measure(number=1)
        
        # Add time signature (default 4/4)
        if "key" in features:
            key_name = features["key"].get("key", "C")
            key_mode = features["key"].get("mode", "major")
            key_signature = m21.key.Key(key_name, key_mode)
            standard_measure.insert(0, key_signature)
        
        # Add time signature (default 4/4)
        standard_measure.insert(0, m21.meter.TimeSignature('4/4'))
        
        # Process note onsets and pitches
        if "notes" in features and "pitch" in features:
            onset_times = features["notes"]["onset_times"]
            offset_times = features["notes"]["offset_times"]
            
            # Ensure equal length arrays
            min_len = min(len(onset_times), len(offset_times))
            onset_times = onset_times[:min_len]
            offset_times = offset_times[:min_len]
            
            # Get pitch data
            pitch_times = features["pitch"]["time"]
            pitch_freqs = features["pitch"]["frequency"]
            pitch_confs = features["pitch"]["confidence"]
            
            # Process each note
            for i, (onset, offset) in enumerate(zip(onset_times, offset_times)):
                # Calculate note duration
                duration = offset - onset
                if duration <= 0:
                    continue  # Skip invalid durations
                
                # Find the average pitch in this time window
                pitch_indices = [j for j, t in enumerate(pitch_times) if onset <= t < offset]
                
                if not pitch_indices:
                    continue  # Skip if no pitch data found for this note
                
                # Filter by confidence
                confidences = [pitch_confs[j] for j in pitch_indices]
                frequencies = [pitch_freqs[j] for j in pitch_indices]
                
                # Use weighted average based on confidence
                weighted_freq = np.average(frequencies, weights=confidences) if sum(confidences) > 0 else 0
                
                # Convert to musical note
                pitch = self.frequency_to_pitch(weighted_freq)
                note = self.pitch_to_note(pitch, duration)
                
                # Add to standard notation
                standard_measure.append(note)
                
                # Create tablature note
                if pitch:
                    string_num, fret_num = self.pitch_to_string_fret(pitch)
                    if string_num >= 0 and fret_num >= 0:
                        # Create a tablature note
                        tab_note = m21.note.Note(pitch)
                        tab_note.quarterLength = duration
                        tab_note.stemDirection = 'noStem'  # No stems in tab notation
                        
                        # Add tablature information
                        # In practice, this would be handled by a specialized tablature renderer
                        tab_note.addLyric(f"Str:{string_num + 1} Fret:{fret_num}")
                        
                        tab_measure.append(tab_note)
                    else:
                        # Add rest to tablature part
                        tab_measure.append(m21.note.Rest(quarterLength=duration))
                else:
                    # Add rest to tablature part
                    tab_measure.append(m21.note.Rest(quarterLength=duration))
        
        # Add measures to parts
        standard_part.append(standard_measure)
        tab_part.append(tab_measure)
        
        # Add parts to score
        score.insert(0, standard_part)
        score.insert(0, tab_part)
        
        return score
    
    def create_tab_json(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Create a JSON representation of the tablature.
        
        Args:
            features: Dictionary of extracted audio features
            
        Returns:
            Dictionary representation of tablature data
        """
        logger.info("Creating tablature JSON")
        
        # Initialize the tablature data structure
        tab_data = {
            "instrument": self.instrument.value,
            "tuning": self.tuning,
            "string_count": self.string_count,
            "notes": []
        }
        
        # Process note onsets and pitches
        if "notes" in features and "pitch" in features:
            onset_times = features["notes"]["onset_times"]
            offset_times = features["notes"]["offset_times"]
            
            # Ensure equal length arrays
            min_len = min(len(onset_times), len(offset_times))
            onset_times = onset_times[:min_len]
            offset_times = offset_times[:min_len]
            
            # Get pitch data
            pitch_times = features["pitch"]["time"]
            pitch_freqs = features["pitch"]["frequency"]
            pitch_confs = features["pitch"]["confidence"]
            
            # Process each note
            for i, (onset, offset) in enumerate(zip(onset_times, offset_times)):
                # Calculate note duration
                duration = offset - onset
                if duration <= 0:
                    continue  # Skip invalid durations
                
                # Find the average pitch in this time window
                pitch_indices = [j for j, t in enumerate(pitch_times) if onset <= t < offset]
                
                if not pitch_indices:
                    continue  # Skip if no pitch data found for this note
                
                # Filter by confidence
                confidences = [pitch_confs[j] for j in pitch_indices]
                frequencies = [pitch_freqs[j] for j in pitch_indices]
                
                # Use weighted average based on confidence
                weighted_freq = np.average(frequencies, weights=confidences) if sum(confidences) > 0 else 0
                
                # Convert to musical note
                pitch = self.frequency_to_pitch(weighted_freq)
                
                if pitch:
                    string_num, fret_num = self.pitch_to_string_fret(pitch)
                    
                    # Create note data
                    note_data = {
                        "start_time": onset,
                        "duration": duration,
                        "string": string_num + 1 if string_num >= 0 else None,  # 1-indexed for output
                        "fret": fret_num if fret_num >= 0 else None,
                        "note_name": str(pitch) if pitch else None,
                        "frequency": weighted_freq,
                        "technique": "normal"  # Default technique, could be enhanced
                    }
                    
                    tab_data["notes"].append(note_data)
        
        # Add additional metadata if available
        if "rhythm" in features:
            tab_data["tempo"] = features["rhythm"].get("tempo", 60.0)
            tab_data["beat_times"] = features["rhythm"].get("beat_times", [])
        
        if "key" in features:
            tab_data["key"] = features["key"].get("key", "C")
            tab_data["mode"] = features["key"].get("mode", "major")
        
        return tab_data
    
    def process_mapping(self, features_path: str, output_dir: str) -> Dict[str, Any]:
        """Process extracted features and generate notation and tablature outputs.
        
        Args:
            features_path: Path to the features JSON file
            output_dir: Directory to save mapping outputs
            
        Returns:
            Dictionary containing paths to generated outputs
        """
        logger.info(f"Starting note mapping for {features_path}")
        os.makedirs(output_dir, exist_ok=True)
        
        # Load features
        with open(features_path, 'r') as f:
            features = json.load(f)
        
        # Get base name for output files
        base_name = os.path.splitext(os.path.basename(features_path))[0].replace('_features', '')
        
        # Create music21 score
        score = self.create_score(features)
        
        # Save as MusicXML
        musicxml_path = os.path.join(output_dir, f"{base_name}.musicxml")
        score.write('musicxml', fp=musicxml_path)
        
        # Save as MIDI
        midi_path = os.path.join(output_dir, f"{base_name}.mid")
        score.write('midi', fp=midi_path)
        
        # Create tablature JSON
        tab_data = self.create_tab_json(features)
        
        # Save tablature as JSON
        tab_json_path = os.path.join(output_dir, f"{base_name}_tab.json")
        with open(tab_json_path, 'w') as f:
            json.dump(tab_data, f, indent=2)
        
        # Generate paths for output formatter
        output_paths = {
            "musicxml_path": musicxml_path,
            "midi_path": midi_path,
            "tab_json_path": tab_json_path,
            "features_path": features_path
        }
        
        logger.info(f"Note mapping complete for {features_path}")
        return output_paths
