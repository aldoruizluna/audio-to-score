"""Task queue module for the Feature Extraction service.

This module defines Celery tasks for asynchronous audio feature extraction operations.
"""

import os
import json
import numpy as np
from celery import Celery
from pymongo import MongoClient
from datetime import datetime
import logging
import librosa

from ..feature_extraction.extractor import FeatureExtractor
from api.config import settings
from api.models import JobStatus

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery('feature_extraction')
celery_app.conf.broker_url = settings.REDIS_URI
celery_app.conf.result_backend = settings.REDIS_URI

# MongoDB connection
mongo_client = MongoClient(settings.MONGODB_URI)
db = mongo_client[settings.DATABASE_NAME]


@celery_app.task(name='modules.feature_extraction.tasks.extract_features', bind=True)
def extract_features(self, stem_results):
    """Extract musical features from audio using librosa and CREPE.
    
    Args:
        stem_results: Dictionary with results from previous task, including job_id and file_to_process
        
    Returns:
        Dictionary with feature extraction results for the next task in the chain
    """
    # Extract job_id and audio file path from previous task results
    job_id = stem_results.get('job_id')
    audio_file = stem_results.get('file_to_process')
    sample_rate = stem_results.get('sample_rate')
    stem_name = stem_results.get('stem_name')
    
    logger.info(f"Starting feature extraction for job {job_id}")
    
    try:
        # Get job from database
        job = db.jobs.find_one({"job_id": job_id})
        if not job:
            logger.error(f"Job {job_id} not found")
            raise ValueError(f"Job {job_id} not found")
        
        # Update job status
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": JobStatus.PROCESSING.value,
                "current_step": "feature_extraction",
                "updated_at": datetime.utcnow()
            }}
        )
        
        if not audio_file or not os.path.exists(audio_file):
            logger.error(f"Audio file not found for job {job_id}: {audio_file}")
            raise FileNotFoundError(f"Audio file not found: {audio_file}")
        
        # Create feature extraction output directory
        job_dir = os.path.join(settings.UPLOAD_FOLDER, job_id, "features")
        os.makedirs(job_dir, exist_ok=True)
        
        # Load audio file
        logger.info(f"Loading audio file: {audio_file}")
        y, sr = librosa.load(audio_file, sr=None)
        
        # Initialize feature extractor
        extractor = FeatureExtractor()
        
        # Extract onset times
        logger.info("Detecting onsets")
        onset_times = extractor.detect_onsets(y, sr)
        
        # Extract pitch information using CREPE
        logger.info("Detecting pitch with CREPE")
        time, frequency, confidence = extractor.detect_pitch_crepe(y, sr)
        
        # Get tempo and beat information
        logger.info("Estimating tempo and beats")
        tempo_info = extractor.get_tempo_and_beats(y, sr)
        
        # Detect key
        logger.info("Estimating musical key")
        key_info = extractor.detect_key(y, sr)
        
        # Check for polyphony
        logger.info("Estimating polyphony")
        polyphony_info = extractor.estimate_polyphony(y, sr)
        
        # Save features to file
        features_file = os.path.join(job_dir, f"{os.path.basename(audio_file)}_features.npz")
        np.savez(
            features_file,
            onset_times=onset_times,
            time=time,
            frequency=frequency,
            confidence=confidence
        )
        
        # Compile results
        feature_results = {
            "features_file": features_file,
            "onset_times": onset_times.tolist(),
            "tempo": tempo_info.get("tempo"),
            "beat_times": tempo_info.get("beat_times"),
            "key": key_info.get("key"),
            "scale": key_info.get("scale"),
            "is_polyphonic": polyphony_info.get("is_polyphonic"),
            "stem_name": stem_name
        }
        
        # Update job with feature extraction results
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "feature_results": feature_results,
                "updated_at": datetime.utcnow(),
                "progress": 60  # 60% of the process complete
            }}
        )
        
        logger.info(f"Feature extraction completed for job {job_id}")
        
        # Prepare data for next task (note mapping)
        return {
            "job_id": job_id,
            "onset_times": onset_times.tolist(),
            "frequency": frequency.tolist(),
            "time": time.tolist(),
            "confidence": confidence.tolist(),
            "tempo": tempo_info.get("tempo"),
            "key": key_info.get("key"),
            "is_polyphonic": polyphony_info.get("is_polyphonic"),
            "sample_rate": sr,
            "stem_name": stem_name
        }
        
    except Exception as e:
        logger.error(f"Error in feature extraction for job {job_id}: {e}")
        
        # Update job with error
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": JobStatus.ERROR.value,
                "error_log": str(e),
                "error_stage": "feature_extraction",
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Re-raise the exception to break the chain
        raise
