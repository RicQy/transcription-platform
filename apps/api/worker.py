import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
from celery import Celery
from database import SessionLocal
import models
import logging

# Import processing modules directly to surface errors
from asr import transcribe
from diarization import diarize
from merger import merge

logger = logging.getLogger(__name__)

_openai_client = None

def get_openai_client():
    global _openai_client
    if _openai_client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.warning("OPENAI_API_KEY is not set. Style guide refinement will be skipped.")
            return None
        from openai import OpenAI
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "asr_worker",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

def apply_legal_style_guide(db, transcript_id, segments_dto, audio_id):
    """Refine transcript segments based on active style guide rules using OpenAI."""
    active_guide = db.query(models.StyleGuideDocument).filter(models.StyleGuideDocument.isActive == True).first()
    if not active_guide:
        logger.info("No active style guide found. Skipping refinement.")
        return segments_dto

    rules = db.query(models.StyleGuideRule).filter(models.StyleGuideRule.guideId == active_guide.id).all()
    if not rules:
        logger.info("No rules found for active style guide. Skipping refinement.")
        return segments_dto

    rules_text = "\n".join([f"- [{r.ruleType}] {r.ruleText}" for r in rules])
    
    client = get_openai_client()
    if not client:
        logger.info("OpenAI client not initialized. Skipping refinement.")
        return segments_dto

    refined_segments = []
    logger.info(f"Starting refinement for {audio_id} (Segments: {len(segments_dto)})")
    
    # Process in batches of 10 segments
    for i in range(0, len(segments_dto), 10):
        batch = segments_dto[i:i+10]
        batch_text = "\n".join([f"{s['speaker']}: {s['text']}" for s in batch])
        
        prompt = f"""
You are an expert legal transcriptionist. Refine the following transcript segments according to these rules:
{rules_text}

TRANSCRIPT BATCH:
{batch_text}

Return ONLY the refined text for each segment, one per line, preserving the order. Do not add speaker labels unless the rules require changing them.
Exclusion: Do not change the meaning, only apply formatting and 'clean verbatim' rules if specified.
"""
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "system", "content": "You are a legal transcription style guide engine."},
                          {"role": "user", "content": prompt}]
            )
            refined_texts = response.choices[0].message.content.strip().split("\n")
            
            for j, segment in enumerate(batch):
                if j < len(refined_texts):
                    segment["text"] = refined_texts[j].strip()
                refined_segments.append(segment)
            logger.info(f"Refined batch {i//10 + 1}/{(len(segments_dto)-1)//10 + 1}")
        except Exception as e:
            logger.error(f"OpenAI error refining batch {i}: {e}")
            refined_segments.extend(batch) # Fallback to original

    return refined_segments
def transcribe_audio_task(audio_id: str, audio_path: str):
    logger.info(f"Starting ASR for {audio_id}")
    db = SessionLocal()
    audio = db.query(models.AudioFile).filter(models.AudioFile.id == audio_id).first()
    if not audio:
        db.close()
        return "Audio not found"
        
    audio.status = models.AudioStatusEnum.PROCESSING
    db.commit()
    
    try:
        # These are now guaranteed to be imported or the process would have failed at startup
        words = transcribe(audio_path, os.getenv("WHISPER_MODEL_SIZE", "base"))
        speaker_segments = diarize(audio_path)
        unified = merge(words, speaker_segments)
            
        # create Transcript and Segments
        transcript = models.Transcript(
            audioFileId=audio.id,
        )
        db.add(transcript)
        db.commit()
        db.refresh(transcript)
        
        segments_to_add = []
        current_segment = None
        
        for word in unified:
            speaker = getattr(word, "speaker_id", "Unknown") or "Unknown"
            if current_segment is None or current_segment["speaker"] != speaker or word.start - current_segment["endTime"] > 1.5:
                if current_segment:
                    segments_to_add.append(current_segment)
                current_segment = {
                    "speaker": speaker,
                    "text": word.word,
                    "startTime": word.start,
                    "endTime": word.end,
                    "confidence": word.confidence,
                    "wordData": [{"word": word.word, "start": word.start, "end": word.end, "confidence": word.confidence, "speakerId": speaker}]
                }
            else:
                current_segment["text"] += " " + word.word
                current_segment["endTime"] = word.end
                current_segment["wordData"].append({"word": word.word, "start": word.start, "end": word.end, "confidence": word.confidence, "speakerId": speaker})
        
        if current_segment:
            segments_to_add.append(current_segment)

        # --- Apply Legal Style Guidelines ---
        try:
            logger.info(f"Applying style guidelines for {audio_id}")
            segments_to_add = apply_legal_style_guide(db, transcript.id, segments_to_add, audio_id)
        except Exception as e:
            logger.error(f"Error applying style guide: {e}")

        for seg in segments_to_add:
            segment_db = models.TranscriptSegment(
                transcriptId=transcript.id,
                speaker=seg["speaker"],
                text=seg["text"].strip(),
                startTime=seg["startTime"],
                endTime=seg["endTime"],
                confidence=seg["confidence"],
                wordData=seg["wordData"]
            )
            db.add(segment_db)
        
        audio.status = models.AudioStatusEnum.COMPLETE
        db.commit()
        logger.info(f"Completed processing '{audio_path}' with style guide refinement.")
            
    except Exception as e:
        logger.error(f"Error processing {audio_id}: {e}")
        audio.status = models.AudioStatusEnum.ERROR
        db.commit()
    finally:
        db.close()
