"""Task queue module for the Audio Preprocessing service.

This module defines Celery tasks for asynchronous audio preprocessing operations.
"""

import os
import json
from celery import Celery
from pymongo import MongoClient
from datetime import datetime
import logging

from ..audio_preprocessing.processor import AudioPreprocessor
from api.config import settings
from api.models import JobStatus

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery('audio_preprocessing')
celery_app.conf.broker_url = settings.REDIS_URI
celery_app.conf.result_backend = settings.REDIS_URI

# MongoDB connection
mongo_client = MongoClient(settings.MONGODB_URI)
db = mongo_client[settings.DATABASE_NAME]


@celery_app.task(name='modules.audio_preprocessing.tasks.preprocess_audio', bind=True)
def preprocess_audio(self, job_id: str, file_path: str):
    """Process an audio file, normalizing and converting it as needed.
    
    Args:
        job_id: The ID of the job to process
        file_path: Path to the audio file
        
    Returns:
        Dictionary with preprocessing results to pass to the next task
    """
    logger.info(f"Starting audio preprocessing for job {job_id}")
    
    try:
        # Get job from database
        job = db.jobs.find_one({"job_id": job_id})
        if not job:
            logger.error(f"Job {job_id} not found")
            raise ValueError(f"Job {job_id} not found")
        
        # Update job status with step info
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": JobStatus.PROCESSING.value,
                "current_step": "audio_preprocessing",
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Create preprocessing output directory
        job_dir = os.path.join(settings.UPLOAD_FOLDER, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        # Initialize processor and process audio
        processor = AudioPreprocessor()
        processing_results = processor.process_audio(file_path, job_dir)
        
        # Update job with processing results
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "preprocessing_results": processing_results,
                "updated_at": datetime.utcnow(),
                "progress": 20  # 20% of the process complete
            }}
        )
        
        logger.info(f"Audio preprocessing completed for job {job_id}")
        
        # Return processed file path and metadata for the next task in the chain
        return {
            "job_id": job_id,
            "processed_file": processing_results["processed_path"],
            "original_file": file_path,
            "sample_rate": processing_results["sample_rate"],
            "duration": processing_results["duration"],
            "spectrogram_path": processing_results["spectrogram_path"]
        }
        
    except Exception as e:
        logger.error(f"Error processing audio for job {job_id}: {e}")
        
        # Update job with error
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": JobStatus.ERROR.value,
                "error_log": str(e),
                "error_stage": "audio_preprocessing",
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Re-raise the exception to break the Celery chain
        raise
