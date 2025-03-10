"""Authentication module for the Audio-to-Score Transcription API.

Provides a simplified authentication functionality for the MVP version.
"""

from fastapi import Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional


# Simplified authentication for MVP
# We'll use a dummy authentication function that always succeeds for testing
class User(BaseModel):
    """User model."""
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None


def get_current_user(token: str = None):
    """Get the current user for MVP testing.
    
    In the MVP version, this always returns a test user without actual validation.
    
    Args:
        token: Placeholder for future JWT token
        
    Returns:
        User: Always returns a test user for MVP testing
    """
    # For MVP, always return a test user without any validation
    return User(
        username="test_user",
        email="test@example.com",
        full_name="Test User",
        disabled=False
    )


def get_current_active_user(current_user: User = Depends(get_current_user)):
    """Get the current active user.
    
    For MVP, just returns the current user without validation.
    
    Args:
        current_user: The user to check
        
    Returns:
        User: The same user passed in
    """
    # For MVP, don't check if user is disabled
    return current_user
