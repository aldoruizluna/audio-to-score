"""Task queue module for the Note Mapping service.

This module defines Celery tasks for mapping audio features to musical notes.
"""

import os
import json
import numpy as np
from celery import Celery
from pymongo import MongoClient
from datetime import datetime
import logging

from ..note_mapping.mapper import NoteMapper
from api.config import settings
from api.models import JobStatus

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery('note_mapping')
celery_app.conf.broker_url = settings.REDIS_URI
celery_app.conf.result_backend = settings.REDIS_URI

# MongoDB connection
mongo_client = MongoClient(settings.MONGODB_URI)
db = mongo_client[settings.DATABASE_NAME]


@celery_app.task(name='modules.note_mapping.tasks.map_to_notes', bind=True)
def map_to_notes(self, feature_results):
    """Map extracted features to musical notes.
    
    Args:
        feature_results: Dictionary with results from feature extraction,
                        including frequencies, onsets, and other musical information
                        
    Returns:
        Dictionary with note mapping results for the next task in the chain
    """
    # Extract job_id and feature data from previous task results
    job_id = feature_results.get('job_id')
    
    logger.info(f"Starting note mapping for job {job_id}")
    
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
                "current_step": "note_mapping",
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Extract required data from feature results
        onset_times = np.array(feature_results.get('onset_times', []))
        time = np.array(feature_results.get('time', []))
        frequency = np.array(feature_results.get('frequency', []))
        confidence = np.array(feature_results.get('confidence', []))
        tempo = feature_results.get('tempo')
        key = feature_results.get('key')
        is_polyphonic = feature_results.get('is_polyphonic', False)
        sample_rate = feature_results.get('sample_rate')
        stem_name = feature_results.get('stem_name')
        
        # Create mapping output directory
        job_dir = os.path.join(settings.UPLOAD_FOLDER, job_id, "notes")
        os.makedirs(job_dir, exist_ok=True)
        
        # Initialize note mapper with instrument type from job parameters
        instrument_type = job.get("instrument_type", "bass")
        mapper = NoteMapper(instrument_type=instrument_type)
        
        # Map frequencies to notes
        note_mapping_results = mapper.map_frequencies_to_notes(
            onset_times=onset_times,
            time=time, 
            frequency=frequency,
            confidence=confidence,
            tempo=tempo,
            key=key,
            is_polyphonic=is_polyphonic
        )
        
        # Save note data to file
        notes_file = os.path.join(job_dir, f"{job_id}_notes.json")
        with open(notes_file, 'w') as f:
            json.dump(note_mapping_results, f, indent=2)
        
        # Update job with note mapping results
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "note_mapping_results": note_mapping_results,
                "updated_at": datetime.utcnow(),
                "progress": 80  # 80% of the process complete
            }}
        )
        
        logger.info(f"Note mapping completed for job {job_id}")
        
        # Prepare data for next task (output formatting)
        return {
            "job_id": job_id,
            "notes": note_mapping_results['notes'],
            "tempo": tempo,
            "key": key,
            "instrument_type": instrument_type,
            "stem_name": stem_name,
            "is_polyphonic": is_polyphonic,
            "notes_file": notes_file
        }
        
    except Exception as e:
        logger.error(f"Error in note mapping for job {job_id}: {e}")
        
        # Update job with error
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": JobStatus.ERROR.value,
                "error_log": str(e),
                "error_stage": "note_mapping",
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Re-raise the exception to break the chain
        raise
