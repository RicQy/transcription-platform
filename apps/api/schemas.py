from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    email: str
    role: str

class UserCreate(UserBase):
    password: str

class UserDto(UserBase):
    id: str
    createdAt: datetime

    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    user: UserDto
    token: str

class AudioFileDto(BaseModel):
    id: str
    filename: str
    duration: Optional[float]
    uploadDate: datetime
    status: str

    class Config:
        from_attributes = True

class WordData(BaseModel):
    word: str
    start: float
    end: float
    confidence: float
    speakerId: str
    verified: Optional[bool] = False

class TranscriptSegmentDto(BaseModel):
    id: str
    transcriptId: str
    speaker: str
    text: str
    startTime: float
    endTime: float
    confidence: Optional[float]
    wordData: List[WordData]

    class Config:
        from_attributes = True

class TranscriptDto(BaseModel):
    id: str
    audioFileId: str
    version: int
    lastModified: datetime
    segments: List[TranscriptSegmentDto]

    class Config:
        from_attributes = True

class StyleGuideRuleDto(BaseModel):
    id: str
    guideId: str
    ruleType: str
    ruleText: str
    validationLogic: Optional[str]
    sourcePage: Optional[int]
    isActive: bool

    class Config:
        from_attributes = True

class StyleGuideDocumentDto(BaseModel):
    id: str
    version: str
    uploadDate: datetime
    isActive: bool
    parsedAt: Optional[datetime]
    rules: Optional[List[StyleGuideRuleDto]] = None

    class Config:
        from_attributes = True
