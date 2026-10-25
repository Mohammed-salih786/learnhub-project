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
    print("Seeded LearnHub plans and categories.")

if __name__ == "__main__": seed()
