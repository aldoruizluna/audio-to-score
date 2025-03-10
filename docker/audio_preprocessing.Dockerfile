FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    ffmpeg \
    libsndfile1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create a worker script for this service
RUN echo '#!/bin/bash\ncelery -A modules.audio_preprocessing.tasks worker --loglevel=info' > /app/start_worker.sh \
    && chmod +x /app/start_worker.sh

# Start the worker
CMD ["/app/start_worker.sh"]
