import os
import sys
from dotenv import load_dotenv

# Add apps/api to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "apps/api")))

from database import SessionLocal
import models

print("Testing Database connection...")
try:
    db = SessionLocal()
    # Try a simple query
    user_count = db.query(models.User).count()
    print(f"Database connection SUCCESS! User count: {user_count}")
    
    # Check for active style guides
    active_guide = db.query(models.StyleGuideDocument).filter(models.StyleGuideDocument.isActive == True).first()
    if active_guide:
        print(f"Active Style Guide found: {active_guide.version}")
    else:
        print("No active style guide found.")
        
    db.close()
except Exception as e:
    print(f"Database connection FAILURE: {e}")
