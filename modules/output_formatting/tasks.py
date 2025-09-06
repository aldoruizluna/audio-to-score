"""Task queue module for the Output Formatting service.

This module defines Celery tasks for generating final output formats from mapped notes.
"""

import os
import json
import numpy as np
from celery import Celery
from pymongo import MongoClient
from datetime import datetime
import logging
import music21 as m21
import mido

from ..output_formatting.formatter import OutputFormatter
from api.config import settings
from api.models import JobStatus

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery('output_formatting')
celery_app.conf.broker_url = settings.REDIS_URI
celery_app.conf.result_backend = settings.REDIS_URI

# MongoDB connection
mongo_client = MongoClient(settings.MONGODB_URI)
db = mongo_client[settings.DATABASE_NAME]


@celery_app.task(name='modules.output_formatting.tasks.format_output', bind=True)
def format_output(self, note_mapping_results):
    """Generate final output files (MusicXML, MIDI, PDF) from note mapping results.
    
    Args:
        note_mapping_results: Dictionary with results from note mapping, including mapped notes
        
    Returns:
        Dictionary with paths to output files and completion information
    """
    # Extract job_id and notes from previous task results
    job_id = note_mapping_results.get('job_id')
    notes = note_mapping_results.get('notes', [])
    
    logger.info(f"Starting output formatting for job {job_id}")
    
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
                "current_step": "output_formatting",
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Extract music parameters from mapping results
        tempo = note_mapping_results.get('tempo', 120.0)
        key = note_mapping_results.get('key', 'C')
        instrument_type = note_mapping_results.get('instrument_type', 'bass')
        stem_name = note_mapping_results.get('stem_name')
        
        # Create output directory
        output_dir = os.path.join(settings.UPLOAD_FOLDER, job_id, "output")
        os.makedirs(output_dir, exist_ok=True)
        
        # Initialize formatter
        formatter = OutputFormatter()
        
        # Base filename for outputs
        if stem_name:
            base_filename = f"{job_id}_{stem_name}"
        else:
            base_filename = job_id
        
        # Generate MusicXML output
        musicxml_path = os.path.join(output_dir, f"{base_filename}.musicxml")
        musicxml_result = formatter.create_musicxml(
            notes=notes,
            output_path=musicxml_path,
            tempo=tempo,
            key=key,
            instrument_type=instrument_type
        )
        
        # Generate MIDI output
        midi_path = os.path.join(output_dir, f"{base_filename}.mid")
        midi_result = formatter.create_midi(
            notes=notes, 
            output_path=midi_path,
            tempo=tempo,
            instrument_type=instrument_type
        )
        
        # Generate PDF score if MusicXML was successful
        pdf_path = os.path.join(output_dir, f"{base_filename}.pdf")
        pdf_result = {}
        if musicxml_result.get('success', False):
            pdf_result = formatter.create_pdf_score(
                musicxml_path=musicxml_path,
                output_path=pdf_path
            )
        
        # Generate tablature for string instruments
        tab_path = None
        tab_result = {}
        if instrument_type in ['guitar', 'bass', 'ukulele']:
            tab_path = os.path.join(output_dir, f"{base_filename}_tab.pdf")
            tab_result = formatter.create_tablature(
                notes=notes,
                output_path=tab_path,
                instrument_type=instrument_type
            )
        
        # Compile results
        output_results = {
            "musicxml": {
                "path": musicxml_path,
                **musicxml_result
            },
            "midi": {
                "path": midi_path,
                **midi_result
            },
            "pdf": {
                "path": pdf_path,
                **pdf_result
            }
        }
        
        if tab_path:
            output_results["tablature"] = {
                "path": tab_path,
                **tab_result
            }
        
        # Update job with output results and mark as completed
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": JobStatus.COMPLETED.value,
                "output_results": output_results,
                "completed_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "progress": 100  # Job is complete
            }}
        )
        
        logger.info(f"Output formatting completed for job {job_id}")
        
        # Return result data
        return {
            "job_id": job_id,
            "output_paths": {
                "musicxml": musicxml_path,
                "midi": midi_path,
                "pdf": pdf_path,
                "tablature": tab_path
            },
            "completed": True
        }
        
    except Exception as e:
        logger.error(f"Error in output formatting for job {job_id}: {e}")
        
        # Update job with error
        db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": JobStatus.ERROR.value,
                "error_log": str(e),
                "error_stage": "output_formatting",
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Re-raise the exception to break the chain
        raise
