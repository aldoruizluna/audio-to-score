"""Feature extraction module for the Audio-to-Score Transcription System.

This module handles pitch detection, onset detection, and other audio feature extraction
to convert audio data into musical information.
"""

import os
import numpy as np
import librosa
import crepe
from typing import Dict, Any, List, Tuple, Optional
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class FeatureExtractor:
    """Feature extraction handler for analyzing audio and extracting musical features."""
    
    def __init__(self, hop_length: int = 512, fmin: float = 65.0, fmax: float = 2093.0):
        """Initialize the feature extractor.
        
        Args:
            hop_length: Hop length for feature extraction
            fmin: Minimum frequency to analyze (C2 = 65.41 Hz)
            fmax: Maximum frequency to analyze (C7 = 2093.00 Hz)
        """
        self.hop_length = hop_length
        self.fmin = fmin
        self.fmax = fmax
    
    def detect_pitch_crepe(self, y: np.ndarray, sr: int, step_size: int = 10) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Detect pitch using the CREPE model.
        
        Args:
            y: Audio data
            sr: Sample rate
            step_size: Step size in milliseconds
            
        Returns:
            Tuple containing time, frequency, and confidence arrays
        """
        logger.info("Detecting pitch using CREPE")
        time, frequency, confidence, _ = crepe.predict(y, sr, step_size=step_size, viterbi=True)
        return time, frequency, confidence
    
    def detect_onsets(self, y: np.ndarray, sr: int) -> np.ndarray:
        """Detect note onsets in the audio.
        
        Args:
            y: Audio data
            sr: Sample rate
            
        Returns:
            Array of onset times in seconds
        """
        logger.info("Detecting note onsets")
        # Get onset frames
        onset_frames = librosa.onset.onset_detect(
            y=y, sr=sr, hop_length=self.hop_length, 
            backtrack=True,  # Find the nearest preceding local minima
            units='frames'
        )
        # Convert to time
        onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=self.hop_length)
        return onset_times
    
    def detect_offsets(self, y: np.ndarray, sr: int, onset_times: np.ndarray) -> np.ndarray:
        """Estimate note offsets based on onset times and amplitude changes.
        
        Args:
            y: Audio data
            sr: Sample rate
            onset_times: Array of note onset times
            
        Returns:
            Array of offset times in seconds
        """
        logger.info("Estimating note offsets")
        # Convert to mono if needed
        if y.ndim > 1:
            y = librosa.to_mono(y)
        
        # Get the amplitude envelope
        envelope = np.abs(librosa.feature.rms(y=y, hop_length=self.hop_length))[0]
        times = librosa.times_like(envelope, sr=sr, hop_length=self.hop_length)
        
        # Estimate offsets based on amplitude decay after onsets
        offset_times = []
        
        for i, onset in enumerate(onset_times):
            # Define the search range for offset
            start_idx = np.argmin(np.abs(times - onset))
            if i < len(onset_times) - 1:
                end_idx = np.argmin(np.abs(times - onset_times[i+1]))
            else:
                end_idx = len(times) - 1
            
            # Extract the segment
            segment = envelope[start_idx:end_idx]
            
            if len(segment) > 0:
                # Find where amplitude drops significantly
                threshold = 0.3 * np.max(segment)
                potential_offsets = np.where(segment < threshold)[0]
                
                if len(potential_offsets) > 0:
                    # Take the first significant drop
                    offset_idx = start_idx + potential_offsets[0]
                    offset_times.append(times[offset_idx])
                else:
                    # If no clear drop, use the next onset or a fixed duration
                    offset_times.append(times[end_idx - 1])
            else:
                # If segment is empty, use a default duration
                offset_times.append(onset + 0.2)  # 200ms default note duration
        
        return np.array(offset_times)
    
    def estimate_polyphony(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Estimate if the audio contains polyphonic content (chords).
        
        Args:
            y: Audio data
            sr: Sample rate
            
        Returns:
            Dictionary with polyphony estimation results
        """
        logger.info("Estimating polyphony")
        # This is a simplified estimation - in a real implementation, you would
        # use more sophisticated methods for chord detection
        
        # Calculate spectral flatness and flux
        spectral_flatness = librosa.feature.spectral_flatness(y=y)
        spectral_flux = librosa.onset.onset_strength(y=y, sr=sr)
        
        # Higher values of flatness and flux can indicate polyphony
        mean_flatness = np.mean(spectral_flatness)
        mean_flux = np.mean(spectral_flux)
        
        # Check for harmonic content
        harmonic, _ = librosa.effects.hpss(y)
        harmonic_ratio = np.sum(np.abs(harmonic)) / np.sum(np.abs(y) + 1e-8)
        
        # Simple threshold-based classification
        is_polyphonic = (mean_flatness > 0.2 and harmonic_ratio > 0.6) or mean_flux > 0.3
        
        return {
            "is_polyphonic": bool(is_polyphonic),
            "mean_flatness": float(mean_flatness),
            "mean_flux": float(mean_flux),
            "harmonic_ratio": float(harmonic_ratio)
        }
    
    def get_tempo_and_beats(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Estimate tempo and beat positions.
        
        Args:
            y: Audio data
            sr: Sample rate
            
        Returns:
            Dictionary with tempo and beat information
        """
        logger.info("Estimating tempo and beats")
        # Estimate tempo (BPM)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        
        # Get beat frames and convert to times
        _, beat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=self.hop_length)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=self.hop_length)
        
        return {
            "tempo": float(tempo),
            "beat_times": beat_times.tolist()
        }
    
    def detect_key(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Estimate the musical key of the audio.
        
        Args:
            y: Audio data
            sr: Sample rate
            
        Returns:
            Dictionary with key information
        """
        logger.info("Estimating musical key")
        # Compute chroma features
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        
        # Compute the mean chroma vector
        chroma_mean = np.mean(chroma, axis=1)
        
        # Define key names (for visualization/output)
        key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        
        # Simple estimation: the key with maximum chroma value
        key_idx = np.argmax(chroma_mean)
        key_name = key_names[key_idx]
        
        # Try to determine if major or minor (this is a simplified approach)
        # In a more complete implementation, use a trained model for key detection
        major_profile = np.array([1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1])  # C major profile
        minor_profile = np.array([1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0])  # A minor profile (relative to C)
        
        # Rotate profiles to align with detected key
        major_profile = np.roll(major_profile, key_idx)
        minor_profile = np.roll(minor_profile, key_idx)
        
        # Calculate correlation with major and minor profiles
        major_corr = np.corrcoef(chroma_mean, major_profile)[0, 1]
        minor_corr = np.corrcoef(chroma_mean, minor_profile)[0, 1]
        
        # Determine mode
        is_major = major_corr > minor_corr
        key_mode = "major" if is_major else "minor"
        
        return {
            "key": key_name,
            "mode": key_mode,
            "confidence": float(max(major_corr, minor_corr))
        }
    
    def process_features(self, audio_path: str, output_dir: str) -> Dict[str, Any]:
        """Process an audio file to extract all relevant musical features.
        
        Args:
            audio_path: Path to the processed audio file
            output_dir: Directory to save feature extraction outputs
            
        Returns:
            Dictionary containing extracted features and metadata
        """
        logger.info(f"Starting feature extraction for {audio_path}")
        os.makedirs(output_dir, exist_ok=True)
        
        # Get file name without extension
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        
        # Load audio
        y, sr = librosa.load(audio_path, sr=None, mono=True)
        
        # Pitch detection
        time, frequency, confidence = self.detect_pitch_crepe(y, sr)
        
        # Onset detection
        onset_times = self.detect_onsets(y, sr)
        
        # Offset estimation
        offset_times = self.detect_offsets(y, sr, onset_times)
        
        # Polyphony estimation
        polyphony_info = self.estimate_polyphony(y, sr)
        
        # Tempo and beat detection
        rhythm_info = self.get_tempo_and_beats(y, sr)
        
        # Key detection
        key_info = self.detect_key(y, sr)
        
        # Prepare features dictionary
        features = {
            "audio_path": audio_path,
            "sample_rate": sr,
            "duration": float(librosa.get_duration(y=y, sr=sr)),
            "pitch": {
                "time": time.tolist(),
                "frequency": frequency.tolist(),
                "confidence": confidence.tolist()
            },
            "notes": {
                "onset_times": onset_times.tolist(),
                "offset_times": offset_times.tolist(),
                "count": len(onset_times)
            },
            "polyphony": polyphony_info,
            "rhythm": rhythm_info,
            "key": key_info
        }
        
        # Save features to JSON file
        output_path = os.path.join(output_dir, f"{base_name}_features.json")
        with open(output_path, 'w') as f:
            json.dump(features, f, indent=2)
        
        logger.info(f"Feature extraction complete for {audio_path}, saved to {output_path}")
        
        return features
