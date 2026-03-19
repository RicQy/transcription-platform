from sqlalchemy import Column, String, Float, DateTime, Boolean, Integer, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum
import uuid

class RoleEnum(str, enum.Enum):
    ADMIN = 'ADMIN'
    TRANSCRIPTIONIST = 'TRANSCRIPTIONIST'

class AudioStatusEnum(str, enum.Enum):
    QUEUED = 'QUEUED'
    PROCESSING = 'PROCESSING'
    COMPLETE = 'COMPLETE'
    ERROR = 'ERROR'

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "User"
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, nullable=False)
    passwordHash = Column(String, nullable=False)
    role = Column(Enum(RoleEnum, name="Role"), default=RoleEnum.TRANSCRIPTIONIST)
    createdAt = Column(DateTime, server_default=func.now())

class AudioFile(Base):
    __tablename__ = "AudioFile"
    id = Column(String, primary_key=True, default=generate_uuid)
    filename = Column(String, nullable=False)
    filePath = Column(String, nullable=False)
    duration = Column(Float, nullable=True)
    uploadDate = Column(DateTime, server_default=func.now())
    status = Column(Enum(AudioStatusEnum, name="AudioStatus"), default=AudioStatusEnum.QUEUED)

class Transcript(Base):
    __tablename__ = "Transcript"
    id = Column(String, primary_key=True, default=generate_uuid)
    audioFileId = Column(String, ForeignKey("AudioFile.id"), nullable=False)
    userId = Column(String, ForeignKey("User.id"), nullable=True)
    version = Column(Integer, default=1)
    styleGuideVersionId = Column(String, ForeignKey("StyleGuideDocument.id"), nullable=True)
    lastModified = Column(DateTime, server_default=func.now(), onupdate=func.now())

class TranscriptSegment(Base):
    __tablename__ = "TranscriptSegment"
    id = Column(String, primary_key=True, default=generate_uuid)
    transcriptId = Column(String, ForeignKey("Transcript.id"), nullable=False)
    speaker = Column(String, nullable=False)
    text = Column(String, nullable=False)
    startTime = Column(Float, nullable=False)
    endTime = Column(Float, nullable=False)
    confidence = Column(Float, nullable=True)
    wordData = Column(JSON, nullable=False)

class StyleGuideDocument(Base):
    __tablename__ = "StyleGuideDocument"
    id = Column(String, primary_key=True, default=generate_uuid)
    pdfFilePath = Column(String, nullable=False)
    uploadDate = Column(DateTime, server_default=func.now())
    version = Column(String, nullable=False)
    isActive = Column(Boolean, default=False)
    parsedAt = Column(DateTime, nullable=True)

class StyleGuideRule(Base):
    __tablename__ = "StyleGuideRule"
    id = Column(String, primary_key=True, default=generate_uuid)
    guideId = Column(String, ForeignKey("StyleGuideDocument.id"), nullable=False)
    ruleType = Column(String, nullable=False)
    ruleText = Column(String, nullable=False)
    validationLogic = Column(String, nullable=True)
    sourcePage = Column(Integer, nullable=True)
    isActive = Column(Boolean, default=True)

class ValidationErrorRecord(Base):
    __tablename__ = "ValidationError"
    id = Column(String, primary_key=True, default=generate_uuid)
    transcriptId = Column(String, ForeignKey("Transcript.id"), nullable=False)
    segmentId = Column(String, ForeignKey("TranscriptSegment.id"), nullable=False)
    ruleId = Column(String, ForeignKey("StyleGuideRule.id"), nullable=True)
    errorType = Column(String, nullable=False)
    positionStart = Column(Integer, nullable=False)
    positionEnd = Column(Integer, nullable=False)
    message = Column(String, nullable=False)
    isResolved = Column(Boolean, default=False)

from pydantic import BaseModel
from typing import Optional

class WordResult(BaseModel):
    word: str
    start: float
    end: float
    confidence: float
    speaker_id: Optional[str] = None
