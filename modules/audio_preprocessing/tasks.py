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


@celery_app.task(name='audio_preprocessing.process_audio')
def process_audio(job_id: str):
    """Process an audio file, normalizing and converting it as needed.
    
    Args:
        job_id: The ID of the job to process
    """
    logger.info(f"Starting audio preprocessing for job {job_id}")
    
    try:
        # Get job from database
        job = db.jobs.find_one({"job_id": job_id})
        if not job:
            logger.error(f"Job {job_id} not found")
            return False
        
        # Update job status
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": JobStatus.PROCESSING.value,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Create preprocessing output directory
        input_file = job.get("file_path")
        job_dir = os.path.join(settings.UPLOAD_FOLDER, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        # Initialize processor and process audio
        processor = AudioPreprocessor()
        processing_results = processor.process_audio(input_file, job_dir)
        
        # Update job with processing results
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "preprocessing_results": processing_results,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Trigger next step in pipeline (stem separation or feature extraction)
        # In a real implementation, check if stem separation is requested
        use_stem_separation = job.get("use_stem_separation", False)
        
        if use_stem_separation:
            # Trigger stem separation
            from ..stem_separation.tasks import separate_stems
            separate_stems.delay(job_id)
        else:
            # Skip to feature extraction
            from ..feature_extraction.tasks import extract_features
            extract_features.delay(job_id)
        
        logger.info(f"Audio preprocessing completed for job {job_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error processing audio for job {job_id}: {e}")
        
        # Update job with error
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": JobStatus.ERROR.value,
                "error_log": str(e),
                "updated_at": datetime.utcnow()
            }}
        )
        
        return False
