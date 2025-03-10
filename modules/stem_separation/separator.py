"""Stem separation module for the Audio-to-Score Transcription System.

This module separates audio into individual instrument stems using Spleeter.
"""

import os
import json
import numpy as np
import librosa
import soundfile as sf
from typing import Dict, Any, List, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class StemSeparator:
    """Separates audio into instrument stems using Spleeter."""
    
    def __init__(self, model_name: str = "spleeter:4stems"):
        """Initialize the stem separator.
        
        Args:
            model_name: Spleeter model to use. Options include:
                - 'spleeter:2stems' (vocals and accompaniment)
                - 'spleeter:4stems' (vocals, drums, bass, other)
                - 'spleeter:5stems' (vocals, drums, bass, piano, other)
        """
        self.model_name = model_name
        logger.info(f"Initializing StemSeparator with model: {model_name}")
        
    def separate_stems(self, audio_path: str, output_dir: str) -> Dict[str, str]:
        """Separate audio into stems using Spleeter.
        
        Args:
            audio_path: Path to the input audio file
            output_dir: Directory to save separated stems
            
        Returns:
            Dictionary mapping stem names to file paths
        """
        logger.info(f"Separating stems for {audio_path} using {self.model_name}")
        os.makedirs(output_dir, exist_ok=True)
        
        try:
            # Import tensorflow and spleeter here to avoid dependencies if not used
            # This allows the system to run without stem separation if not needed
            import tensorflow as tf
            from spleeter.separator import Separator
            
            # Create separator with the specified model
            separator = Separator(self.model_name)
            
            # Get base name for output files
            base_name = os.path.splitext(os.path.basename(audio_path))[0]
            
            # Generate output path
            stems_path = os.path.join(output_dir, base_name)
            
            # Separate and export to output path
            separator.separate_to_file(audio_path, stems_path)
            
            # Map stem names to file paths
            stem_paths = {}
            
            # Different models produce different stem names
            if self.model_name == "spleeter:2stems":
                expected_stems = ["vocals", "accompaniment"]
            elif self.model_name == "spleeter:4stems":
                expected_stems = ["vocals", "drums", "bass", "other"]
            elif self.model_name == "spleeter:5stems":
                expected_stems = ["vocals", "drums", "bass", "piano", "other"]
            else:
                # Default fallback
                expected_stems = []
            
            # Check for each expected stem file
            for stem in expected_stems:
                stem_file = os.path.join(stems_path, stem + ".wav")
                if os.path.exists(stem_file):
                    stem_paths[stem] = stem_file
            
            logger.info(f"Successfully separated {len(stem_paths)} stems: {list(stem_paths.keys())}")
            return stem_paths
            
        except ImportError as e:
            logger.error(f"Failed to import required libraries for stem separation: {e}")
            logger.info("Using original audio file as fallback")
            return {"original": audio_path}
        
        except Exception as e:
            logger.error(f"Failed to separate stems: {e}")
            logger.info("Using original audio file as fallback")
            return {"original": audio_path}
    
    def analyze_stem_content(self, stem_path: str) -> Dict[str, Any]:
        """Analyze stem content to determine instrument type and characteristics.
        
        Args:
            stem_path: Path to the stem audio file
            
        Returns:
            Dictionary with stem analysis results
        """
        logger.info(f"Analyzing stem content: {stem_path}")
        
        try:
            # Load audio
            y, sr = librosa.load(stem_path, sr=None)
            
            # Extract features for instrument classification
            # Spectral centroid (brightness)
            spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)[0])
            
            # Spectral bandwidth (spectrum spread)
            spectral_bandwidth = np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)[0])
            
            # Spectral flatness (noisiness vs. tonalness)
            spectral_flatness = np.mean(librosa.feature.spectral_flatness(y=y))
            
            # RMS energy
            rms = np.mean(librosa.feature.rms(y=y)[0])
            
            # Zero crossing rate (useful for distinguishing voiced/unvoiced sounds)
            zcr = np.mean(librosa.feature.zero_crossing_rate(y)[0])
            
            # Onset strength
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            onset_strength = np.mean(onset_env)
            
            # Determine likely instrument type based on features
            # This is a simplified approach - a real implementation would use a trained classifier
            
            # Determine if it's a percussive or harmonic sound
            harmonic, percussive = librosa.effects.hpss(y)
            harmonic_energy = np.sum(harmonic**2)
            percussive_energy = np.sum(percussive**2)
            is_percussive = percussive_energy > harmonic_energy
            
            # Basic instrument classification heuristics
            if is_percussive and zcr > 0.1:
                instrument_type = "drums"
            elif (not is_percussive) and spectral_centroid < 1000 and spectral_flatness < 0.1:
                instrument_type = "bass"
            elif (not is_percussive) and spectral_flatness < 0.1 and spectral_centroid > 1500:
                instrument_type = "guitar"
            else:
                # Default to the stem name from the file
                stem_name = os.path.splitext(os.path.basename(stem_path))[0]
                instrument_type = stem_name
            
            # Create analysis result
            analysis = {
                "instrument_type": instrument_type,
                "is_percussive": bool(is_percussive),
                "spectral_centroid": float(spectral_centroid),
                "spectral_bandwidth": float(spectral_bandwidth),
                "spectral_flatness": float(spectral_flatness),
                "rms_energy": float(rms),
                "zero_crossing_rate": float(zcr),
                "onset_strength": float(onset_strength),
                "duration": float(len(y) / sr)
            }
            
            logger.info(f"Stem analyzed as instrument type: {instrument_type}")
            return analysis
            
        except Exception as e:
            logger.error(f"Failed to analyze stem content: {e}")
            return {
                "instrument_type": "unknown",
                "error": str(e)
            }
    
    def process_stems(self, audio_path: str, output_dir: str) -> Dict[str, Any]:
        """Process an audio file to separate and analyze stems.
        
        Args:
            audio_path: Path to the input audio file
            output_dir: Directory to save outputs
            
        Returns:
            Dictionary containing stem paths and metadata
        """
        logger.info(f"Starting stem separation for {audio_path}")
        os.makedirs(output_dir, exist_ok=True)
        
        # Get base name for output files
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        stems_dir = os.path.join(output_dir, f"{base_name}_stems")
        
        # Separate stems
        stem_paths = self.separate_stems(audio_path, stems_dir)
        
        # Analyze each stem
        stem_analysis = {}
        for stem_name, stem_path in stem_paths.items():
            analysis = self.analyze_stem_content(stem_path)
            stem_analysis[stem_name] = analysis
        
        # Create metadata with paths and analysis
        metadata = {
            "original_path": audio_path,
            "stems_dir": stems_dir,
            "stem_paths": stem_paths,
            "stem_analysis": stem_analysis
        }
        
        # Save metadata to JSON
        metadata_path = os.path.join(stems_dir, f"{base_name}_stems_metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Stem separation complete for {audio_path}, identified {len(stem_paths)} stems")
        return metadata
