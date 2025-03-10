"""Audio preprocessing module for the Audio-to-Score Transcription System.

This module handles audio file normalization, format conversion, and preprocessing
to prepare audio for feature extraction and analysis.
"""

import os
import librosa
import numpy as np
import soundfile as sf
import ffmpeg
from typing import Dict, Any, Tuple, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class AudioPreprocessor:
    """Audio preprocessing handler for preparing audio files for analysis."""
    
    def __init__(self, target_sr: int = 44100, mono: bool = True):
        """Initialize the audio preprocessor.
        
        Args:
            target_sr: Target sample rate for audio processing
            mono: Whether to convert audio to mono
        """
        self.target_sr = target_sr
        self.mono = mono
        
    def load_audio(self, file_path: str) -> Tuple[np.ndarray, int]:
        """Load an audio file using librosa.
        
        Args:
            file_path: Path to the audio file
            
        Returns:
            Tuple containing the audio data and sample rate
        """
        try:
            logger.info(f"Loading audio file: {file_path}")
            y, sr = librosa.load(file_path, sr=self.target_sr, mono=self.mono)
            logger.info(f"Audio loaded successfully, duration: {len(y)/sr:.2f}s")
            return y, sr
        except Exception as e:
            logger.error(f"Error loading audio file: {e}")
            raise
    
    def convert_format(self, input_path: str, output_path: str, format: str = "wav"):
        """Convert audio to a different format using ffmpeg.
        
        Args:
            input_path: Path to the input audio file
            output_path: Path to save the converted audio file
            format: Target format (wav, mp3, etc.)
        """
        try:
            logger.info(f"Converting {input_path} to {format} format")
            ffmpeg.input(input_path).output(output_path).run(quiet=True, overwrite_output=True)
            logger.info(f"Conversion complete: {output_path}")
        except Exception as e:
            logger.error(f"Error converting audio format: {e}")
            raise
    
    def normalize_audio(self, y: np.ndarray) -> np.ndarray:
        """Normalize audio amplitude to the range [-1, 1].
        
        Args:
            y: Audio data
            
        Returns:
            Normalized audio data
        """
        if np.max(np.abs(y)) > 0:
            return y / np.max(np.abs(y))
        return y
    
    def trim_silence(self, y: np.ndarray, sr: int, threshold: float = 0.01) -> np.ndarray:
        """Trim silence from the beginning and end of the audio.
        
        Args:
            y: Audio data
            sr: Sample rate
            threshold: Silence threshold
            
        Returns:
            Trimmed audio data
        """
        logger.info("Trimming silence from audio")
        y_trimmed, _ = librosa.effects.trim(y, top_db=20)
        return y_trimmed
    
    def generate_spectrogram(self, y: np.ndarray, sr: int, output_path: Optional[str] = None) -> np.ndarray:
        """Generate a spectrogram from audio data.
        
        Args:
            y: Audio data
            sr: Sample rate
            output_path: Optional path to save the spectrogram image
            
        Returns:
            Spectrogram data as a numpy array
        """
        logger.info("Generating spectrogram")
        # Generate a mel-spectrogram
        S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=8000)
        # Convert to dB scale
        S_dB = librosa.power_to_db(S, ref=np.max)
        
        if output_path:
            # Save the spectrogram as an image
            import matplotlib.pyplot as plt
            plt.figure(figsize=(10, 4))
            librosa.display.specshow(S_dB, sr=sr, x_axis='time', y_axis='mel', fmax=8000)
            plt.colorbar(format='%+2.0f dB')
            plt.title('Mel-frequency spectrogram')
            plt.tight_layout()
            plt.savefig(output_path)
            plt.close()
            logger.info(f"Spectrogram saved to {output_path}")
        
        return S_dB
    
    def process_audio(self, input_path: str, output_dir: str) -> Dict[str, Any]:
        """Process an audio file with the complete preprocessing pipeline.
        
        Args:
            input_path: Path to the input audio file
            output_dir: Directory to save processed outputs
            
        Returns:
            Dictionary containing paths and metadata for processed audio
        """
        logger.info(f"Starting audio preprocessing for {input_path}")
        os.makedirs(output_dir, exist_ok=True)
        
        # Get file name without extension
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        
        # Load audio
        y, sr = self.load_audio(input_path)
        
        # Normalize audio
        y_normalized = self.normalize_audio(y)
        
        # Trim silence
        y_trimmed = self.trim_silence(y_normalized, sr)
        
        # Save processed WAV file
        processed_path = os.path.join(output_dir, f"{base_name}_processed.wav")
        sf.write(processed_path, y_trimmed, sr)
        
        # Generate spectrogram
        spec_path = os.path.join(output_dir, f"{base_name}_spectrogram.png")
        spectrogram = self.generate_spectrogram(y_trimmed, sr, spec_path)
        
        # Return metadata and paths
        metadata = {
            "original_path": input_path,
            "processed_path": processed_path,
            "spectrogram_path": spec_path,
            "duration": len(y_trimmed) / sr,
            "sample_rate": sr,
            "channels": 1 if self.mono else 2,
            "samples": len(y_trimmed)
        }
        
        logger.info(f"Audio preprocessing complete for {input_path}")
        return metadata
