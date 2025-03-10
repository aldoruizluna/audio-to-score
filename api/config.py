"""Configuration settings for the Audio-to-Score Transcription API.

This module provides configuration settings for the API gateway and related services.
"""

import os

# Import from pydantic_settings since we've installed it
from pydantic_settings import BaseSettings, SettingsConfigDict

# Import dotenv for loading environment variables
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()




class Settings(BaseSettings):
    """Configuration settings for the application."""
    # API settings
    API_TITLE: str = "Audio-to-Score Transcription API"
    API_VERSION: str = "1.0.0"
    
    # MongoDB settings
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "audio_to_score")
    
    # Redis settings for task queue
    REDIS_URI: str = os.getenv("REDIS_URI", "redis://localhost:6379/0")
    
    # File upload settings
    UPLOAD_FOLDER: str = os.getenv("UPLOAD_FOLDER", "./uploads")
    MAX_CONTENT_LENGTH: int = int(os.getenv("MAX_CONTENT_LENGTH", str(100 * 1024 * 1024)))  # 100MB
    
    # JWT Authentication settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Processing settings
    DEFAULT_SAMPLE_RATE: int = 44100
    
    model_config = SettingsConfigDict(env_file='.env')


# Create settings instance
settings = Settings()
