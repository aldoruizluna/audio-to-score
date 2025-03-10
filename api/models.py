"""Data models for the Audio-to-Score Transcription API.

This module defines the Pydantic models used for request/response validation
and documentation in the API gateway.
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class JobStatus(str, Enum):
    """Enum representing possible job statuses."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"


class JobResponse(BaseModel):
    """Response model for job-related endpoints."""
    job_id: str
    status: str
    error: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class InstrumentInfo(BaseModel):
    """Model representing information about a supported instrument."""
    name: str
    tunings: List[str]
    string_count: int
    description: Optional[str] = None


class TranscriptionResult(BaseModel):
    """Model representing the result of a transcription job."""
    notes: List[Dict[str, Any]]
    tablature: List[Dict[str, Any]]
    instrument: str
    tuning: str
    bpm: Optional[float] = None
    key_signature: Optional[str] = None
    time_signature: Optional[str] = None
    pdf_path: Optional[str] = None
    musicxml_path: Optional[str] = None
    midi_path: Optional[str] = None


class Note(BaseModel):
    """Model representing a single musical note."""
    pitch: str
    start_time: float
    duration: float
    velocity: int = 64
    string: Optional[int] = None
    fret: Optional[int] = None
    technique: Optional[str] = None


class StemInfo(BaseModel):
    """Model representing information about a separated stem."""
    name: str
    file_path: str
    instrument_type: Optional[str] = None
