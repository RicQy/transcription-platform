from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import models
import auth
import audio
import style_guides
import transcripts

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Legal Transcribe API - Python Rewrite")

import os

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(audio.router)
app.include_router(style_guides.router)
app.include_router(transcripts.router)

from asr import transcribe
from fastapi import UploadFile, File
import shutil
import os

@app.post("/transcribe/direct")
async def transcribe_direct(file: UploadFile = File(...)):
    """Direct transcription endpoint for testing ASR logic without Celery."""
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        results = transcribe(temp_path)
        return {"filename": file.filename, "words": [w.model_dump() for w in results]}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/health")
def read_health():
    return {"status": "ok", "message": "FastAPI rewrite running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)
