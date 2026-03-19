FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg2 and audio processing
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Add models directory for volume mounting
RUN mkdir -p /app/models

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default port
EXPOSE 3001

# Default command (will be overridden by celery_worker in compose)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]
