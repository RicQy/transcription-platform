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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(audio.router)
app.include_router(style_guides.router)
app.include_router(transcripts.router)

@app.get("/health")
def read_health():
    return {"status": "ok", "message": "FastAPI rewrite running"}
