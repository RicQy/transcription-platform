from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
from database import get_db

router = APIRouter(prefix="/transcripts", tags=["transcripts"])

@router.get("/", response_model=List[schemas.TranscriptDto])
def list_transcripts(db: Session = Depends(get_db)):
    transcripts = db.query(models.Transcript).order_by(models.Transcript.lastModified.desc()).all()
    # Eager loading segments in a real app
    for t in transcripts:
        t.segments = db.query(models.TranscriptSegment).filter(models.TranscriptSegment.transcriptId == t.id).all()
    return transcripts

@router.get("/{transcript_id}", response_model=schemas.TranscriptDto)
def get_transcript(transcript_id: str, db: Session = Depends(get_db)):
    transcript = db.query(models.Transcript).filter(models.Transcript.id == transcript_id).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
        
    transcript.segments = db.query(models.TranscriptSegment).filter(models.TranscriptSegment.transcriptId == transcript.id).all()
    return transcript

@router.put("/{transcript_id}/segments/{segment_id}")
def update_segment(transcript_id: str, segment_id: str, payload: dict, db: Session = Depends(get_db)):
    segment = db.query(models.TranscriptSegment).filter(models.TranscriptSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
        
    if "text" in payload:
        segment.text = payload["text"]
    if "speaker" in payload:
        segment.speaker = payload["speaker"]
        
    db.commit()
    db.refresh(segment)
    return segment
