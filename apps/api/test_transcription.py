import requests
import time
import os

API_URL = "http://localhost:3002"
EMAIL = "admin@transcribe.local"
PASSWORD = "password123"
AUDIO_PATH = r"C:\Users\USER\Downloads\Exam (1).mp3"
STYLE_GUIDE_PATH = r"C:\Users\USER\Downloads\T105_CV for Legal TranscribeMe Style Guide (LPE 6_9_25).pdf"

def test_flow():
    # 1. Login
    print("Logging in...")
    login_resp = requests.post(f"{API_URL}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    login_resp.raise_for_status()
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful.")

    # 2. Upload Style Guide
    print("Uploading style guide...")
    with open(STYLE_GUIDE_PATH, "rb") as f:
        sg_resp = requests.post(
            f"{API_URL}/style-guides/", 
            headers=headers,
            data={"version": "Legal 2026"},
            files={"file": (os.path.basename(STYLE_GUIDE_PATH), f, "application/pdf")}
        )
    sg_resp.raise_for_status()
    print("Style guide uploaded.")

    # 3. Upload Audio
    print("Uploading audio...")
    with open(AUDIO_PATH, "rb") as f:
        audio_resp = requests.post(
            f"{API_URL}/audio/",
            headers=headers,
            files={"file": (os.path.basename(AUDIO_PATH), f, "audio/mpeg")}
        )
    audio_resp.raise_for_status()
    audio_id = audio_resp.json()["id"]
    print(f"Audio uploaded. ID: {audio_id}")

    # 4. Poll Status
    print("Waiting for transcription...")
    for _ in range(30): # 5 minutes max
        status_resp = requests.get(f"{API_URL}/audio/{audio_id}", headers=headers)
        status_resp.raise_for_status()
        status = status_resp.json()["status"]
        print(f"Current status: {status}")
        
        if status == "COMPLETE":
            print("Transcription COMPLETE!")
            # Get transcript
            trans_resp = requests.get(f"{API_URL}/transcripts/audio/{audio_id}", headers=headers)
            trans_resp.raise_for_status()
            print("\nTranscript summary:")
            segments = trans_resp.json().get("segments", [])
            for s in segments[:5]:
                print(f"[{s['speaker']}] {s['text']}")
            return
        elif status == "ERROR":
            print("Transcription FAILED.")
            return
            
        time.sleep(10)
    
    print("Timed out waiting for transcription.")

if __name__ == "__main__":
    try:
        test_flow()
    except Exception as e:
        print(f"Error during test: {e}")
