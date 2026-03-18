FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./

# av wheel is pre-downloaded into the build context to avoid slow PyPI CDN
COPY wheels/ ./wheels/

# Install av from local wheel first
RUN pip install --no-cache-dir ./wheels/av-12.3.0-cp311-cp311-manylinux_2_17_x86_64.manylinux2014_x86_64.whl

# Install remaining dependencies
RUN pip install --no-cache-dir --timeout 300 --retries 5 -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
