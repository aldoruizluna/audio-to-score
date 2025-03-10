"""Task queue module for the Stem Separation service.

This module defines Celery tasks for asynchronous stem separation operations.
"""

import os
import json
from celery import Celery
from pymongo import MongoClient
from datetime import datetime
import logging

from ..stem_separation.separator import StemSeparator
from api.config import settings
from api.models import JobStatus

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery('stem_separation')
celery_app.conf.broker_url = settings.REDIS_URI
celery_app.conf.result_backend = settings.REDIS_URI

# MongoDB connection
mongo_client = MongoClient(settings.MONGODB_URI)
db = mongo_client[settings.DATABASE_NAME]


@celery_app.task(name='stem_separation.separate_stems')
def separate_stems(job_id: str):
    """Separate audio into instrument stems using Spleeter.
    
    Args:
        job_id: The ID of the job to process
    """
    logger.info(f"Starting stem separation for job {job_id}")
    
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
        
        # Get preprocessing results
        preprocessing_results = job.get("preprocessing_results", {})
        processed_audio_path = preprocessing_results.get("processed_path")
        
        if not processed_audio_path or not os.path.exists(processed_audio_path):
            logger.error(f"Processed audio file not found for job {job_id}")
            raise FileNotFoundError(f"Processed audio file not found: {processed_audio_path}")
        
        # Create stem separation output directory
        job_dir = os.path.join(settings.UPLOAD_FOLDER, job_id, "stems")
        os.makedirs(job_dir, exist_ok=True)
        
        # Initialize separator and process audio
        # Use model selection from job parameters or default to 4stems
        stem_model = job.get("stem_model", "spleeter:4stems")
        separator = StemSeparator(model_name=stem_model)
        
        # Process stems
        stem_results = separator.process_stems(processed_audio_path, job_dir)
        
        # Update job with stem separation results
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "stem_results": stem_results,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Get identified stems
        stem_paths = stem_results.get("stem_paths", {})
        
        # Process each stem separately if multiple instruments were detected
        if len(stem_paths) > 1:
            # Create a sub-job for each stem
            for stem_name, stem_path in stem_paths.items():
                # Skip vocals unless specifically requested
                if stem_name == "vocals" and not job.get("process_vocals", False):
                    logger.info(f"Skipping vocals stem for job {job_id} as requested")
                    continue
                
                # Create a sub-job for this stem
                stem_job_id = f"{job_id}_{stem_name}"
                
                # Save the sub-job information
                stem_job = {
                    "job_id": stem_job_id,
                    "parent_job_id": job_id,
                    "stem_name": stem_name,
                    "file_path": stem_path,
                    "status": JobStatus.PENDING.value,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                # Insert or update the stem job
                db.jobs.update_one(
                    {"job_id": stem_job_id},
                    {"$set": stem_job},
                    upsert=True
                )
                
                # Trigger feature extraction for this stem
                from ..feature_extraction.tasks import extract_features
                extract_features.delay(stem_job_id)
            
            logger.info(f"Created {len(stem_paths)} sub-jobs for stems from job {job_id}")
        else:
            # No stems found or only one stem - proceed with original audio
            logger.info(f"No multiple stems found, proceeding with original audio for job {job_id}")
            
            # Trigger feature extraction for the original processed audio
            from ..feature_extraction.tasks import extract_features
            extract_features.delay(job_id)
        
        logger.info(f"Stem separation completed for job {job_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error in stem separation for job {job_id}: {e}")
        
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
