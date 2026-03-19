import os
import sys
import time

# Add apps/api to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "apps/api")))

from asr import transcribe
from models import WordResult

AUDIO_PATH = r"d:\zenflow\legal-transcribe-app\apps\api\uploads\Exam (1).mp3"

print(f"Testing transcription on: {AUDIO_PATH}")
if not os.path.exists(AUDIO_PATH):
    print(f"ERROR: Audio file not found at {AUDIO_PATH}")
    sys.exit(1)

start_time = time.time()
try:
    # Use 'tiny' or 'base' for the test
    print("Loading model and transcribing...")
    results = transcribe(AUDIO_PATH, "tiny")
    end_time = time.time()
    
    print(f"Transcription SUCCESS (took {end_time - start_time:.2f}s)")
    print(f"Number of words: {len(results)}")
    if results:
        print("First 10 words:")
        for w in results[:10]:
            print(f"  {w.word} ({w.start:.2f}s - {w.end:.2f}s)")
except Exception as e:
    print(f"Transcription FAILURE: {e}")
    import traceback
    traceback.print_exc()
