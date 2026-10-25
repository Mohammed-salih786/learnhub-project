import getpass
import os
from app import db, uid, now
from werkzeug.security import generate_password_hash

email = os.getenv("ADMIN_EMAIL", "").strip().lower()
if not email:
    raise SystemExit("Set ADMIN_EMAIL before creating the LearnHub administrator.")
password = getpass.getpass("Admin password (12+ characters): ")
if len(password) < 12:
    raise SystemExit("Use a password with at least 12 characters.")
db().profiles.update_one({"email": email}, {"$set": {"role": "admin", "password_hash": generate_password_hash(password)}, "$setOnInsert": {"id": uid(), "email": email, "full_name": "LearnHub Admin", "created_at": now()}}, upsert=True)
print(f"Administrator account is ready for {email}.")
