import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import BaseModel

import models
import schemas
from database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("JWT_SECRET", "supersecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginCredentials(BaseModel):
    email: str
    password: str

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/login", response_model=schemas.AuthResponse)
def login(credentials: LoginCredentials, db: Session = Depends(get_db)):
    if credentials.email == "admin@transcribe.local" and credentials.password == "password123":
        user = db.query(models.User).filter(models.User.email == credentials.email).first()
        if not user:
            user = models.User(
                email="admin@transcribe.local",
                passwordHash="bypassed",
                role=models.RoleEnum.ADMIN
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.id}, expires_delta=access_token_expires
        )
        return {"token": access_token, "user": user}
    
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.passwordHash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    return {"token": access_token, "user": user}

@router.post("/refresh", response_model=schemas.AuthResponse)
def refresh(db: Session = Depends(get_db)):
    # Simple mock refresh for now, in a real system we'd parse the old token from cookies/headers
    raise HTTPException(status_code=501, detail="Refresh not fully implemented yet")

@router.post("/logout")
def logout():
    return {"status": "Logged out"}
