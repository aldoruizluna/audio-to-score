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


@celery_app.task(name='modules.stem_separation.tasks.separate_stems', bind=True)
def separate_stems(self, preprocessing_results):
    """Separate audio into instrument stems using Spleeter.
    
    Args:
        preprocessing_results: Dictionary with results from previous task including job_id and processed_file
        
    Returns:
        Dictionary with stem separation results for the next task in the chain
    """
    # Extract job_id and processed file path from previous task results
    job_id = preprocessing_results.get('job_id')
    processed_audio_path = preprocessing_results.get('processed_file')
    
    logger.info(f"Starting stem separation for job {job_id}")
    
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
                "current_step": "stem_separation",
                "updated_at": datetime.utcnow()
            }}
        )
        
        if not processed_audio_path or not os.path.exists(processed_audio_path):
            logger.error(f"Processed audio file not found for job {job_id}")
            raise FileNotFoundError(f"Processed audio file not found: {processed_audio_path}")
        
        # Create stem separation output directory
        job_dir = os.path.join(settings.UPLOAD_FOLDER, job_id, "stems")
        os.makedirs(job_dir, exist_ok=True)
        
        # Check if stem separation is requested
        use_stem_separation = job.get("use_stem_separation", False)
        
        # If stem separation is not needed, return the original file
        if not use_stem_separation:
            logger.info(f"Stem separation skipped for job {job_id} as not requested")
            
            # Update job with progress
            db.jobs.update_one(
                {"job_id": job_id},
                {"$set": {
                    "stem_results": {"status": "skipped"},
                    "updated_at": datetime.utcnow(),
                    "progress": 40  # 40% of the process complete
                }}
            )
            
            # Return the original processed file
            return {
                "job_id": job_id,
                "file_to_process": processed_audio_path,
                "sample_rate": preprocessing_results.get('sample_rate'),
                "is_stem": False,
                "stem_name": None
            }
        
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
                "updated_at": datetime.utcnow(),
                "progress": 40  # 40% of the process complete
            }}
        )
        
        # Get identified stems
        stem_paths = stem_results.get("stem_paths", {})
        
        # Process best stem for the main job (e.g., bass for bass transcription)
        instrument_type = job.get("instrument_type", "bass")
        target_stem = instrument_type
        
        # Map instrument_type to the closest stem name in Spleeter output
        instrument_to_stem_map = {
            "bass": "bass",
            "guitar": "other", # Usually in 'other' stem 
            "drums": "drums",
            "piano": "piano" if "piano" in stem_paths else "other",
            "vocals": "vocals"
        }
        
        best_stem = instrument_to_stem_map.get(instrument_type, "other")
        
        # If the desired stem is not available, fall back to another stem or the original
        if best_stem not in stem_paths:
            if len(stem_paths) > 0:
                # Just use the first available stem
                best_stem = list(stem_paths.keys())[0]
                logger.info(f"Target stem {target_stem} not found, using {best_stem} instead")
            else:
                # No stems found, use the original audio
                logger.info(f"No stems found, using original audio for job {job_id}")
                return {
                    "job_id": job_id,
                    "file_to_process": processed_audio_path,
                    "sample_rate": preprocessing_results.get('sample_rate'),
                    "is_stem": False,
                    "stem_name": None
                }
        
        # Use the best matching stem
        best_stem_path = stem_paths.get(best_stem)
        
        logger.info(f"Stem separation completed for job {job_id}, using stem: {best_stem}")
        
        # Return the stem file to process
        return {
            "job_id": job_id,
            "file_to_process": best_stem_path,
            "sample_rate": preprocessing_results.get('sample_rate'),
            "is_stem": True,
            "stem_name": best_stem
        }
        
    except Exception as e:
        logger.error(f"Error in stem separation for job {job_id}: {e}")
        
        # Update job with error
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": JobStatus.ERROR.value,
                "error_log": str(e),
                "error_stage": "stem_separation",
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Re-raise the exception to break the chain
        raise
