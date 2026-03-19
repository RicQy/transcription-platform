import os
import sys

# Add apps/api to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "apps/api")))

print("Checking imports...")
try:
    from asr import transcribe
    print("ASR (Whisper) import SUCCESS")
except Exception as e:
    print(f"ASR (Whisper) import FAILURE: {e}")

try:
    from diarization import diarize
    print("Diarization import SUCCESS")
except Exception as e:
    print(f"Diarization import FAILURE: {e}")

try:
    from merger import merge
    print("Merger import SUCCESS")
except Exception as e:
    print(f"Merger import FAILURE: {e}")

try:
    import celery
    print(f"Celery version: {celery.__version__}")
except Exception as e:
    print(f"Celery import FAILURE: {e}")
