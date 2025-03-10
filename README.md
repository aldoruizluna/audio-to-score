# Audio-to-Score Transcription System

A modular, AI-driven system that converts audio recordings from string instruments (guitar, bass, ukulele, etc.) into detailed tablature notation and other musical score formats.

## Overview

This system processes audio files through a pipeline of modules to generate accurate musical transcriptions:

1. **Audio Ingestion & Preprocessing** - Upload, validation, normalization and format conversion
2. **Stem Separation** (Optional) - Separate full songs into individual instrument stems
3. **Feature Extraction & Analysis** - Generate spectrograms and analyze audio features
4. **Pitch Detection & Transcription** - Convert audio to note sequences
5. **Note Mapping & Tablature Conversion** - Map notes to instrument-specific tablature
6. **Output Formatting & Delivery** - Format and deliver results in various formats

## Architecture

The system is built using a microservices architecture with modular components that can be run individually or as a complete pipeline. Each service is containerized for easy deployment.

## Getting Started

### Prerequisites

- Python 3.8+
- Docker and Docker Compose
- FFmpeg

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/audio-to-score.git
   cd audio-to-score
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Run locally:
   ```
   python -m api.main
   ```

4. Or with Docker:
   ```
   docker-compose up
   ```

## API Usage

The system exposes the following API endpoints:

- `POST /upload` - Upload audio files for processing
- `GET /status/{job_id}` - Check the status of a processing job
- `GET /result/{job_id}` - Retrieve transcription results

See the [API Documentation](docs/api.md) for more details.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

This project integrates and builds upon several open-source projects:

- [Librosa](https://librosa.org/) - Audio analysis
- [CREPE](https://github.com/marl/crepe) - Pitch detection
- [Spleeter](https://github.com/deezer/spleeter) - Source separation
- [Whisper](https://github.com/openai/whisper) - Transcription
- [MuseScore](https://musescore.org/) - Score visualization
