import sys
import os

# Add current directory to path so we can import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
import models
from auth import get_password_hash

def seed_admin():
    db = SessionLocal()
    try:
        # Check if admin already exists
        admin = db.query(models.User).filter(models.User.email == "admin@example.com").first()
        if admin:
            print("Admin user already exists.")
            return

        # Create admin user
        admin_user = models.User(
            email="admin@example.com",
            passwordHash=get_password_hash("admin"),
            role=models.RoleEnum.ADMIN
        )
        db.add(admin_user)
        db.commit()
        print("Admin user created successfully.")
    except Exception as e:
        print(f"Error seeding admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
