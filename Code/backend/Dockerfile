# ==============================================================================
# PDF-Lingua Backend Dockerfile
# Production-ready container image for Render, Koyeb, Railway, or VPS deployment
# Includes Python 3.12, Tesseract OCR with Vietnamese/English data, and Poppler
# ==============================================================================

FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Set working directory inside container
WORKDIR /app

# Install system dependencies:
# - tesseract-ocr, tesseract-ocr-vie, tesseract-ocr-eng for multi-language OCR
# - poppler-utils for PDF image extraction
# - libgl1 and libglib2.0-0 for image processing dependencies
# - curl for health check probing
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-vie \
    tesseract-ocr-eng \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker layer caching
COPY requirements.txt .

# Upgrade pip and install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Create persistent storage directories if they do not exist
RUN mkdir -p /app/storage/documents /app/storage/ads /app/temp_uploads /app/logs

# Default port (Render injects PORT environment variable dynamically)
ENV PORT=8000
EXPOSE 8000

# Health check to ensure the service is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Start Uvicorn ASGI server with dynamic port support
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
