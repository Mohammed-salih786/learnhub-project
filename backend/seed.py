from app import db, uid, now


def seed():
    database = db()
    plans = [
        {"key": "trial", "label": "Free trial", "amount_cents": 0, "currency": "INR", "is_active": True, "trial_days": 7, "description": "7-day trial with two free course enrollments"},
        {"key": "monthly", "label": "Monthly", "amount_cents": 14900, "currency": "INR", "is_active": True, "trial_days": 0, "description": "Full library access for one month"},
        {"key": "yearly", "label": "Yearly", "amount_cents": 99900, "currency": "INR", "is_active": True, "trial_days": 0, "description": "Full library access with certificates and priority support"},
    ]
    for plan in plans:
        database.plans.update_one({"key": plan["key"]}, {"$setOnInsert": {**plan, "id": uid(), "created_at": now()}}, upsert=True)
    for name in ("Development", "Design", "Business"):
        slug = name.lower()
        database.categories.update_one({"slug": slug}, {"$setOnInsert": {"id": uid(), "name": name, "slug": slug, "created_at": now()}}, upsert=True)
    applicant = database.profiles.find_one({"email": "pending-instructor@example.test"})
    if not applicant:
        applicant = {"id": uid(), "email": "pending-instructor@example.test", "full_name": "Pending Instructor", "role": "student", "status": "active", "created_at": now()}
        database.profiles.insert_one(applicant)
    database.instructor_applications.update_one(
        {"user_id": applicant["id"], "status": "pending"},
        {"$setOnInsert": {"id": uid(), "user_id": applicant["id"], "bio": "Seeded application for admin review.", "headline": "Pending instructor applicant", "status": "pending", "created_at": now()}},
        upsert=True,
    )
    category = database.categories.find_one({"slug": "design"})
    database.courses.update_one(
        {"slug": "seed-pending-review-course"},
        {"$setOnInsert": {"id": uid(), "instructor_id": applicant["id"], "category_id": category.get("id") if category else None,
            "title": "Seeded course awaiting review", "slug": "seed-pending-review-course", "short_description": "Admin review workflow sample.",
            "description": "A seeded course record for exercising the pending course review queue.", "price_cents": 0,
            "status": "pending_review", "submitted_at": now(), "created_at": now()}},
        upsert=True,
    )
    print("Seeded LearnHub plans, categories, and pending review examples.")

if __name__ == "__main__": seed()
