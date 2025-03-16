"""API Gateway for the Audio-to-Score Transcription System.

This module serves as the entry point for the Audio-to-Score Transcription System,
providing a RESTful API for uploading audio files, checking job status, and retrieving results.
"""

import os
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, BackgroundTasks, status
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from pymongo import MongoClient
from bson import ObjectId
import motor.motor_asyncio
import json

from config import settings
from models import JobStatus, JobResponse, InstrumentInfo
from auth import get_current_user

# Initialize FastAPI app
app = FastAPI(
    title="Audio-to-Score Transcription API",
    description="API for converting audio recordings to tablature and musical score formats",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Modify in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory
from fastapi.staticfiles import StaticFiles

# Create static directory if it doesn't exist
os.makedirs(os.path.join(os.path.dirname(__file__), "static"), exist_ok=True)

# Mount the static directory
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

# Database setup - using in-memory storage for MVP testing
# Flag to control whether to attempt database connections
USE_DATABASE = False  # Set to False for pure in-memory operation

# In-memory job storage
jobs = {}

# Skip database connection in MVP mode
if USE_DATABASE:
    try:
        # MongoDB setup
        mongo_client = MongoClient(settings.MONGODB_URI)
        db = mongo_client[settings.DATABASE_NAME]
        
        # Motor setup for async operations
        motor_client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URI)
        motor_db = motor_client[settings.DATABASE_NAME]
        
        print("Connected to MongoDB successfully")
    except Exception as e:
        print("MongoDB connection error: {}".format(e))
        print("Continuing with in-memory storage only")
        USE_DATABASE = False
else:
    print("Running in memory-only mode (no database connection)")
# We're using the USE_DATABASE flag above to control database connectivity
# No need for redundant variables
print("Using in-memory storage for MVP testing")

# API routes
@app.post("/upload", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload an audio file for transcription.
    
    Args:
        file (UploadFile): The audio file to process
        
    Returns:
        JobResponse: Job ID and initial status
    """
    # Validate file type - allowing more flexibility for MVP testing
    allowed_types = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp3"]
    content_type = file.content_type or ""
    
    # For MVP testing, be more flexible with content types
    is_audio_file = (
        content_type in allowed_types or
        file.filename.lower().endswith((".mp3", ".wav", ".ogg"))
    )
    
    if not is_audio_file:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: MP3, WAV"
        )
    
    # Generate unique job ID
    job_id = str(uuid.uuid4())
    
    # Save file to upload directory
    file_path = os.path.join(settings.UPLOAD_FOLDER, f"{job_id}_{file.filename}")
    os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
    
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    # Create job record
    job = {
        "job_id": job_id,
        "filename": file.filename,
        "file_path": file_path,
        "status": JobStatus.PENDING.value,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "result": None,
        "error_log": None
    }
    
    # Store job info either in MongoDB or in-memory
    if USE_DATABASE:
        await motor_db.jobs.insert_one(job)
    else:
        jobs[job_id] = job
    
    # Start processing pipeline asynchronously
    background_tasks.add_task(start_processing_pipeline, job_id)
    
    return JobResponse(job_id=job_id, status=JobStatus.PENDING.value)

async def start_processing_pipeline(job_id: str):
    """Process the audio file using librosa and create tab notation.
    
    Args:
        job_id: The ID of the job to process
    """
    # Update job status to PROCESSING
    if USE_DATABASE:
        await motor_db.jobs.update_one(
            {"job_id": job_id},
            {"$set": {"status": JobStatus.PROCESSING.value, "updated_at": datetime.utcnow()}}
        )
    else:
        if job_id in jobs:
            jobs[job_id]["status"] = JobStatus.PROCESSING.value
            jobs[job_id]["updated_at"] = datetime.utcnow()
    
    try:
        # Get the job information to access the file path
        if USE_DATABASE:
            job = await motor_db.jobs.find_one({"job_id": job_id})
        else:
            job = jobs.get(job_id)
        
        if not job:
            print(f"Job {job_id} not found")
            return
        
        file_path = job["file_path"]
        print(f"Processing file: {file_path}")
        
        # Import necessary libraries for audio processing
        import librosa
        import numpy as np
        
        # Load the audio file with librosa
        y, sr = librosa.load(file_path, mono=True)
        
        # Bass guitar standard tuning (E A D G, from lowest to highest)
        bass_strings = {
            "E": 41.20,  # E1 (MIDI note 28)
            "A": 55.00,  # A1 (MIDI note 33)
            "D": 73.42,  # D2 (MIDI note 38)
            "G": 98.00   # G2 (MIDI note 43)
        }
        
        # Extract onset times using librosa onset detection
        onset_frames = librosa.onset.onset_detect(y=y, sr=sr, 
                                           units='frames', 
                                           hop_length=512,
                                           backtrack=True)
        onset_times = librosa.frames_to_time(onset_frames, sr=sr)
        
        # Limit the number of onsets to analyze (for speed in MVP)
        max_onsets = 30
        if len(onset_times) > max_onsets:
            onset_times = onset_times[:max_onsets]
            
        # For each onset, extract pitch and assign to appropriate string/fret
        notes = []
        tablature_strings = [
            {"name": "G", "notes": []},
            {"name": "D", "notes": []},
            {"name": "A", "notes": []},
            {"name": "E", "notes": []}
        ]
        
        # Process each detected onset
        for i, onset_time in enumerate(onset_times):
            # Calculate offset time (duration of note)
            offset_time = onset_times[i + 1] if i < len(onset_times) - 1 else onset_time + 0.5
            duration = min(offset_time - onset_time, 1.0)  # Cap duration at 1 second for MVP
            
            # Extract audio segment around onset
            start_sample = int(onset_time * sr)
            end_sample = min(len(y), start_sample + int(0.1 * sr))  # 100ms window for analysis
            
            if start_sample >= len(y) or end_sample <= start_sample:
                continue
                
            segment = y[start_sample:end_sample]
            
            # Extract pitch information
            if len(segment) > 0:
                # Compute pitches using pitch tracking
                pitches, magnitudes = librosa.piptrack(y=segment, sr=sr)
                
                # Find the highest magnitude pitch
                if magnitudes.size > 0:  # Check if we have valid data
                    pitch_idx = magnitudes.argmax()
                    pitch_freq = pitches.flatten()[pitch_idx]
                    
                    # Skip if pitch detection failed or is unreliable
                    if pitch_freq <= 0 or np.isnan(pitch_freq):
                        continue
                        
                    # Convert frequency to MIDI note number for easier processing
                    midi_note = librosa.hz_to_midi(pitch_freq)
                    pitch_name = librosa.midi_to_note(midi_note)
                    
                    # Determine which string and fret to use
                    string_idx = 3  # Default to E string (lowest)
                    fret = 0        # Default to open string
                    
                    # Assign to appropriate string/fret combination
                    if midi_note >= 43:  # G string range
                        string_idx = 0  # G string (highest)
                        fret = int(round(midi_note - 43))
                    elif midi_note >= 38:  # D string range
                        string_idx = 1  # D string
                        fret = int(round(midi_note - 38))
                    elif midi_note >= 33:  # A string range
                        string_idx = 2  # A string
                        fret = int(round(midi_note - 33))
                    else:  # E string range
                        string_idx = 3  # E string (lowest)
                        fret = int(round(midi_note - 28))
                    
                    # Cap frets at 24 (standard bass range)
                    fret = min(fret, 24)
                    fret = max(fret, 0)
                    
                    # Create note object
                    note = {
                        "time": float(onset_time),
                        "duration": float(duration),
                        "string": string_idx,
                        "fret": fret,
                        "pitch": pitch_name
                    }
                    
                    notes.append(note)
                    
                    # Add to tablature string array
                    tablature_strings[string_idx]["notes"].append({
                        "time": float(onset_time),
                        "fret": fret,
                        "duration": float(duration)
                    })
        
        # Calculate tempo using onset times
        tempo = 120  # Default tempo
        if len(onset_times) >= 2:
            onset_diffs = np.diff(onset_times)
            # Filter out very short or long intervals
            valid_diffs = onset_diffs[(onset_diffs > 0.1) & (onset_diffs < 2.0)]
            if len(valid_diffs) > 0:
                avg_beat_duration = np.median(valid_diffs)  # Use median for robustness
                tempo = int(60 / avg_beat_duration)  # Convert to BPM
                # Keep tempo within reasonable bounds
                tempo = max(60, min(tempo, 200))  # Between 60-200 BPM
        
        # Create the result
        result = {
            "notes": notes,
            "tempo": tempo,
            "instrument": "Bass",
            "tuning": "Standard (E A D G)",
            "tablature": {
                "strings": tablature_strings
            }
        }
        
        # Update job with transcription result
        if USE_DATABASE:
            await motor_db.jobs.update_one(
                {"job_id": job_id},
                {"$set": {
                    "status": JobStatus.COMPLETED.value, 
                    "updated_at": datetime.utcnow(),
                    "result": result
                }}
            )
        else:
            if job_id in jobs:
                jobs[job_id]["status"] = JobStatus.COMPLETED.value
                jobs[job_id]["updated_at"] = datetime.utcnow()
                jobs[job_id]["result"] = result
                
    except Exception as e:
        # Log the error and update job status
        error_message = f"Error processing file: {str(e)}"
        print(error_message)
        import traceback
        traceback.print_exc()
        
        if USE_DATABASE:
            await motor_db.jobs.update_one(
                {"job_id": job_id},
                {"$set": {
                    "status": JobStatus.ERROR.value,
                    "updated_at": datetime.utcnow(),
                    "error_log": error_message
                }}
            )
        else:
            if job_id in jobs:
                jobs[job_id]["status"] = JobStatus.ERROR.value
                jobs[job_id]["updated_at"] = datetime.utcnow()
                jobs[job_id]["error_log"] = error_message

@app.get("/status/{job_id}", response_model=JobResponse)
async def get_job_status(job_id: str):
    """Get the current status of a processing job.
    
    Args:
        job_id (str): The ID of the job to check
        
    Returns:
        JobResponse: Current job status
    """
    if USE_DATABASE:
        job = await motor_db.jobs.find_one({"job_id": job_id})
    else:
        job = jobs.get(job_id)
    
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job with ID {job_id} not found"
        )
    
    return JobResponse(
        job_id=job["job_id"],
        status=job["status"],
        error=job.get("error_log")
    )

@app.get("/result/{job_id}")
async def get_job_result(job_id: str, format: str = "json"):
    """Get the results of a completed job.
    
    Args:
        job_id (str): The ID of the completed job
        format (str): The desired output format (json, pdf, musicxml)
        
    Returns:
        The transcription result in the requested format
    """
    if USE_DATABASE:
        job = await motor_db.jobs.find_one({"job_id": job_id})
    else:
        job = jobs.get(job_id)
    
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job with ID {job_id} not found"
        )
    
    # Check if the original file still exists
    if job.get("file_path") and not os.path.exists(job["file_path"]):
        # File no longer exists, update job status to reflect this
        error_message = f"Original audio file no longer exists: {os.path.basename(job['file_path'])}"
        
        if USE_DATABASE:
            await motor_db.jobs.update_one(
                {"job_id": job_id},
                {"$set": {
                    "status": JobStatus.ERROR.value,
                    "error_log": error_message,
                    "updated_at": datetime.utcnow()
                }}
            )
        else:
            jobs[job_id]["status"] = JobStatus.ERROR.value
            jobs[job_id]["error_log"] = error_message
            jobs[job_id]["updated_at"] = datetime.utcnow()
        
        raise HTTPException(
            status_code=404,
            detail=error_message
        )
    
    if job["status"] != JobStatus.COMPLETED.value:
        raise HTTPException(
            status_code=400,
            detail=f"Job is not completed yet. Current status: {job['status']}"
        )
    
    if not job.get("result"):
        raise HTTPException(
            status_code=404,
            detail="No result found for this job"
        )
    
    # Handle different output formats
    if format == "json":
        return job["result"]
    elif format == "pdf":
        # In a real implementation, this would retrieve or generate a PDF file
        pdf_path = job["result"].get("pdf_path")
        if not pdf_path or not os.path.exists(pdf_path):
            raise HTTPException(
                status_code=404,
                detail="PDF result not available"
            )
        return FileResponse(pdf_path, media_type="application/pdf")
    elif format == "musicxml":
        # In a real implementation, this would retrieve or generate a MusicXML file
        musicxml_path = job["result"].get("musicxml_path")
        if not musicxml_path or not os.path.exists(musicxml_path):
            raise HTTPException(
                status_code=404,
                detail="MusicXML result not available"
            )
        return FileResponse(musicxml_path, media_type="application/xml")
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {format}. Supported formats: json, pdf, musicxml"
        )

@app.get("/instruments", response_model=List[InstrumentInfo])
async def get_supported_instruments():
    """Get information about supported instruments and tunings.
    
    Returns:
        List[InstrumentInfo]: List of supported instruments and their tunings
    """
    # This would typically come from a database, but for simplicity, we'll hardcode a few examples
    instruments = [
        InstrumentInfo(
            name="Guitar",
            tunings=["Standard (E A D G B E)", "Drop D (D A D G B E)", "Half-step down (Eb Ab Db Gb Bb Eb)"],
            string_count=6
        ),
        InstrumentInfo(
            name="Bass",
            tunings=["Standard (E A D G)", "5-string (B E A D G)", "Drop D (D A D G)"],
            string_count=4
        ),
        InstrumentInfo(
            name="Ukulele",
            tunings=["Standard (G C E A)", "Baritone (D G B E)"],
            string_count=4
        )
    ]
    
    return instruments

@app.get("/", include_in_schema=False)
async def serve_interface():
    """Serve the main web interface."""
    return FileResponse(os.path.join(os.path.dirname(__file__), "static/index.html"))

@app.get("/api")
async def root():
    """API health check endpoint."""
    return {"message": "Audio-to-Score Transcription API is running"}

# Add a debug endpoint to check app status including database connection
@app.get("/debug/status")
async def debug_status():
    """Debug endpoint to check application status."""
    return {
        "status": "online",
        "using_database": use_db,
        "in_memory_jobs": len(in_memory_jobs),
        "uploads_directory": os.path.exists(settings.UPLOAD_FOLDER)
    }

if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
