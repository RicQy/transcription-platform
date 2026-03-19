import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
from database import get_db
from worker import transcribe_audio_task

router = APIRouter(prefix="/audio", tags=["audio"])

UPLOAD_DIR = os.getenv("FILE_STORAGE_PATH", "/data")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/", response_model=List[schemas.AudioFileDto])
def list_audio_files(db: Session = Depends(get_db)):
    files = db.query(models.AudioFile).order_by(models.AudioFile.uploadDate.desc()).all()
    return files

@router.get("/{audio_id}", response_model=schemas.AudioFileDto)
def get_audio_file(audio_id: str, db: Session = Depends(get_db)):
    audio = db.query(models.AudioFile).filter(models.AudioFile.id == audio_id).first()
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
    return audio

@router.post("/", response_model=schemas.AudioFileDto)
def upload_audio_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    new_audio = models.AudioFile(
        filename=file.filename,
        filePath=file_path,
        duration=None,  # could parse duration here
        status=models.AudioStatusEnum.QUEUED
    )
    db.add(new_audio)
    db.commit()
    db.refresh(new_audio)

    # Queue Celery Task
    transcribe_audio_task.delay(new_audio.id, new_audio.filePath)

    return new_audio

@router.delete("/{audio_id}", status_code=204)
def delete_audio_file(audio_id: str, db: Session = Depends(get_db)):
    audio = db.query(models.AudioFile).filter(models.AudioFile.id == audio_id).first()
    if not audio:
        raise HTTPException(status_code=404, detail="Audio file not found")
        
    file_to_delete = audio.filePath
    try:
        transcripts = db.query(models.Transcript).filter(models.Transcript.audioFileId == audio_id).all()
        for t in transcripts:
            db.query(models.TranscriptSegment).filter(models.TranscriptSegment.transcriptId == t.id).delete()
        db.query(models.Transcript).filter(models.Transcript.audioFileId == audio_id).delete()
        db.delete(audio)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
        
    if file_to_delete and os.path.exists(file_to_delete):
        try:
            os.remove(file_to_delete)
        except Exception:
            pass
            
    return None
