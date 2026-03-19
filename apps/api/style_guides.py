import os
import shutil
import pdfplumber
import re
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
from database import get_db

router = APIRouter(prefix="/style-guides", tags=["style_guides"])

UPLOAD_DIR = os.getenv("FILE_STORAGE_PATH", "/data")

@router.post("/", response_model=schemas.StyleGuideDocumentDto)
def upload_style_guide(
    version: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    doc = models.StyleGuideDocument(
        pdfFilePath=file_path,
        version=version,
        isActive=True
    )
    db.add(doc)
    
    # Deactivate others
    db.query(models.StyleGuideDocument).filter(models.StyleGuideDocument.id != doc.id).update({"isActive": False})
    db.commit()
    db.refresh(doc)
    
    # PDF parsing logic for Style Guide rules extraction
    try:
        with pdfplumber.open(file_path) as pdf:
            full_text = ""
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + "\n"
        
        # Simple heuristic to extract rules from text
        rules_to_add = []
        lines = full_text.split("\n")
        current_rule_text = ""
        current_rule_type = "General"

        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Treat lines starting with Rule:, -, •, or * as potential rules
            if line.lower().startswith("rule:") or line.startswith("-") or line.startswith("•") or line.startswith("*"):
                if current_rule_text:
                    rules_to_add.append(
                        models.StyleGuideRule(
                            guideId=doc.id,
                            ruleType=current_rule_type,
                            ruleText=current_rule_text.strip()
                        )
                    )
                # Remove bullet prefix if present
                clean_line = re.sub(r'^(Rule:|[-•*])\s*', '', line, flags=re.IGNORECASE)
                current_rule_text = clean_line
                
                # Try assigning rule type based on keywords
                if "speaker" in clean_line.lower():
                    current_rule_type = "SpeakerFormatting"
                elif "tag" in clean_line.lower() or "inaudible" in clean_line.lower():
                    current_rule_type = "TagUsage"
                else:
                    current_rule_type = "General"
            else:
                if current_rule_text:
                    current_rule_text += " " + line

        # Add the last rule
        if current_rule_text:
            rules_to_add.append(
                models.StyleGuideRule(
                    guideId=doc.id,
                    ruleType=current_rule_type,
                    ruleText=current_rule_text.strip()
                )
            )
            
        # Fallback if nothing extracted
        if not rules_to_add:
            rules_to_add = [
                models.StyleGuideRule(
                    guideId=doc.id,
                    ruleType="SpeakerFormatting",
                    ruleText="Speaker labels must be formatted as Speaker 1:",
                ),
                models.StyleGuideRule(
                    guideId=doc.id,
                    ruleType="TagUsage",
                    ruleText="Use [inaudible] when audio cannot be understood.",
                )
            ]
            
        db.add_all(rules_to_add)
        doc.parsedAt = models.func.now()
        db.commit()
        db.refresh(doc)
        
    except Exception as e:
        # Ignore parse errors for dummy processing
        pass
        
    return doc

@router.get("/", response_model=List[schemas.StyleGuideDocumentDto])
def list_style_guides(db: Session = Depends(get_db)):
    guides = db.query(models.StyleGuideDocument).order_by(models.StyleGuideDocument.uploadDate.desc()).all()
    # Eager load rules?
    for g in guides:
        g.rules = db.query(models.StyleGuideRule).filter(models.StyleGuideRule.guideId == g.id).all()
    return guides
