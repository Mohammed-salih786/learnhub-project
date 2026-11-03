from __future__ import annotations

import os
import uuid
import hmac
import hashlib
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from functools import wraps
from pathlib import Path
from urllib.parse import urlsplit

import jwt
from bson import ObjectId
from dotenv import load_dotenv
try:
    import boto3
except ImportError:
    boto3 = None
from flask import Flask, jsonify, request, g, redirect, send_from_directory
from flask_cors import CORS
from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
import razorpay
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import secure_filename

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
app = Flask(__name__)
CORS(app, origins=[x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if x.strip()], supports_credentials=True)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
try:
    _upload_default_mb = 4 if os.getenv("VERCEL") else 100
    app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("UPLOAD_MAX_MB", str(_upload_default_mb))) * 1024 * 1024
except (TypeError, ValueError):
    app.config["MAX_CONTENT_LENGTH"] = (4 if os.getenv("VERCEL") else 100) * 1024 * 1024

_client: MongoClient | None = None
_indexes_ready = False

def db():
    global _client, _indexes_ready
    uri = os.getenv("MONGODB_URI", "").strip()
    name = os.getenv("MONGODB_DATABASE", "learnhub").strip()
    if not uri:
        raise RuntimeError("MONGODB_URI is required. Set your MongoDB Atlas connection string in .env.")
    if "<db_username>" in uri or "<db_password>" in uri:
        raise RuntimeError("MONGODB_URI still has placeholders. Replace the db_username and db_password values with your MongoDB Atlas database user's credentials in the workspace root .env file.")
    if _client is None:
        _client = MongoClient(uri, serverSelectionTimeoutMS=10000, appname="LearnHub-Flask")
    database = _client[name]
    if not _indexes_ready:
        for collection, keys, options in (
            ("profiles", [("id", ASCENDING)], {"unique": True}),
            ("profiles", [("email", ASCENDING)], {"unique": True, "sparse": True}),
            ("courses", [("id", ASCENDING)], {"unique": True}),
            ("courses", [("slug", ASCENDING)], {"unique": True, "sparse": True}),
            ("categories", [("slug", ASCENDING)], {"unique": True}),
            ("lesson_progress", [("user_id", ASCENDING), ("lesson_id", ASCENDING)], {"unique": True}),
            ("enrollments", [("user_id", ASCENDING), ("course_id", ASCENDING)], {"unique": True}),
            ("payment_events", [("event_id", ASCENDING)], {"unique": True, "sparse": True}),
            ("webhook_events", [("event_id", ASCENDING)], {"unique": True}),
            ("payments", [("razorpay_order_id", ASCENDING)], {"unique": True, "sparse": True}),
            ("payments", [("razorpay_payment_id", ASCENDING)], {"unique": True, "sparse": True}),
            ("payments", [("created_at", -1)], {}),
            ("subscriptions", [("payment_id", ASCENDING)], {"unique": True, "sparse": True}),
            ("revenue_shares", [("payment_id", ASCENDING), ("instructor_id", ASCENDING)], {"unique": True}),
            ("audit_logs", [("created_at", -1)], {}),
            ("rate_limits", [("expires_at", ASCENDING)], {"expireAfterSeconds": 0}),
            ("instructor_applications", [("user_id", ASCENDING), ("status", ASCENDING)], {"unique": True, "partialFilterExpression": {"status": "pending"}}),
            ("certificates", [("user_id", ASCENDING), ("course_id", ASCENDING)], {"unique": True}),
        ):
            database[collection].create_index(keys, **options)
        _indexes_ready = True
    return database

def uid() -> str:
    return str(uuid.uuid4())

def now() -> str:
    return datetime.now(timezone.utc).isoformat()

def clean(value):
    if isinstance(value, ObjectId): return str(value)
    if isinstance(value, list): return [clean(v) for v in value]
    if isinstance(value, dict): return {k: clean(v) for k, v in value.items() if k != "_id"}
    return value

def ok(data=None, status=200, **extra):
    return jsonify({"ok": True, **({"data": clean(data)} if data is not None else {}), **extra}), status

def fail(message, status=400, **extra):
    return jsonify({"ok": False, "error": message, **extra}), status


def audit_admin_action(database, action, target_type, target_id, meta=None):
    database.audit_logs.insert_one({
        "id": uid(),
        "actor_id": g.user["id"],
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "meta": meta or {},
        "created_at": now(),
    })


def notify_course_decision(database, course, action, message):
    instructor = database.profiles.find_one({"id": course.get("instructor_id")})
    if not instructor:
        app.logger.error("Could not notify instructor for course %s: profile not found.", course.get("id"))
        return
    title = "Course approved" if action == "approved" else "Course rejected"
    database.notifications.insert_one({
        "id": uid(),
        "user_id": instructor["id"],
        "type": f"course_{action}",
        "title": title,
        "message": message,
        "course_id": course["id"],
        "created_at": now(),
        "read_at": None,
    })

    host = os.getenv("SMTP_HOST", "").strip()
    sender = os.getenv("EMAIL_FROM", "").strip()
    email = instructor.get("email", "").strip()
    if not host and not sender:
        return
    if not host or not sender or not email:
        app.logger.error("Course decision email was not sent: SMTP_HOST, EMAIL_FROM, and instructor email are required.")
        return

    mail = EmailMessage()
    mail["Subject"] = f"LearnHub: {title}"
    mail["From"] = sender
    mail["To"] = email
    mail.set_content(f"{message}\n\nCourse: {course.get('title', 'Untitled course')}")
    try:
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=10) as smtp:
            smtp.starttls()
            username = os.getenv("SMTP_USERNAME", "")
            password = os.getenv("SMTP_PASSWORD", "")
            if username:
                smtp.login(username, password)
            smtp.send_message(mail)
    except (OSError, smtplib.SMTPException, ValueError):
        app.logger.exception("Course decision email could not be sent.")


REQUEST_SCHEMAS = {
    "register": {
        "required": ("fullName", "email", "password"),
        "fields": {
            "fullName": {"type": "string", "min": 2, "max": 120},
            "email": {"type": "email", "max": 254},
            "password": {"type": "string", "min": 8, "max": 1024, "preserve": True},
            "role": {"type": "choice", "values": ("student", "instructor")},
            "bio": {"type": "string", "max": 1000},
            "headline": {"type": "string", "max": 120},
            "sampleLink": {"type": "url", "max": 2048},
        },
    },
    "instructor_request": {
        "required": ("bio", "headline"),
        "fields": {
            "bio": {"type": "string", "min": 10, "max": 1000},
            "headline": {"type": "string", "min": 3, "max": 120},
            "sampleLink": {"type": "url", "max": 2048},
        },
    },
    "role_transition": {
        "required": ("role",),
        "fields": {"role": {"type": "choice", "values": ("student",)}},
    },
    "course_create": {
        "required": ("title",),
        "fields": {
            "title": {"type": "string", "min": 3, "max": 120},
            "slug": {"type": "slug", "min": 3, "max": 80},
            "category": {"type": "string", "min": 2, "max": 60},
            "category_id": {"type": "string", "min": 1, "max": 100},
            "thumbnailUrl": {"type": "url", "max": 2048},
            "shortDescription": {"type": "string", "max": 220},
            "description": {"type": "string", "max": 2000},
            "priceCents": {"type": "integer", "min": 0, "max": 1000000000},
        },
    },
    "course_update": {
        "required": (),
        "fields": {
            "title": {"type": "string", "min": 3, "max": 120},
            "slug": {"type": "slug", "min": 3, "max": 80},
            "description": {"type": "string", "max": 2000},
            "short_description": {"type": "string", "max": 220},
            "thumbnail_url": {"type": "url", "max": 2048},
            "price_cents": {"type": "integer", "min": 0, "max": 1000000000},
            "status": {"type": "choice", "values": ("draft", "pending_review")},
            "category_id": {"type": "string", "min": 1, "max": 100},
        },
    },
    "lesson_create": {
        "required": (),
        "one_of": (("courseId", "course_id"),),
        "alias_pairs": (("moduleId", "module_id"), ("videoUrl", "video_url"), ("durationSeconds", "duration_seconds"), ("sortOrder", "sort_order"), ("preview", "isPreview"), ("isPaid", "is_paid")),
        "fields": {
            "courseId": {"type": "string", "min": 1, "max": 100},
            "course_id": {"type": "string", "min": 1, "max": 100},
            "moduleId": {"type": "string", "min": 1, "max": 100},
            "module_id": {"type": "string", "min": 1, "max": 100},
            "title": {"type": "string", "min": 3, "max": 120},
            "description": {"type": "string", "max": 5000},
            "content": {"type": "string", "max": 50000},
            "videoUrl": {"type": "url", "max": 2048},
            "video_url": {"type": "url", "max": 2048},
            "durationSeconds": {"type": "integer", "min": 0, "max": 86400},
            "duration_seconds": {"type": "integer", "min": 0, "max": 86400},
            "sortOrder": {"type": "integer", "min": 0, "max": 10000},
            "sort_order": {"type": "integer", "min": 0, "max": 10000},
            "preview": {"type": "boolean"},
            "isPreview": {"type": "boolean"},
            "isPaid": {"type": "boolean"},
            "is_paid": {"type": "boolean"},
        },
    },
    "lesson_resource": {
        "required": ("title", "resourceType", "url"),
        "fields": {
            "title": {"type": "string", "min": 1, "max": 120},
            "resourceType": {"type": "choice", "values": ("link", "file")},
            "url": {"type": "resource_url", "max": 2048},
            "description": {"type": "string", "max": 1000},
        },
    },
    "plan_write": {
        "required": ("key",),
        "fields": {
            "key": {"type": "choice", "values": ("trial", "monthly", "yearly")},
            "label": {"type": "string", "min": 2, "max": 80},
            "amount_cents": {"type": "integer", "min": 0, "max": 1000000000},
            "currency": {"type": "choice", "values": ("INR",)},
            "is_active": {"type": "boolean"},
            "trial_days": {"type": "integer", "min": 0, "max": 365},
            "description": {"type": "string", "max": 500},
        },
    },
    "moderation_create": {
        "required": ("targetType", "targetId", "reason"),
        "fields": {
            "targetType": {"type": "choice", "values": ("course", "lesson", "user")},
            "targetId": {"type": "string", "min": 1, "max": 100},
            "reason": {"type": "string", "min": 10, "max": 1000},
            "severity": {"type": "choice", "values": ("low", "medium", "high")},
        },
    },
    "moderation_resolution": {
        "required": (),
        "defaults": {"status": "resolved"},
        "fields": {
            "status": {"type": "choice", "values": ("resolved", "dismissed")},
            "unpublishCourse": {"type": "boolean"},
        },
    },
    "course_rejection": {
        "required": ("reason",),
        "fields": {"reason": {"type": "string", "min": 10, "max": 1000}},
    },
    "instructor_application_rejection": {
        "required": ("reason",),
        "fields": {"reason": {"type": "string", "min": 10, "max": 1000}},
    },
    "instructor_verification": {
        "required": ("verified_badge",),
        "fields": {"verified_badge": {"type": "boolean"}},
    },
    "payment_subscribe": {
        "required": ("planKey",),
        "fields": {"planKey": {"type": "choice", "values": ("monthly", "yearly")}},
    },
    "payment_verify": {
        "required": ("razorpay_order_id", "razorpay_payment_id", "razorpay_signature"),
        "fields": {
            "razorpay_order_id": {"type": "string", "min": 1, "max": 100},
            "razorpay_payment_id": {"type": "string", "min": 1, "max": 100},
            "razorpay_signature": {"type": "string", "min": 64, "max": 64, "pattern": r"[a-fA-F0-9]{64}"},
        },
    },
    "payout_mark_paid": {
        "required": ("reference",),
        "fields": {"reference": {"type": "string", "min": 1, "max": 120}},
    },
    "category_create": {
        "required": ("name", "slug"),
        "fields": {
            "name": {"type": "string", "min": 2, "max": 80},
            "slug": {"type": "slug", "min": 2, "max": 100},
            "description": {"type": "string", "max": 500},
            "sort_order": {"type": "integer", "min": 0, "max": 100000},
            "is_active": {"type": "boolean"},
        },
    },
    "category_update": {
        "required": (),
        "fields": {
            "name": {"type": "string", "min": 2, "max": 80},
            "slug": {"type": "slug", "min": 2, "max": 100},
            "description": {"type": "string", "max": 500},
            "sort_order": {"type": "integer", "min": 0, "max": 100000},
            "is_active": {"type": "boolean"},
        },
    },
    "user_status": {
        "required": (),
        "fields": {"reason": {"type": "string", "max": 500}},
    },
    "profile_update": {
        "required": (),
        "fields": {
            "full_name": {"type": "string", "min": 2, "max": 120},
            "fullName": {"type": "string", "min": 2, "max": 120},
            "phone": {"type": "string", "max": 25},
            "avatar_url": {"type": "url", "max": 2048},
            "bio": {"type": "string", "max": 1000},
            "headline": {"type": "string", "max": 120},
        },
    },
}


def validate_payload(payload, schema_name):
    schema = REQUEST_SCHEMAS[schema_name]
    if not isinstance(payload, dict):
        return None, "Request body must be a JSON object."
    allowed = schema["fields"]
    unknown = sorted(set(payload) - set(allowed))
    if unknown:
        return None, f"Unknown field(s): {', '.join(unknown)}."
    for field in schema.get("required", ()):
        if field not in payload:
            return None, f"{field} is required."
    for alternatives in schema.get("one_of", ()):
        if not any(field in payload for field in alternatives):
            return None, f"{alternatives[0]} is required."
        if all(field in payload for field in alternatives) and payload[alternatives[0]] != payload[alternatives[1]]:
            return None, f"Provide only one matching {alternatives[0]} value."
    for left, right in schema.get("alias_pairs", ()):
        if left in payload and right in payload and payload[left] != payload[right]:
            return None, f"Provide only one matching {left} value."
    values = {**schema.get("defaults", {}), **payload}
    for field, value in values.items():
        field_schema = allowed[field]
        field_type = field_schema["type"]
        if field_type in ("string", "email", "url", "slug", "resource_url"):
            if not isinstance(value, str):
                return None, f"{field} must be a string."
            normalized = value if field_schema.get("preserve") else value.strip()
            if len(normalized) < field_schema.get("min", 0) or len(normalized) > field_schema.get("max", 1000000):
                return None, f"{field} has an invalid length."
            if field_type == "email" and ("@" not in normalized or " " in normalized):
                return None, "Enter a valid email address."
            if field_type == "slug" and not __import__("re").fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", normalized):
                return None, "slug must contain lowercase letters, numbers, and single hyphens."
            if field_schema.get("pattern") and not __import__("re").fullmatch(field_schema["pattern"], normalized):
                return None, f"{field} has an invalid format."
            if field_type in ("url", "resource_url"):
                parsed = urlsplit(normalized)
                valid_web_url = parsed.scheme in ("http", "https") and bool(parsed.netloc)
                valid_upload_path = field_type == "resource_url" and normalized.startswith("/uploads/") and not normalized.startswith("//")
                if not valid_web_url and not valid_upload_path:
                    return None, f"{field} must be an http(s) URL or a local upload path."
            values[field] = normalized
        elif field_type == "integer":
            if type(value) is not int or value < field_schema["min"] or value > field_schema["max"]:
                return None, f"{field} must be an integer in the allowed range."
        elif field_type == "boolean":
            if type(value) is not bool:
                return None, f"{field} must be a boolean."
        elif field_type == "choice" and value not in field_schema["values"]:
            return None, f"{field} has an unsupported value."
    return values, None


def instructor_is_approved(database, user_id):
    instructor = database.instructor_profiles.find_one({"user_id": user_id})
    return bool(instructor and instructor.get("status") == "approved")


def delete_course_content(database, course_id):
    modules = list(database.modules.find({"course_id": course_id}, {"id": 1}))
    module_ids = [module["id"] for module in modules if module.get("id")]
    lesson_query = {"course_id": course_id}
    if module_ids:
        lesson_query = {"$or": [{"course_id": course_id}, {"module_id": {"$in": module_ids}}]}
    lessons = list(database.lessons.find(lesson_query, {"id": 1}))
    lesson_ids = [lesson["id"] for lesson in lessons if lesson.get("id")]
    tests = list(database.tests.find({"course_id": course_id}, {"id": 1}))
    test_ids = [test["id"] for test in tests if test.get("id")]
    database.lesson_resources.delete_many({"lesson_id": {"$in": lesson_ids}})
    database.lesson_progress.delete_many({"lesson_id": {"$in": lesson_ids}})
    database.test_attempts.delete_many({"test_id": {"$in": test_ids}})
    database.questions.delete_many({"test_id": {"$in": test_ids}})
    database.tests.delete_many({"course_id": course_id})
    database.certificates.delete_many({"course_id": course_id})
    database.reviews.delete_many({"course_id": course_id})
    database.enrollments.delete_many({"course_id": course_id})
    database.lessons.delete_many(lesson_query)
    database.modules.delete_many({"course_id": course_id})
    database.courses.delete_one({"id": course_id})


def archive_course_content(database, course_id):
    modules = list(database.modules.find({"course_id": course_id}, {"id": 1}))
    module_ids = [module["id"] for module in modules if module.get("id")]
    lesson_query = {"course_id": course_id}
    if module_ids:
        lesson_query = {"$or": [{"course_id": course_id}, {"module_id": {"$in": module_ids}}]}
    lessons = list(database.lessons.find(lesson_query, {"id": 1}))
    lesson_ids = [lesson["id"] for lesson in lessons if lesson.get("id")]
    tests = list(database.tests.find({"course_id": course_id}, {"id": 1}))
    test_ids = [test["id"] for test in tests if test.get("id")]
    archived_at = now()

    related_records = (
        (database.modules, {"course_id": course_id}),
        (database.lessons, lesson_query),
        (database.lesson_resources, {"lesson_id": {"$in": lesson_ids}}),
        (database.lesson_progress, {"lesson_id": {"$in": lesson_ids}}),
        (database.tests, {"course_id": course_id}),
        (database.questions, {"test_id": {"$in": test_ids}}),
        (database.test_attempts, {"test_id": {"$in": test_ids}}),
        (database.enrollments, {"course_id": course_id}),
        (database.certificates, {"course_id": course_id}),
        (database.reviews, {"course_id": course_id}),
    )
    for collection, query in related_records:
        collection.update_many(query, {"$set": {"archived": True, "deleted_at": archived_at}})


def archive_or_delete_course(database, course_id):
    if database.enrollments.count_documents({"course_id": course_id}):
        archived_at = now()
        database.courses.update_one({"id": course_id}, {"$set": {"status": "archived", "deleted_at": archived_at, "updated_at": archived_at}})
        archive_course_content(database, course_id)
        return True
    delete_course_content(database, course_id)
    return False

def rate_limit_bucket(scope, identity):
    return hashlib.sha256(f"{scope}:{identity}".encode("utf-8", "ignore")).hexdigest()

def rate_limit_response(database, scope, identity, limit=5, window_seconds=900):
    bucket = rate_limit_bucket(scope, identity)
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
    query = {"bucket": bucket, "created_at": {"$gt": cutoff}}
    count = database.rate_limits.count_documents(query)
    if count < limit: return None
    first = database.rate_limits.find(query).sort("created_at", ASCENDING).limit(1)
    oldest = next(iter(first), None)
    retry_time = oldest.get("created_at") if oldest else None
    if retry_time and retry_time.tzinfo is None: retry_time = retry_time.replace(tzinfo=timezone.utc)
    retry_after = max(1, int((retry_time + timedelta(seconds=window_seconds) - datetime.now(timezone.utc)).total_seconds())) if retry_time else window_seconds
    return fail("Too many attempts. Please try again later.", 429, retry_after=retry_after)

def record_rate_limit(database, scope, identity, window_seconds=900):
    created = datetime.now(timezone.utc)
    database.rate_limits.insert_one({"id": uid(), "bucket": rate_limit_bucket(scope, identity), "created_at": created, "expires_at": created + timedelta(seconds=window_seconds)})

def enforce_rate_limit(database, scope, identity, limit=5):
    blocked = rate_limit_response(database, scope, identity, limit=limit)
    if blocked: return blocked
    record_rate_limit(database, scope, identity)
    return None

def login_rate_identity(email):
    normalized_email = str(email or "").strip().lower()[:254]
    return f"{normalized_email}|{request.remote_addr or 'unknown'}"
def token_for(user):
    secret = os.getenv("JWT_SECRET", "")
    if len(secret) < 32: raise RuntimeError("Set JWT_SECRET to a random secret with at least 32 characters.")
    return jwt.encode({"sub": user["id"], "role": user["role"], "exp": datetime.now(timezone.utc) + timedelta(days=7)}, secret, algorithm="HS256")

def current_user(required=None):
    token = request.cookies.get("learnhub_session") or request.headers.get("Authorization", "").removeprefix("Bearer ")
    if not token: return None
    try:
        claims = jwt.decode(token, os.getenv("JWT_SECRET", ""), algorithms=["HS256"])
        user = db().profiles.find_one({"id": claims.get("sub")})
        if not user or user.get("status") in ("suspended", "deleted") or user.get("role") != claims.get("role"): return None
        if required and user.get("role") != required: return None
        if user.get("role") == "admin" and user.get("email", "").lower() != os.getenv("ADMIN_EMAIL", "").strip().lower(): return None
        return user
    except Exception:
        return None

def auth(required=None):
    def decorate(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            user = current_user(required)
            if not user: return fail("Authentication required.", 401)
            g.user = user
            return fn(*args, **kwargs)
        return wrapped
    return decorate

def profile_public(user):
    return {k: user.get(k) for k in ("id", "email", "phone", "full_name", "role", "avatar_url")}

def by_id(collection, value):
    return collection.find_one({"id": value})

def strip_answer_keys(value):
    if isinstance(value, list):
        return [strip_answer_keys(item) for item in value]
    if isinstance(value, dict):
        return {key: strip_answer_keys(item) for key, item in value.items() if key != "answer_key"}
    return value

def lesson_access_allowed(lesson, access):
    if lesson.get("preview", lesson.get("is_preview", False)):
        return True
    if not lesson.get("is_paid", False):
        return True
    if access.get("hasActiveSubscription"):
        return True
    return bool(access.get("hasActiveTrial") and access.get("freeCoursesConsumed", 0) < access.get("freeCourseLimit", 2))

def with_course_refs(course, viewer_id=None):
    result = clean(course)
    instructor = db().profiles.find_one({"id": course.get("instructor_id")})
    category = db().categories.find_one({"id": course.get("category_id")})
    result["instructor"] = profile_public(instructor) if instructor else None
    if instructor:
        result["instructor"]["avatar_url"] = instructor.get("avatar_url")
    result["category"] = clean(category) if category else None
    access = entitlement(viewer_id) if viewer_id else {}
    modules = list(db().modules.find({"course_id": course.get("id")}).sort("sort_order", ASCENDING))
    for module in modules:
        module["lessons"] = []
        for lesson in db().lessons.find({"module_id": module.get("id")}).sort("sort_order", ASCENDING):
            safe_lesson = clean(lesson)
            if not lesson_access_allowed(lesson, access):
                safe_lesson.pop("video_url", None)
                safe_lesson.pop("videoUrl", None)
                safe_lesson.pop("content", None)
                safe_lesson["locked"] = True
            module["lessons"].append(safe_lesson)
    result["modules"] = [clean(x) for x in modules]
    result["tests"] = [strip_answer_keys(clean(x)) for x in db().tests.find({"course_id": course.get("id")})]
    result["reviews"] = [clean(x) for x in db().reviews.find({"course_id": course.get("id")})]
    result["total_enrollments"] = [{"count": db().enrollments.count_documents({"course_id": course.get("id")})}]
    ratings = [x.get("rating", 0) for x in db().reviews.find({"course_id": course.get("id")}) if x.get("rating") is not None]
    result["avg_rating"] = [{"avg": sum(ratings) / len(ratings) if ratings else None}]
    result["review_count"] = [{"count": len(ratings)}]
    return result
def entitlement(user_id):
    database = db()
    profile = database.profiles.find_one({"id": user_id})
    current_time = now()
    active_sub_record = database.subscriptions.find_one({"user_id": user_id, "status": "active", "$or": [{"ends_at": {"$gt": current_time}}, {"ends_at": {"$exists": False}}]}, sort=[("created_at", -1)])
    active_sub = active_sub_record if active_sub_record and (not active_sub_record.get("ends_at") or active_sub_record["ends_at"] > current_time) else None
    trial_sub = database.subscriptions.find_one({"user_id": user_id, "status": "trial", "ends_at": {"$gt": current_time}}, sort=[("created_at", -1)])
    trial_end = profile.get("trial_ends_at") if profile else None
    active_trial = bool(trial_sub and trial_end and trial_end > current_time and trial_sub.get("ends_at", "") > current_time)
    sub = active_sub or (trial_sub if active_trial else None)
    plan = database.plans.find_one({"id": sub.get("plan_id")}) if sub else None
    return {"role": profile.get("role") if profile else "student", "hasActiveSubscription": bool(active_sub), "hasActiveTrial": active_trial,
            "freeCoursesConsumed": int(profile.get("free_course_count", 0) or 0) if profile else 0,
            "freeCourseLimit": int(os.getenv("TRIAL_FREE_COURSE_LIMIT", "2")), "planKey": plan.get("key") if plan else None}

def course_access_allowed(access):
    if access.get("hasActiveSubscription"):
        return True
    return bool(access.get("hasActiveTrial") and access.get("freeCoursesConsumed", 0) < access.get("freeCourseLimit", 2))

def razorpay_client():
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip()
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
    if not key_id or not key_secret:
        return None
    return razorpay.Client(auth=(key_id, key_secret))


def allocate_payment_revenue(database, payment):
    progress_rows = list(database.lesson_progress.find({}))
    watch_minutes = {}
    for progress in progress_rows:
        lesson = database.lessons.find_one({"id": progress.get("lesson_id")})
        if not lesson:
            continue
        course = database.courses.find_one({"id": lesson.get("course_id")})
        if not course or not course.get("instructor_id"):
            continue
        duration = max(0, int(lesson.get("duration_seconds", 0) or 0))
        percent = max(0, min(100, float(progress.get("percent_complete", 0) or 0)))
        minutes = duration * percent / 100 / 60
        instructor_id = course["instructor_id"]
        watch_minutes[instructor_id] = watch_minutes.get(instructor_id, 0) + minutes

    amount_cents = int(payment.get("amount_cents", 0))
    total_minutes = sum(watch_minutes.values())
    allocated = 0
    instructor_pool = int(amount_cents * 0.7)
    if total_minutes > 0:
        for instructor_id, minutes in watch_minutes.items():
            amount = int(instructor_pool * minutes / total_minutes)
            if amount <= 0:
                continue
            allocated += amount
            database.revenue_shares.update_one(
                {"payment_id": payment["id"], "instructor_id": instructor_id},
                {"$setOnInsert": {
                    "id": uid(),
                    "payment_id": payment["id"],
                    "instructor_id": instructor_id,
                    "amount_cents": amount,
                    "status": "pending",
                    "created_at": now(),
                }},
                upsert=True,
            )
    database.revenue_shares.update_one(
        {"payment_id": payment["id"], "instructor_id": "platform"},
        {"$setOnInsert": {
            "id": uid(),
            "payment_id": payment["id"],
            "instructor_id": "platform",
            "share_type": "platform",
            "amount_cents": amount_cents - allocated,
            "status": "retained",
            "created_at": now(),
        }},
        upsert=True,
    )


def ensure_payment_entitlement(database, payment):
    if payment.get("type") != "subscription":
        return
    if database.subscriptions.find_one({"payment_id": payment["id"]}):
        return
    plan = database.plans.find_one({"id": payment.get("plan_id")})
    if not plan:
        raise RuntimeError("The payment references a missing plan.")
    current = database.subscriptions.find_one(
        {"user_id": payment["user_id"], "status": "active", "ends_at": {"$gt": now()}},
        sort=[("ends_at", -1)],
    )
    starts_at = current.get("ends_at") if current else now()
    try:
        starts = datetime.fromisoformat(starts_at)
    except (TypeError, ValueError):
        starts = datetime.now(timezone.utc)
    duration_days = 365 if plan.get("key") == "yearly" else 30
    subscription = {
        "id": uid(),
        "user_id": payment["user_id"],
        "plan_id": plan["id"],
        "payment_id": payment["id"],
        "status": "active",
        "starts_at": starts.isoformat(),
        "ends_at": (starts + timedelta(days=duration_days)).isoformat(),
        "cancel_at_period_end": False,
        "created_at": now(),
    }
    try:
        database.subscriptions.insert_one(subscription)
    except DuplicateKeyError:
        pass


def capture_payment(database, order_id, payment_id):
    payment = database.payments.find_one({"razorpay_order_id": order_id})
    if not payment:
        return False
    if payment.get("status") in ("created", "failed"):
        database.payments.update_one(
            {"id": payment["id"], "status": {"$in": ["created", "failed"]}},
            {"$set": {
                "status": "captured",
                "razorpay_payment_id": payment_id,
                "captured_at": now(),
                "updated_at": now(),
            }},
        )
        payment = database.payments.find_one({"id": payment["id"]}) or {
            **payment,
            "status": "captured",
            "razorpay_payment_id": payment_id,
        }
    if payment.get("status") != "captured":
        return False
    if payment.get("razorpay_payment_id") not in (None, payment_id):
        return False
    ensure_payment_entitlement(database, payment)
    allocate_payment_revenue(database, payment)
    return True

@app.get("/")
def home():
    web_url = os.getenv("WEB_APP_URL", "").strip()
    if web_url:
        return redirect(web_url, code=302)
    return jsonify({"ok": True, "service": "LearnHub Flask API", "health": "/api/learnhub/health"})

@app.get("/api/learnhub/health")
def learnhub_health():
    try:
        db().command("ping")
        return jsonify({"ok": True, "service": "LearnHub Flask API", "database": "connected"})
    except Exception as exc:
        return fail(str(exc), 503)

@app.route("/api/learnhub/auth/password/register", methods=["POST"])
def register():
    database = db()
    blocked = enforce_rate_limit(database, "register", request.remote_addr or "unknown")
    if blocked: return blocked
    body, error = validate_payload(request.get_json(silent=True), "register")
    if error: return fail(error)
    full_name, email, password = str(body.get("fullName") or "").strip(), str(body.get("email") or "").strip().lower(), str(body.get("password") or "")
    requested_role = body.get("role", "student")
    role = "student"
    database = db()
    if database.profiles.find_one({"email": email}): return fail("An account with that email already exists.", 409)
    user = {"id": uid(), "email": email, "full_name": full_name, "role": role, "password_hash": generate_password_hash(password), "free_course_count": 0, "trial_starts_at": now(), "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(), "created_at": now()}
    database.profiles.insert_one(user)
    trial = database.plans.find_one({"key": "trial"})
    if trial: database.subscriptions.insert_one({"id": uid(), "user_id": user["id"], "plan_id": trial["id"], "status": "trial", "starts_at": now(), "ends_at": user["trial_ends_at"], "created_at": now()})
    if requested_role == "instructor":
        bio = body.get("bio", "")
        headline = body.get("headline", "")
        sample_link = body.get("sampleLink", "")
        database.instructor_profiles.insert_one({"id": uid(), "user_id": user["id"], "bio": bio, "headline": headline, "verified_badge": False, "status": "pending"})
        database.instructor_applications.insert_one({"id": uid(), "user_id": user["id"], "status": "pending", "bio": bio, "headline": headline, "sample_link": sample_link, "created_at": now()})
    response = jsonify({"ok": True, "user": profile_public(user)})
    response.set_cookie("learnhub_session", token_for(user), httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    response.set_cookie("learnhub_role", role, httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    return response, 201

@app.route("/api/learnhub/auth/password/login", methods=["POST"])
def login():
    body = request.get_json(silent=True) or {}
    email = str(body.get("email") or "").strip().lower()[:254]
    password = str(body.get("password") or "")
    database = db()
    identity = login_rate_identity(email)
    blocked = rate_limit_response(database, "login", identity)
    if blocked: return blocked
    user = database.profiles.find_one({"email": email})
    if not user or not user.get("password_hash") or not check_password_hash(user["password_hash"], password):
        record_rate_limit(database, "login", identity)
        return fail("Email or password is incorrect.", 401)
    if user.get("status") in ("suspended", "deleted"):
        return fail("This account is suspended or deactivated. Contact LearnHub support.", 403)
    if body.get("expectedRole") == "admin" and user.get("role") != "admin":
        return fail("These credentials do not belong to an administrator.", 403)
    database.rate_limits.delete_many({"bucket": rate_limit_bucket("login", identity)})
    response = jsonify({"ok": True, "user": profile_public(user)})
    response.set_cookie("learnhub_session", token_for(user), httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    response.set_cookie("learnhub_role", user["role"], httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    return response
@app.post("/api/learnhub/auth/admin/register")
def admin_register():
    database = db()
    blocked = enforce_rate_limit(database, "admin_register", request.remote_addr or "unknown")
    if blocked: return blocked
    body = request.get_json(silent=True) or {}
    name = str(body.get("fullName") or "").strip()
    email = str(body.get("email") or "").strip().lower()
    password = str(body.get("password") or "")
    setup_key = str(body.get("setupKey") or "")
    expected_key = os.getenv("ADMIN_REGISTRATION_KEY", "")
    admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    if not expected_key:
        return fail("Admin web registration is disabled. Set ADMIN_REGISTRATION_KEY in the workspace root .env first.", 503)
    if not hmac.compare_digest(setup_key, expected_key):
        return fail("The admin setup key is incorrect.", 403)
    if not admin_email or email != admin_email:
        return fail("Use the email configured by ADMIN_EMAIL.", 403)
    if len(name) < 2 or len(password) < 12:
        return fail("Enter your name and use an admin password with at least 12 characters.")
    database = db()
    try:
        database.admin_setup.insert_one({"_id": "first_admin_registered", "created_at": now()})
    except DuplicateKeyError:
        return fail("Admin setup is already complete. Please use admin login.", 409)
    try:
        database.profiles.update_one(
            {"email": email},
            {"$set": {"full_name": name, "role": "admin", "password_hash": generate_password_hash(password)},
             "$setOnInsert": {"id": uid(), "email": email, "created_at": now()}},
            upsert=True,
        )
        user = database.profiles.find_one({"email": email})
    except Exception:
        database.admin_setup.delete_one({"_id": "first_admin_registered"})
        raise
    response = jsonify({"ok": True, "user": profile_public(user)})
    response.set_cookie("learnhub_session", token_for(user), httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    response.set_cookie("learnhub_role", "admin", httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    return response, 201

@app.post("/api/learnhub/auth/logout")
def logout():
    response = jsonify({"ok": True}); response.delete_cookie("learnhub_session", path="/"); response.delete_cookie("learnhub_role", path="/"); return response

@app.get("/api/learnhub/auth/verify-role")
def verify_role():
    return ok(profile_public(current_user())) if current_user() else fail("Authentication required.", 401)

@app.post("/api/learnhub/auth/role")
@auth()
def change_role():
    payload = request.get_json(silent=True)
    if isinstance(payload, dict) and payload.get("role") == "instructor":
        return fail("Instructor access requires admin approval.", 403)
    body, error = validate_payload(payload, "role_transition")
    if error: return fail(error)
    role = body["role"]
    if g.user.get("role") == "admin": return fail("Admin role cannot be changed here.", 403)
    db().profiles.update_one({"id": g.user["id"]}, {"$set": {"role": role}})
    updated = db().profiles.find_one({"id": g.user["id"]}); response = jsonify({"ok": True, "user": profile_public(updated)})
    response.set_cookie("learnhub_session", token_for(updated), httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    response.set_cookie("learnhub_role", role, httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    return response

@app.post("/api/learnhub/auth/instructor-request")
@auth("student")
def instructor_request():
    body, error = validate_payload(request.get_json(silent=True), "instructor_request")
    if error: return fail(error)
    database = db()
    identity = str(g.user["id"]) + "|" + (request.remote_addr or "unknown")
    blocked = enforce_rate_limit(database, "instructor_request", identity)
    if blocked: return blocked
    existing = database.instructor_applications.find_one({"user_id": g.user["id"], "status": "pending"})
    if existing: return fail("An instructor application is already pending.", 409)
    application = {
        "id": uid(),
        "user_id": g.user["id"],
        "status": "pending",
        "bio": body["bio"],
        "headline": body["headline"],
        "sample_link": body.get("sampleLink", ""),
        "created_at": now(),
    }
    database.instructor_applications.insert_one(application)
    return jsonify({"ok": True, "application": clean(application)}), 201

@app.get("/api/learnhub/profile")
@auth()
def get_profile():
    user = g.user; data = profile_public(user)
    if user.get("role") == "instructor": data["instructorProfile"] = clean(db().instructor_profiles.find_one({"user_id": user["id"]}))
    return jsonify({"ok": True, "profile": data})

@app.route("/api/learnhub/profile", methods=["PUT", "PATCH"])
@auth()
def put_profile():
    body, error = validate_payload(request.get_json(silent=True), "profile_update")
    if error: return fail(error)
    fields = {target: body[source] for source, target in (("full_name", "full_name"), ("fullName", "full_name"), ("phone", "phone"), ("avatar_url", "avatar_url")) if source in body}
    db().profiles.update_one({"id": g.user["id"]}, {"$set": fields})
    if g.user.get("role") == "instructor": db().instructor_profiles.update_one({"user_id": g.user["id"]}, {"$set": {"bio": body.get("bio"), "headline": body.get("headline")}}, upsert=True)
    return jsonify({"ok": True, "profile": profile_public(db().profiles.find_one({"id": g.user["id"]}))})

@app.get("/api/learnhub/categories")
def categories(): return jsonify({"ok": True, "categories": [clean(x) for x in db().categories.find({"is_active": {"$ne": False}}).sort("sort_order", ASCENDING)]})

@app.get("/api/learnhub/courses")
def courses():
    query = {"status": "published"}; search = request.args.get("search") or request.args.get("q", ""); category = request.args.get("category")
    if search: query["$or"] = [{"title": {"$regex": __import__("re").escape(search), "$options": "i"}}, {"short_description": {"$regex": __import__("re").escape(search), "$options": "i"}}]
    result = []
    for item in db().courses.find(query).sort("published_at", -1).limit(min(int(request.args.get("limit", 24)), 100)):
        data = with_course_refs(item)
        if category and (not data.get("category") or data["category"].get("slug") != category): continue
        result.append(data)
    return jsonify({"ok": True, "courses": result, "data": result, "total": len(result)})

@app.get("/api/learnhub/student/courses/<slug>")
def course_by_slug(slug):
    item = db().courses.find_one({"slug": slug, "status": "published"})
    if not item: return fail("Course not found.", 404)
    user = current_user(); result = with_course_refs(item, user["id"] if user and user.get("role") == "student" else None)
    if user:
        result["enrollment"] = clean(db().enrollments.find_one({"user_id": user["id"], "course_id": item["id"]}))
        result["entitlement"] = entitlement(user["id"])
    return jsonify({"ok": True, "course": result, "data": result})

@app.get("/api/learnhub/student/courses")
@auth("student")
def student_courses():
    user_id = g.user["id"]; enrollments = []
    for row in db().enrollments.find({"user_id": user_id}):
        course = db().courses.find_one({"id": row.get("course_id"), "status": "published"})
        if not course:
            continue
        progress = list(db().lesson_progress.find({"user_id": user_id}))
        row = clean(row); row["course"] = with_course_refs(course, user_id) if course else None; row["progress"] = [clean(p) for p in progress]; enrollments.append(row)
    catalog = [with_course_refs(x, user_id) for x in db().courses.find({"status": "published"}).sort("published_at", -1).limit(24)]
    return jsonify({"ok": True, "enrollments": enrollments, "catalog": catalog, "total": len(catalog)})

@app.get("/api/learnhub/student/lessons/<lesson_id>")
@auth("student")
def student_lesson(lesson_id):
    lesson = by_id(db().lessons, lesson_id)
    if not lesson: return fail("Lesson not found.", 404)
    course = db().courses.find_one({"id": lesson.get("course_id"), "status": "published"})
    if not course: return fail("Lesson not found.", 404)
    lesson = clean(lesson); lesson["course"] = clean(course)
    progress = db().lesson_progress.find_one({"user_id": g.user["id"], "lesson_id": lesson_id})
    lesson["progress"] = clean(progress)
    if not lesson_access_allowed(lesson, entitlement(g.user["id"])):
        return fail("An active subscription is required to watch this lesson.", 403)
    return jsonify({"ok": True, "lesson": lesson, "data": lesson})

@app.post("/api/learnhub/student/progress")
@auth("student")
def save_progress():
    body = request.get_json(silent=True) or {}; lesson_id = body.get("lessonId") or body.get("lesson_id")
    if not lesson_id: return fail("lessonId is required.")
    values = {"user_id": g.user["id"], "lesson_id": lesson_id, "percent_complete": max(0, min(100, float(body.get("percentComplete", body.get("percent_complete", 0))))), "last_position_seconds": max(0, int(body.get("lastPositionSeconds", 0))), "completed": bool(body.get("completed", False)), "updated_at": now()}
    db().lesson_progress.update_one({"user_id": values["user_id"], "lesson_id": lesson_id}, {"$set": values, "$setOnInsert": {"id": uid()}}, upsert=True)
    return jsonify({"ok": True, "progress": values})

@app.route("/api/learnhub/student/certificate/<course_id>", methods=["GET", "POST"])
@auth("student")
def certificate(course_id):
    database = db(); course = by_id(database.courses, course_id)
    if not course or course.get("status") != "published": return fail("Course not found.", 404)
    existing = database.certificates.find_one({"course_id": course_id, "user_id": g.user["id"]})
    if existing: return jsonify({"ok": True, "certificate": clean(existing)})
    if request.method == "GET": return fail("Certificate not found.", 404)
    lesson_ids = [x["id"] for x in database.lessons.find({"course_id": course_id})]
    progress = list(database.lesson_progress.find({"user_id": g.user["id"], "lesson_id": {"$in": lesson_ids}}))
    if not course_access_allowed(entitlement(g.user["id"])):
        return fail("An active subscription or available trial course is required for certification.", 403)
    if not lesson_ids or len({row.get("lesson_id") for row in progress if row.get("completed")}) < len(set(lesson_ids)):
        return fail("Complete every course lesson before requesting a certificate.", 403)
    for test in database.tests.find({"course_id": course_id}):
        if not database.test_attempts.find_one({"user_id": g.user["id"], "test_id": test.get("id"), "passed": True}):
            return fail("Pass every course test before requesting a certificate.", 403)
    record = {"id": uid(), "course_id": course_id, "user_id": g.user["id"], "certificate_url": "", "generated_at": now()}
    database.certificates.insert_one(record); return jsonify({"ok": True, "certificate": clean(record)}), 201

@app.get("/api/learnhub/student/checkout")
@auth("student")
def checkout(): return jsonify({"ok": True, "entitlement": entitlement(g.user["id"]), "plans": [clean(x) for x in db().plans.find({"is_active": True}).sort("amount_cents", ASCENDING)]})

@app.post("/api/learnhub/student/subscribe")
@auth("student")
def subscribe():
    body, error = validate_payload(request.get_json(silent=True), "payment_subscribe")
    if error:
        return fail(error)
    database = db()
    plan = database.plans.find_one({"key": body["planKey"], "is_active": {"$ne": False}})
    if not plan:
        return fail("An active plan with that key was not found.", 404)
    client = razorpay_client()
    if not client:
        return fail("Payments are not configured. Please try again later.", 503)
    if type(plan.get("amount_cents")) is not int or plan["amount_cents"] <= 0:
        return fail("This plan is not configured for online payment.", 400)
    payment_id = uid()
    try:
        order = client.order.create({
            "amount": plan["amount_cents"],
            "currency": plan.get("currency", "INR"),
            "receipt": payment_id[:40],
            "notes": {"payment_id": payment_id, "user_id": g.user["id"], "plan_id": plan["id"]},
        })
    except Exception:
        app.logger.exception("Razorpay order creation failed.")
        return fail("Could not start checkout. Please try again.", 502)
    payment = {
        "id": payment_id,
        "type": "subscription",
        "user_id": g.user["id"],
        "plan_id": plan["id"],
        "amount_cents": plan["amount_cents"],
        "currency": plan.get("currency", "INR"),
        "status": "created",
        "razorpay_order_id": order["id"],
        "created_at": now(),
    }
    database.payments.insert_one(payment)
    return jsonify({
        "ok": True,
        "orderId": order["id"],
        "amount": payment["amount_cents"],
        "currency": payment["currency"],
        "keyId": os.getenv("RAZORPAY_KEY_ID", "").strip(),
        "paymentId": payment_id,
    }), 201


@app.post("/api/learnhub/student/payments/verify")
@auth("student")
def verify_payment():
    body, error = validate_payload(request.get_json(silent=True), "payment_verify")
    if error:
        return fail(error)
    database = db()
    payment = database.payments.find_one({
        "razorpay_order_id": body["razorpay_order_id"],
        "user_id": g.user["id"],
    })
    if not payment:
        return fail("Payment order not found for this account.", 404)
    secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not secret:
        return fail("Payments are not configured.", 503)
    signed_data = f'{body["razorpay_order_id"]}|{body["razorpay_payment_id"]}'.encode()
    expected = hmac.new(secret.encode(), signed_data, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(body["razorpay_signature"], expected):
        return fail("Payment signature is invalid.", 400)
    if not capture_payment(database, body["razorpay_order_id"], body["razorpay_payment_id"]):
        return fail("Payment could not be confirmed.", 409)
    return jsonify({
        "ok": True,
        "payment": clean(database.payments.find_one({"id": payment["id"]})),
        "entitlement": entitlement(g.user["id"]),
    })


@app.get("/api/learnhub/student/billing")
@auth("student")
def student_billing():
    database = db()
    subscription = database.subscriptions.find_one(
        {"user_id": g.user["id"], "status": {"$in": ["active", "trial", "cancelled"]}},
        sort=[("created_at", -1)],
    )
    plan = database.plans.find_one({"id": subscription.get("plan_id")}) if subscription else None
    payments = [clean(payment) for payment in database.payments.find(
        {"user_id": g.user["id"]}
    ).sort("created_at", -1).limit(100)]
    return jsonify({
        "ok": True,
        "subscription": clean(subscription),
        "plan": clean(plan),
        "payments": payments,
        "entitlement": entitlement(g.user["id"]),
    })


@app.post("/api/learnhub/student/subscription/cancel")
@auth("student")
def cancel_subscription():
    database = db()
    subscription = database.subscriptions.find_one(
        {"user_id": g.user["id"], "status": "active", "ends_at": {"$gt": now()}},
        sort=[("ends_at", -1)],
    )
    if not subscription:
        return fail("No active subscription was found.", 404)
    database.subscriptions.update_one(
        {"id": subscription["id"], "user_id": g.user["id"]},
        {"$set": {"cancel_at_period_end": True, "cancel_requested_at": now()}},
    )
    return jsonify({"ok": True, "subscription": clean(database.subscriptions.find_one({"id": subscription["id"]}))})

@app.get("/api/learnhub/student/notifications")
@auth()
def notifications():
    rows = [clean(x) for x in db().notifications.find({"user_id": g.user["id"]}).sort("created_at", -1).limit(50)]
    return jsonify({"ok": True, "notifications": rows, "unreadCount": sum(not x.get("read_at") for x in rows)})

@app.patch("/api/learnhub/student/notifications")
@auth()
def update_notifications():
    body = request.get_json(silent=True) or {}; query = {"user_id": g.user["id"]}
    if body.get("ids"): query["id"] = {"$in": body["ids"]}
    elif not body.get("markAllRead"): return fail("ids or markAllRead is required.")
    else: query["read_at"] = None
    db().notifications.update_many(query, {"$set": {"read_at": now()}}); return jsonify({"ok": True})

@app.post("/api/learnhub/student/tests/<test_id>/submit")
@auth("student")
def submit_test(test_id):
    body = request.get_json(silent=True)
    if not isinstance(body, dict): return fail("Request body must be a JSON object.")
    unknown = set(body) - {"answers"}
    if unknown: return fail("Unknown field(s): " + ", ".join(sorted(unknown)) + ".")
    answers = body.get("answers", {})
    if not isinstance(answers, dict): return fail("answers must be an object.")
    database = db()
    test = by_id(database.tests, test_id)
    if not test: return fail("Test not found.", 404)
    course = database.courses.find_one({"id": test.get("course_id"), "status": "published"})
    if not course: return fail("Test not found.", 404)
    if not course_access_allowed(entitlement(g.user["id"])):
        return fail("An active subscription or available trial course is required to take this test.", 403)
    attempt_count = database.test_attempts.count_documents({"user_id": g.user["id"], "test_id": test_id})
    max_attempts = max(1, int(test.get("max_attempts", 3) or 3))
    if attempt_count >= max_attempts:
        return fail("Maximum test attempts reached.", 429)
    questions = list(database.questions.find({"test_id": test_id}))
    score = sum(float(question.get("marks", 1)) for question in questions if answers.get(question.get("id")) == question.get("answer_key"))
    total = sum(float(question.get("marks", 1)) for question in questions) or 1
    percent = score / total * 100
    attempt = {"id": uid(), "user_id": g.user["id"], "test_id": test_id, "score": score, "score_percent": percent,
               "passed": percent >= float(test.get("pass_percent", 60)), "submitted_at": now(), "attempts_count": attempt_count + 1}
    database.test_attempts.insert_one(attempt)
    return jsonify({"ok": True, "attempt": clean(attempt)})

@app.route("/api/learnhub/instructor/courses", methods=["GET", "POST"])
@auth("instructor")
def instructor_courses():
    database = db()
    if request.method == "GET": return jsonify({"ok": True, "data": [with_course_refs(x) for x in database.courses.find({"instructor_id": g.user["id"]}).sort("created_at", -1)]})
    body, error = validate_payload(request.get_json(silent=True), "course_create")
    if error: return fail(error)
    slug = body.get("slug") or "-".join(body["title"].lower().split())
    if database.courses.find_one({"slug": slug}): return fail("A course with this slug already exists.", 409)
    category = None
    if body.get("category_id"):
        category = database.categories.find_one({"id": body["category_id"], "is_active": {"$ne": False}})
        if not category:
            return fail("Select an active course category.", 400)
    elif body.get("category"):
        category = database.categories.find_one({"name": body["category"], "is_active": {"$ne": False}})
        if not category:
            return fail("Select a category from the available categories.", 400)
    course = {"id": uid(), "instructor_id": g.user["id"], "category_id": category.get("id") if category else None, "title": body.get("title"), "slug": slug, "short_description": body.get("shortDescription"), "description": body.get("description"), "status": "draft", "created_at": now()}
    if "priceCents" in body:
        course["price_cents"] = body["priceCents"]
    if "thumbnailUrl" in body: course["thumbnail_url"] = body["thumbnailUrl"]
    database.courses.insert_one(course); return jsonify({"ok": True, "course": clean(course)}), 201

@app.route("/api/learnhub/instructor/courses/<course_id>", methods=["GET", "PUT", "PATCH", "DELETE"])
@auth("instructor")
def instructor_course(course_id):
    database = db(); course = database.courses.find_one({"id": course_id, "instructor_id": g.user["id"]})
    if not course: return fail("Course not found.", 404)
    if request.method == "GET": return jsonify({"ok": True, "course": with_course_refs(course)})
    if request.method == "DELETE":
        archived = archive_or_delete_course(database, course_id)
        return jsonify({"ok": True, "archived": archived})
    if course.get("status") == "archived":
        return fail("Archived courses cannot be changed.", 409)
    payload = request.get_json(silent=True)
    if isinstance(payload, dict) and payload.get("status") == "published":
        return fail("Only an admin can publish a course. Submit it for review instead.", 403)
    values, error = validate_payload(payload, "course_update")
    if error: return fail(error)
    if values.get("category_id") and not database.categories.find_one({"id": values["category_id"], "is_active": {"$ne": False}}):
        return fail("Select an active course category.", 400)
    if course.get("status") == "pending_review" and values.get("status") != "draft":
        return fail("Withdraw this course to draft before editing it.", 409)
    if values.get("status") == "pending_review":
        missing = []
        if not values.get("title", course.get("title", "")).strip(): missing.append("course title")
        if not values.get("description", course.get("description", "")).strip(): missing.append("course description")
        if values.get("price_cents", course.get("price_cents")) is None: missing.append("course price")
        if not database.lessons.find_one({"course_id": course_id}): missing.append("at least one lesson")
        if missing: return fail("Cannot submit for review. Missing: " + ", ".join(missing) + ".")
    fields = {k: v for k, v in values.items()}; fields["updated_at"] = now()
    if values.get("status") == "pending_review":
        fields["submitted_at"] = now()
        database.courses.update_one(
            {"id": course_id},
            {"$set": fields, "$unset": {"rejection_reason": ""}},
        )
        return jsonify({"ok": True, "course": clean(database.courses.find_one({"id": course_id}))})
    database.courses.update_one({"id": course_id}, {"$set": fields}); return jsonify({"ok": True, "course": clean(database.courses.find_one({"id": course_id}))})

@app.get("/api/learnhub/instructor/courses/<course_id>/studio")
@auth("instructor")
def course_studio(course_id):
    course = db().courses.find_one({"id": course_id, "instructor_id": g.user["id"]})
    if not course: return fail("Course not found.", 404)
    return jsonify({"ok": True, "course": with_course_refs(course), "lessons": [clean(x) for x in db().lessons.find({"course_id": course_id}).sort("sort_order", 1)]})

@app.post("/api/learnhub/instructor/lessons")
@auth("instructor")
def create_lesson():
    body, error = validate_payload(request.get_json(silent=True), "lesson_create")
    if error: return fail(error)
    course_id = body.get("courseId") or body.get("course_id")
    database = db()
    course = database.courses.find_one({"id": course_id, "instructor_id": g.user["id"]})
    if not course: return fail("Course not found.", 404)
    if course.get("status") == "archived": return fail("Archived courses cannot be changed.", 409)
    module_id = body.get("moduleId") or body.get("module_id")
    if module_id and not database.modules.find_one({"id": module_id, "course_id": course_id}): return fail("Module does not belong to this course.", 404)
    lesson = {"id": uid(), "course_id": course_id, "title": body.get("title", "Untitled lesson"), "created_at": now()}
    aliases = {
        "moduleId": "module_id", "module_id": "module_id", "description": "description", "content": "content",
        "videoUrl": "video_url", "video_url": "video_url", "durationSeconds": "duration_seconds",
        "duration_seconds": "duration_seconds", "sortOrder": "sort_order", "sort_order": "sort_order",
        "preview": "preview", "isPreview": "preview", "isPaid": "is_paid", "is_paid": "is_paid",
    }
    for source, target in aliases.items():
        if source in body:
            lesson[target] = body[source]
    database.lessons.insert_one(lesson); return jsonify({"ok": True, "lesson": clean(lesson)}), 201

@app.post("/api/learnhub/instructor/lessons/<lesson_id>/resources")
@auth("instructor")
def create_lesson_resource(lesson_id):
    database = db()
    lesson = database.lessons.find_one({"id": lesson_id}); course = database.courses.find_one({"id": lesson.get("course_id"), "instructor_id": g.user["id"]}) if lesson else None
    if not course: return fail("Lesson not found.", 404)
    if course.get("status") == "archived": return fail("Archived courses cannot be changed.", 409)
    body, error = validate_payload(request.get_json(silent=True), "lesson_resource")
    if error: return fail(error)
    resource = {"id": uid(), "lesson_id": lesson_id, "created_at": now(), "title": body["title"], "resource_type": body["resourceType"], "url": body["url"], "description": body.get("description", "")}
    database.lesson_resources.insert_one(resource); return jsonify({"ok": True, "resource": clean(resource)}), 201

UPLOAD_TYPES = {
    ".mp4": {"video/mp4"}, ".webm": {"video/webm"}, ".pdf": {"application/pdf"},
    ".png": {"image/png"}, ".jpg": {"image/jpeg"}, ".jpeg": {"image/jpeg"},
    ".webp": {"image/webp"}, ".zip": {"application/zip", "application/x-zip-compressed"},
}

def upload_file_policy(filename, mimetype):
    extension = Path(filename or "").suffix.lower()
    if extension not in UPLOAD_TYPES:
        return None, "Unsupported file type. Allowed: mp4, webm, pdf, png, jpg, jpeg, webp, zip.", 415
    if (mimetype or "").lower() not in UPLOAD_TYPES[extension]:
        return None, "File content type does not match its extension.", 415
    return extension, None, None

def upload_size_limit():
    try:
        default = 4 if os.getenv("VERCEL") else 100
        return max(1, int(os.getenv("UPLOAD_MAX_MB", str(default)))) * 1024 * 1024
    except (TypeError, ValueError):
        return (4 if os.getenv("VERCEL") else 100) * 1024 * 1024

@app.post("/api/learnhub/instructor/upload/presign")
@auth("instructor")
def upload_presign():
    body = request.get_json(silent=True)
    if not isinstance(body, dict): return fail("Request body must be a JSON object.")
    unknown = set(body) - {"fileName", "contentType"}
    if unknown: return fail("Unknown field(s): " + ", ".join(sorted(unknown)) + ".")
    filename = body.get("fileName")
    content_type = body.get("contentType")
    if not isinstance(filename, str) or len(filename) > 255: return fail("fileName must be a string up to 255 characters.")
    if not isinstance(content_type, str): return fail("contentType must be a string.")
    extension, error, status = upload_file_policy(filename, content_type)
    if error: return fail(error, status)
    if os.getenv("STORAGE_PROVIDER", "").lower() != "s3":
        if os.getenv("VERCEL"): return fail("Configure S3 storage for browser uploads on Vercel.", 503)
        return fail("Presigned uploads require S3 storage configuration.", 409)
    if boto3 is None: return fail("S3 storage dependencies are not installed.", 503)
    bucket = os.getenv("S3_BUCKET", "").strip()
    public_base = os.getenv("S3_PUBLIC_BASE_URL", "").rstrip("/")
    if not bucket or not public_base: return fail("S3_BUCKET and S3_PUBLIC_BASE_URL are required for browser uploads.", 503)
    safe_name = secure_filename(Path(filename).name) or "upload" + extension
    key = f"{uid()}-{safe_name}"
    client = boto3.client("s3", endpoint_url=os.getenv("S3_ENDPOINT_URL") or None,
        region_name=os.getenv("S3_REGION") or None, aws_access_key_id=os.getenv("S3_ACCESS_KEY_ID") or None,
        aws_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY") or None)
    try:
        upload_url = client.generate_presigned_url("put_object", Params={"Bucket": bucket, "Key": key, "ContentType": content_type}, ExpiresIn=600)
    except Exception:
        app.logger.exception("Could not create presigned upload URL.")
        return fail("Could not prepare the S3 upload. Check the storage configuration.", 503)
    return jsonify({"ok": True, "uploadUrl": upload_url, "url": f"{public_base}/{key}", "filename": key, "headers": {"Content-Type": content_type}})

@app.post("/api/learnhub/instructor/upload")
@auth("instructor")
def upload():
    if "file" not in request.files: return fail("Select a file to upload.")
    file = request.files["file"]
    original_name = Path(file.filename or "upload").name
    extension, error, status = upload_file_policy(original_name, file.mimetype)
    if error: return fail(error, status)
    file.stream.seek(0, 2); size = file.stream.tell(); file.stream.seek(0)
    if size > upload_size_limit(): return fail(f"Upload is too large. Maximum size is {upload_size_limit() // (1024 * 1024)} MB.", 413)
    provider = os.getenv("STORAGE_PROVIDER", "").lower()
    if provider == "s3":
        if boto3 is None: return fail("S3 storage dependencies are not installed.", 503)
        bucket = os.getenv("S3_BUCKET", "").strip(); base_url = os.getenv("S3_PUBLIC_BASE_URL", "").rstrip("/")
        if not bucket or not base_url: return fail("S3_BUCKET and S3_PUBLIC_BASE_URL are required for uploads.", 503)
        safe_name = secure_filename(original_name) or "upload" + extension
        filename = f"{uid()}-{safe_name}"
        client = boto3.client("s3", endpoint_url=os.getenv("S3_ENDPOINT_URL") or None,
            region_name=os.getenv("S3_REGION") or None, aws_access_key_id=os.getenv("S3_ACCESS_KEY_ID") or None,
            aws_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY") or None)
        try:
            client.upload_fileobj(file, bucket, filename, ExtraArgs={"ContentType": file.mimetype})
        except Exception:
            app.logger.exception("S3 upload failed.")
            return fail("Could not upload file to S3.", 503)
        return jsonify({"ok": True, "url": f"{base_url}/{filename}", "filename": filename})
    if provider != "local" or os.getenv("VERCEL"):
        return fail("Configure S3 storage for this deployment. Local uploads are only available when STORAGE_PROVIDER=local outside Vercel.", 503)
    safe_name = secure_filename(original_name) or "upload" + extension
    filename = f"{uid()}-{safe_name}"
    target = Path(os.getenv("UPLOAD_FOLDER", "uploads")); target.mkdir(parents=True, exist_ok=True); file.save(target / filename)
    return jsonify({"ok": True, "url": f"/uploads/{filename}", "filename": filename})

@app.get("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(Path(os.getenv("UPLOAD_FOLDER", "uploads")), filename)

@app.get("/api/learnhub/admin/users")
@auth("admin")
def admin_users():
    page, limit = request.args.get("page", "1"), request.args.get("limit", "25")
    try:
        page, limit = int(page), int(limit)
    except ValueError:
        return fail("page and limit must be positive integers.")
    if page < 1 or limit < 1 or limit > 100:
        return fail("page must be positive and limit must be between 1 and 100.")
    query = {}
    conditions = []
    role = request.args.get("role")
    status = request.args.get("status")
    if role:
        if role not in ("student", "instructor", "admin"):
            return fail("Unsupported role filter.")
        query["role"] = role
    if status:
        if status not in ("active", "suspended", "deleted"):
            return fail("Unsupported status filter.")
        if status == "active":
            conditions.append({"$or": [{"status": "active"}, {"status": {"$exists": False}}]})
        else:
            query["status"] = status
    search = request.args.get("search", "").strip()
    if len(search) > 100:
        return fail("search must be 100 characters or fewer.")
    if search:
        escaped = __import__("re").escape(search)
        conditions.append({"$or": [
            {"full_name": {"$regex": escaped, "$options": "i"}},
            {"email": {"$regex": escaped, "$options": "i"}},
        ]})
    if conditions:
        query["$and"] = conditions
    database = db()
    total = database.profiles.count_documents(query)
    users = [
        profile_public(user) | {"status": user.get("status", "active"), "created_at": user.get("created_at")}
        for user in database.profiles.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    ]
    return jsonify({"ok": True, "users": users, "page": page, "limit": limit, "total": total})

@app.get("/api/learnhub/admin/users/<user_id>")
@auth("admin")
def admin_user_detail(user_id):
    database = db()
    user = database.profiles.find_one({"id": user_id})
    if not user:
        return fail("User not found.", 404)
    subscriptions = list(database.subscriptions.find({"user_id": user_id}).sort("created_at", -1).limit(20))
    enrollments = []
    for enrollment in database.enrollments.find({"user_id": user_id}).sort("created_at", -1).limit(100):
        course = database.courses.find_one({"id": enrollment.get("course_id")})
        enrollments.append({"enrollment": clean(enrollment), "course": clean(course) if course else None})
    payments = [clean(payment) for payment in database.payments.find({"user_id": user_id}).sort("created_at", -1).limit(100)]
    profile = profile_public(user) | {"status": user.get("status", "active"), "created_at": user.get("created_at")}
    return jsonify({
        "ok": True,
        "profile": profile,
        "subscription": clean(subscriptions[0]) if subscriptions else None,
        "subscriptions": [clean(item) for item in subscriptions],
        "enrolled_courses": enrollments,
        "payments": payments,
    })

def admin_set_user_status(user_id, target_status):
    database = db()
    user = database.profiles.find_one({"id": user_id})
    if not user:
        return fail("User not found.", 404)
    if user_id == g.user["id"]:
        return fail("You cannot change your own account status.", 403)
    if user.get("role") == "admin" and target_status in ("suspended", "deleted"):
        active_admins = database.profiles.count_documents({
            "role": "admin",
            "status": {"$nin": ["suspended", "deleted"]},
        })
        if active_admins <= 1:
            return fail("The last active admin cannot be suspended or deleted.", 409)
    body, error = validate_payload(request.get_json(silent=True) or {}, "user_status")
    if error: return fail(error)
    updated_at = now()
    fields = {"status": target_status, "updated_at": updated_at}
    if target_status == "deleted":
        fields["deleted_at"] = updated_at
        update = {"$set": fields}
    else:
        update = {"$set": fields, "$unset": {"deleted_at": ""}}
    database.profiles.update_one({"id": user_id}, update)
    audit_admin_action(
        database,
        f"user_{target_status}",
        "user",
        user_id,
        {"reason": body.get("reason", "")},
    )
    return jsonify({"ok": True, "user": profile_public(database.profiles.find_one({"id": user_id})) | {"status": target_status}})

@app.post("/api/learnhub/admin/users/<user_id>/suspend")
@auth("admin")
def suspend_user(user_id):
    return admin_set_user_status(user_id, "suspended")

@app.post("/api/learnhub/admin/users/<user_id>/reactivate")
@auth("admin")
def reactivate_user(user_id):
    return admin_set_user_status(user_id, "active")

@app.post("/api/learnhub/admin/users/<user_id>/delete")
@auth("admin")
def soft_delete_user(user_id):
    return admin_set_user_status(user_id, "deleted")

@app.get("/api/learnhub/admin/instructor-applications")
@auth("admin")
def admin_instructor_applications():
    status = request.args.get("status", "pending")
    if status not in ("pending", "approved", "rejected"):
        return fail("Unsupported application status filter.")
    database = db()
    applications = []
    for application in database.instructor_applications.find({"status": status}).sort("created_at", -1).limit(200):
        row = clean(application)
        user = database.profiles.find_one({"id": application.get("user_id")})
        row["user"] = profile_public(user) if user else None
        instructor_profile = database.instructor_profiles.find_one({"user_id": application.get("user_id")})
        row["verified_badge"] = bool(instructor_profile and instructor_profile.get("verified_badge"))
        applications.append(row)
    return jsonify({"ok": True, "applications": applications, "status": status})

@app.get("/api/learnhub/admin/instructors")
@auth("admin")
def admin_instructors():
    search = request.args.get("search", "").strip()
    if len(search) > 100:
        return fail("search must be 100 characters or fewer.")
    query = {"role": "instructor"}
    if search:
        escaped = __import__("re").escape(search)
        query["$or"] = [
            {"full_name": {"$regex": escaped, "$options": "i"}},
            {"email": {"$regex": escaped, "$options": "i"}},
        ]
    database = db()
    instructors = []
    for user in database.profiles.find(query).sort("created_at", -1).limit(200):
        instructor_profile = database.instructor_profiles.find_one({"user_id": user["id"]})
        instructors.append({
            **profile_public(user),
            "status": (instructor_profile or {}).get("status", "pending"),
            "verified_badge": bool((instructor_profile or {}).get("verified_badge")),
        })
    return jsonify({"ok": True, "instructors": instructors})

@app.post("/api/learnhub/admin/instructor-applications/<application_id>/approve")
@auth("admin")
def approve_instructor_application(application_id):
    database = db()
    application = database.instructor_applications.find_one({"id": application_id, "status": "pending"})
    if not application:
        return fail("Pending instructor application not found.", 404)
    if not database.profiles.find_one({"id": application["user_id"]}):
        return fail("Applicant account not found.", 404)
    result = database.instructor_applications.update_one(
        {"id": application_id, "status": "pending"},
        {"$set": {"status": "approved", "reviewed_at": now(), "reviewed_by": g.user["id"]}},
    )
    if result.modified_count != 1:
        return fail("Instructor application is no longer pending.", 409)
    database.profiles.update_one({"id": application["user_id"]}, {"$set": {"role": "instructor"}})
    database.instructor_profiles.update_one(
        {"user_id": application["user_id"]},
        {"$set": {"bio": application.get("bio", ""), "headline": application.get("headline", ""), "verified_badge": False, "status": "approved"}},
        upsert=True,
    )
    database.notifications.insert_one({
        "id": uid(),
        "user_id": application["user_id"],
        "type": "instructor_application_approved",
        "title": "Instructor application approved",
        "message": "Your instructor application has been approved.",
        "created_at": now(),
        "read_at": None,
    })
    audit_admin_action(database, "instructor_application_approved", "instructor_application", application_id)
    application.update({"status": "approved"})
    return jsonify({"ok": True, "application": clean(application)})

@app.post("/api/learnhub/admin/instructor-applications/<application_id>/reject")
@auth("admin")
def reject_instructor_application(application_id):
    body, error = validate_payload(request.get_json(silent=True), "instructor_application_rejection")
    if error: return fail(error)
    database = db()
    application = database.instructor_applications.find_one({"id": application_id, "status": "pending"})
    if not application:
        return fail("Pending instructor application not found.", 404)
    result = database.instructor_applications.update_one(
        {"id": application_id, "status": "pending"},
        {"$set": {"status": "rejected", "rejection_reason": body["reason"], "reviewed_at": now(), "reviewed_by": g.user["id"]}},
    )
    if result.modified_count != 1:
        return fail("Instructor application is no longer pending.", 409)
    database.instructor_profiles.update_one(
        {"user_id": application["user_id"]},
        {"$set": {"verified_badge": False, "status": "rejected"}},
        upsert=True,
    )
    database.notifications.insert_one({
        "id": uid(),
        "user_id": application["user_id"],
        "type": "instructor_application_rejected",
        "title": "Instructor application update",
        "message": f"Your instructor application was rejected. Reason: {body['reason']}",
        "created_at": now(),
        "read_at": None,
    })
    audit_admin_action(database, "instructor_application_rejected", "instructor_application", application_id, {"reason": body["reason"]})
    application.update({"status": "rejected", "rejection_reason": body["reason"]})
    return jsonify({"ok": True, "application": clean(application)})

@app.patch("/api/learnhub/admin/instructors/<user_id>/verification")
@auth("admin")
def set_instructor_verification(user_id):
    body, error = validate_payload(request.get_json(silent=True), "instructor_verification")
    if error: return fail(error)
    database = db()
    if not database.profiles.find_one({"id": user_id, "role": "instructor"}):
        return fail("Instructor not found.", 404)
    database.instructor_profiles.update_one(
        {"user_id": user_id},
        {"$set": {"verified_badge": body["verified_badge"], "updated_at": now()}},
        upsert=True,
    )
    audit_admin_action(database, "instructor_verification_updated", "instructor", user_id, {"verified_badge": body["verified_badge"]})
    return jsonify({"ok": True, "verified_badge": body["verified_badge"]})

@app.route("/api/learnhub/admin/categories", methods=["GET", "POST"])
@auth("admin")
def admin_categories():
    database = db()
    if request.method == "GET":
        categories = [clean(category) for category in database.categories.find({}).sort([("sort_order", ASCENDING), ("name", ASCENDING)])]
        return jsonify({"ok": True, "categories": categories})
    body, error = validate_payload(request.get_json(silent=True), "category_create")
    if error: return fail(error)
    if database.categories.find_one({"slug": body["slug"]}):
        return fail("A category with this slug already exists.", 409)
    category = {
        "id": uid(),
        "name": body["name"],
        "slug": body["slug"],
        "description": body.get("description", ""),
        "sort_order": body.get("sort_order", 0),
        "is_active": body.get("is_active", True),
        "created_at": now(),
        "updated_at": now(),
    }
    try:
        database.categories.insert_one(category)
    except DuplicateKeyError:
        return fail("A category with this slug already exists.", 409)
    audit_admin_action(database, "category_created", "category", category["id"], {"slug": category["slug"]})
    return jsonify({"ok": True, "category": clean(category)}), 201

@app.route("/api/learnhub/admin/categories/<category_id>", methods=["PATCH", "DELETE"])
@auth("admin")
def admin_category(category_id):
    database = db()
    category = database.categories.find_one({"id": category_id})
    if not category:
        return fail("Category not found.", 404)
    if request.method == "DELETE":
        course_count = database.courses.count_documents({"category_id": category_id})
        if course_count:
            return fail("Category has courses. Reassign them before deleting it.", 409)
        database.categories.delete_one({"id": category_id})
        audit_admin_action(database, "category_deleted", "category", category_id, {"slug": category.get("slug")})
        return jsonify({"ok": True})
    body, error = validate_payload(request.get_json(silent=True), "category_update")
    if error: return fail(error)
    fields = {key: value for key, value in body.items()}
    fields["updated_at"] = now()
    if "slug" in fields and database.categories.find_one({"slug": fields["slug"], "id": {"$ne": category_id}}):
        return fail("A category with this slug already exists.", 409)
    try:
        database.categories.update_one({"id": category_id}, {"$set": fields})
    except DuplicateKeyError:
        return fail("A category with this slug already exists.", 409)
    audit_admin_action(database, "category_updated", "category", category_id, {"fields": sorted(body)})
    return jsonify({"ok": True, "category": clean(database.categories.find_one({"id": category_id}))})

@app.get("/api/learnhub/admin/audit-logs")
@auth("admin")
def admin_audit_logs():
    try:
        page = int(request.args.get("page", "1"))
        limit = int(request.args.get("limit", "50"))
    except ValueError:
        return fail("page and limit must be positive integers.")
    if page < 1 or limit < 1 or limit > 100:
        return fail("page must be positive and limit must be between 1 and 100.")
    query = {}
    action = request.args.get("action")
    target_type = request.args.get("target_type")
    if action:
        if len(action) > 100:
            return fail("action must be 100 characters or fewer.")
        query["action"] = action
    if target_type:
        if target_type not in ("user", "instructor", "instructor_application", "category", "course", "lesson", "plan"):
            return fail("Unsupported target_type filter.")
        query["target_type"] = target_type
    database = db()
    rows = [clean(row) for row in database.audit_logs.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit)]
    return jsonify({"ok": True, "logs": rows, "page": page, "limit": limit, "total": database.audit_logs.count_documents(query)})

@app.get("/api/learnhub/admin/plans")
@auth("admin")
def admin_plans(): return jsonify({"ok": True, "plans": [clean(x) for x in db().plans.find({}).sort("amount_cents", 1)]})

@app.get("/api/learnhub/admin/courses")
@auth("admin")
def admin_courses():
    statuses = {"draft", "pending_review", "published", "rejected", "unpublished", "archived"}
    status = request.args.get("status", "pending_review")
    if status not in statuses:
        return fail("Unsupported course status filter.")
    database = db()
    rows = []
    for course in database.courses.find({"status": status}).sort("submitted_at", -1).limit(200):
        row = clean(course)
        instructor = database.profiles.find_one({"id": course.get("instructor_id")})
        row["instructor"] = profile_public(instructor) if instructor else None
        rows.append(row)
    return jsonify({"ok": True, "courses": rows, "status": status})

@app.post("/api/learnhub/admin/courses/<course_id>/approve")
@auth("admin")
def approve_course(course_id):
    database = db()
    course = database.courses.find_one({"id": course_id, "status": "pending_review"})
    if not course:
        return fail("Pending course not found.", 404)
    published_at = now()
    result = database.courses.update_one(
        {"id": course_id, "status": "pending_review"},
        {"$set": {"status": "published", "published_at": published_at, "updated_at": published_at},
         "$unset": {"rejection_reason": ""}},
    )
    if result.modified_count != 1:
        return fail("Course is no longer pending review.", 409)
    course.update({"status": "published", "published_at": published_at})
    notify_course_decision(database, course, "approved", "Your course has been approved and is now published.")
    audit_admin_action(database, "course_approved", "course", course_id)
    return jsonify({"ok": True, "course": clean(course)})

@app.post("/api/learnhub/admin/courses/<course_id>/reject")
@auth("admin")
def reject_course(course_id):
    body, error = validate_payload(request.get_json(silent=True), "course_rejection")
    if error: return fail(error)
    database = db()
    course = database.courses.find_one({"id": course_id, "status": "pending_review"})
    if not course:
        return fail("Pending course not found.", 404)
    rejected_at = now()
    result = database.courses.update_one(
        {"id": course_id, "status": "pending_review"},
        {"$set": {"status": "rejected", "rejection_reason": body["reason"], "updated_at": rejected_at}},
    )
    if result.modified_count != 1:
        return fail("Course is no longer pending review.", 409)
    course.update({"status": "rejected", "rejection_reason": body["reason"]})
    notify_course_decision(database, course, "rejected", f"Your course was rejected. Reason: {body['reason']}")
    audit_admin_action(database, "course_rejected", "course", course_id, {"reason": body["reason"]})
    return jsonify({"ok": True, "course": clean(course)})

@app.post("/api/learnhub/admin/courses/<course_id>/unpublish")
@auth("admin")
def unpublish_course(course_id):
    database = db()
    result = database.courses.update_one(
        {"id": course_id, "status": "published"},
        {"$set": {"status": "unpublished", "unpublished_at": now(), "updated_at": now()}},
    )
    if result.matched_count != 1:
        return fail("Published course not found.", 404)
    audit_admin_action(database, "course_unpublished", "course", course_id)
    return jsonify({"ok": True, "course": clean(database.courses.find_one({"id": course_id}))})

@app.route("/api/learnhub/admin/plans", methods=["POST", "PUT", "PATCH"])
@auth("admin")
def save_plan():
    body, error = validate_payload(request.get_json(silent=True), "plan_write")
    if error: return fail(error)
    key = body["key"]
    fields = {name: body[name] for name in ("key", "label", "amount_cents", "currency", "is_active", "trial_days", "description") if name in body}
    fields["updated_at"] = now()
    database = db()
    database.plans.update_one({"key": key}, {"$set": fields, "$setOnInsert": {"id": uid(), "created_at": now()}}, upsert=True)
    audit_admin_action(database, "plan_updated", "plan", key, {"fields": sorted(fields)})
    return jsonify({"ok": True, "plan": clean(database.plans.find_one({"key": key}))})

@app.get("/api/learnhub/admin/overview")
@auth("admin")
def admin_overview():
    database = db(); month = datetime.now(timezone.utc).replace(day=1).isoformat()
    return jsonify({"ok": True, "stats": {"totalSubscribers": database.subscriptions.count_documents({"status": "active"}), "activeInstructors": database.profiles.count_documents({"role": "instructor"}), "pendingModeration": database.moderation_flags.count_documents({"status": "pending"}), "signupsThisMonth": database.profiles.count_documents({"created_at": {"$gte": month}})}, "popularCourses": [with_course_refs(x) for x in database.courses.find({"status": "published"}).sort("published_at", -1).limit(5)], "recentSignups": [profile_public(x) for x in database.profiles.find({}).sort("created_at", -1).limit(10)]})

@app.get("/api/learnhub/admin/analytics")
@auth("admin")
def admin_analytics():
    database = db(); revenue = sum(x.get("amount_cents", 0) for x in database.payments.find({"status": "captured"}))
    return jsonify({"ok": True, "totalRevenuePaise": revenue, "activeSubscribers": database.subscriptions.count_documents({"status": "active"}), "trials": database.subscriptions.count_documents({"status": "trial"}), "cancelled": database.subscriptions.count_documents({"status": "cancelled"})})

@app.get("/api/learnhub/admin/payouts")
@auth("admin")
def payouts():
    database = db()
    totals = database.revenue_shares.aggregate([
        {"$match": {"status": {"$in": ["pending", "paid"]}, "instructor_id": {"$ne": "platform"}}},
        {"$group": {
            "_id": "$instructor_id",
            "pending_amount_cents": {
                "$sum": {"$cond": [{"$eq": ["$status", "pending"]}, "$amount_cents", 0]},
            },
            "paid_amount_cents": {
                "$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$amount_cents", 0]},
            },
            "pending_shares": {
                "$sum": {"$cond": [{"$eq": ["$status", "pending"]}, 1, 0]},
            },
        }},
        {"$sort": {"pending_amount_cents": -1}},
    ])
    payouts_by_instructor = []
    for total in totals:
        instructor_id = total["_id"]
        payouts_by_instructor.append({
            "id": instructor_id,
            "instructor_id": instructor_id,
            "instructor": profile_public(database.profiles.find_one({"id": instructor_id}) or {}),
            "pending_amount_cents": total["pending_amount_cents"],
            "paid_amount_cents": total["paid_amount_cents"],
            "pending_shares": total["pending_shares"],
        })
    return jsonify({"ok": True, "payouts": payouts_by_instructor})


@app.post("/api/learnhub/admin/payouts/<instructor_id>/mark-paid")
@auth("admin")
def mark_payout_paid(instructor_id):
    body, error = validate_payload(request.get_json(silent=True), "payout_mark_paid")
    if error:
        return fail(error)
    database = db()
    result = database.revenue_shares.update_many(
        {"instructor_id": instructor_id, "status": "pending"},
        {"$set": {
            "status": "paid",
            "paid_at": now(),
            "paid_by": g.user["id"],
            "reference": body["reference"],
        }},
    )
    if result.matched_count == 0:
        return fail("No pending payout was found for this instructor.", 404)
    audit_admin_action(
        database,
        "instructor_payout_marked_paid",
        "instructor",
        instructor_id,
        {"reference": body["reference"], "share_count": result.modified_count},
    )
    return jsonify({"ok": True, "paidShares": result.modified_count})


@app.get("/api/learnhub/instructor/earnings")
@auth("instructor")
def instructor_earnings():
    database = db()
    rows = [clean(row) for row in database.revenue_shares.find(
        {"instructor_id": g.user["id"]}
    ).sort("created_at", -1).limit(500)]
    totals = next(iter(database.revenue_shares.aggregate([
        {"$match": {"instructor_id": g.user["id"], "status": {"$in": ["pending", "paid"]}}},
        {"$group": {
            "_id": "$instructor_id",
            "pending_amount_cents": {
                "$sum": {"$cond": [{"$eq": ["$status", "pending"]}, "$amount_cents", 0]},
            },
            "paid_amount_cents": {
                "$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$amount_cents", 0]},
            },
        }},
    ])), {})
    return jsonify({
        "ok": True,
        "earnings": {
            "pending_amount_cents": totals.get("pending_amount_cents", 0),
            "paid_amount_cents": totals.get("paid_amount_cents", 0),
            "shares": rows,
        },
    })


@app.get("/api/learnhub/admin/payments")
@auth("admin")
def admin_payments():
    status = request.args.get("status")
    allowed_statuses = ("created", "captured", "failed", "refund_pending", "refunded", "partially_refunded")
    if status and status not in allowed_statuses:
        return fail("status must be created, captured, failed, refund_pending, refunded, or partially_refunded.")
    query = {"status": status} if status else {}
    rows = [clean(row) for row in db().payments.find(query).sort("created_at", -1).limit(200)]
    return jsonify({"ok": True, "payments": rows})


@app.post("/api/learnhub/admin/payments/<payment_id>/refund")
@auth("admin")
def refund_payment(payment_id):
    database = db()
    payment = database.payments.find_one({"id": payment_id, "status": "captured"})
    if not payment or not payment.get("razorpay_payment_id"):
        return fail("Captured payment not found.", 404)
    client = razorpay_client()
    if not client:
        return fail("Payments are not configured.", 503)
    claimed = database.payments.update_one(
        {"id": payment_id, "status": "captured"},
        {"$set": {"status": "refund_pending", "refund_requested_at": now()}},
    )
    if claimed.modified_count != 1:
        return fail("This payment refund is already being processed.", 409)
    try:
        refund = client.payment.refund(
            payment["razorpay_payment_id"],
            {"amount": int(payment["amount_cents"])},
        )
    except Exception:
        app.logger.exception("Razorpay refund request failed.")
        return fail("Refund status could not be confirmed. Check Razorpay before retrying.", 502)
    timestamp = now()
    database.payments.update_one(
        {"id": payment_id, "status": {"$in": ["refund_pending", "refunded"]}},
        {"$set": {
            "status": "refunded",
            "razorpay_refund_id": refund.get("id"),
            "refunded_amount_cents": int(payment["amount_cents"]),
            "refunded_at": timestamp,
            "updated_at": timestamp,
        }},
    )
    database.subscriptions.update_many(
        {"payment_id": payment_id, "status": "active"},
        {"$set": {"status": "refunded", "updated_at": timestamp}},
    )
    database.revenue_shares.update_many(
        {"payment_id": payment_id, "status": "pending"},
        {"$set": {"status": "void", "updated_at": timestamp}},
    )
    audit_admin_action(
        database,
        "payment_refunded",
        "payment",
        payment_id,
        {"razorpay_refund_id": refund.get("id"), "amount_cents": payment["amount_cents"]},
    )
    return jsonify({"ok": True, "payment": clean(database.payments.find_one({"id": payment_id}))})

@app.route("/api/learnhub/admin/moderation", methods=["GET", "POST"])
@auth("admin")
def moderation():
    database = db()
    if request.method == "GET": return jsonify({"ok": True, "flags": [clean(x) for x in database.moderation_flags.find({}).sort("created_at", -1)]})
    body, error = validate_payload(request.get_json(silent=True), "moderation_create")
    if error: return fail(error)
    target_collection = {"course": database.courses, "lesson": database.lessons, "user": database.profiles}[body["targetType"]]
    if not target_collection.find_one({"id": body["targetId"]}):
        return fail("Flag target not found.", 404)
    flag = {"id": uid(), "target_type": body["targetType"], "target_id": body["targetId"], "reason": body["reason"], "severity": body.get("severity", "medium"), "status": "pending", "created_by": g.user["id"], "created_at": now()}
    database.moderation_flags.insert_one(flag)
    audit_admin_action(database, "moderation_flag_created", body["targetType"], body["targetId"], {"flag_id": flag["id"]})
    return jsonify({"ok": True, "flag": clean(flag)}), 201

@app.patch("/api/learnhub/admin/moderation/<flag_id>/resolve")
@auth("admin")
def resolve_moderation(flag_id):
    body, error = validate_payload(request.get_json(silent=True) or {}, "moderation_resolution")
    if error: return fail(error)
    database = db()
    flag = database.moderation_flags.find_one({"id": flag_id, "status": "pending"})
    if not flag:
        return fail("Pending moderation flag not found.", 404)
    if body.get("unpublishCourse"):
        if body["status"] != "resolved" or flag.get("target_type") != "course":
            return fail("Only resolving a course flag can unpublish its course.")
        changed = database.courses.update_one(
            {"id": flag["target_id"], "status": "published"},
            {"$set": {"status": "unpublished", "unpublished_at": now(), "updated_at": now()}},
        )
        if changed.matched_count != 1:
            return fail("Flagged course is not currently published.", 409)
    database.moderation_flags.update_one(
        {"id": flag_id, "status": "pending"},
        {"$set": {"status": body["status"], "resolved_at": now(), "resolved_by": g.user["id"]}},
    )
    audit_admin_action(
        database,
        "moderation_flag_resolved",
        flag.get("target_type", "unknown"),
        flag.get("target_id", ""),
        {"flag_id": flag_id, "status": body["status"], "unpublished_course": body.get("unpublishCourse", False)},
    )
    return jsonify({"ok": True})

@app.post("/api/learnhub/webhooks/razorpay")
def razorpay_webhook():
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    signature = request.headers.get("X-Razorpay-Signature", "")
    if not secret:
        return fail("Webhook is not configured.", 503)
    raw_body = request.get_data()
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    if not signature or not hmac.compare_digest(signature, expected):
        return fail("Invalid webhook signature.", 400)
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or not isinstance(body.get("id"), str) or not body["id"]:
        return fail("Webhook event id is required.", 400)
    database = db()
    event = {
        "id": uid(),
        "event_id": body["id"],
        "event_type": body.get("event", ""),
        "status": "processing",
        "created_at": now(),
    }
    try:
        database.webhook_events.insert_one(event)
    except DuplicateKeyError:
        return jsonify({"ok": True, "duplicate": True})

    try:
        event_type = body.get("event")
        payload = body.get("payload") or {}
        if event_type in ("payment.captured", "payment.failed"):
            payment_entity = (payload.get("payment") or {}).get("entity") or {}
            order_id = payment_entity.get("order_id")
            payment_id = payment_entity.get("id")
            if order_id and payment_id and event_type == "payment.captured":
                if not capture_payment(database, order_id, payment_id):
                    app.logger.error("Captured webhook did not match a pending LearnHub order.")
            elif order_id and payment_id:
                database.payments.update_one(
                    {"razorpay_order_id": order_id, "status": {"$in": ["created", "failed"]}},
                    {"$set": {"status": "failed", "razorpay_payment_id": payment_id, "updated_at": now()}},
                )
        elif event_type == "order.paid":
            order_entity = (payload.get("order") or {}).get("entity") or {}
            order_id = order_entity.get("id")
            client = razorpay_client()
            if order_id and client:
                order_payments = client.order.payments(order_id)
                captured = next(
                    (item for item in order_payments.get("items", []) if item.get("status") == "captured"),
                    None,
                )
                if captured:
                    capture_payment(database, order_id, captured["id"])
        elif event_type in ("subscription.charged", "subscription.cancelled"):
            subscription_entity = (payload.get("subscription") or {}).get("entity") or {}
            provider_id = subscription_entity.get("id")
            if provider_id:
                values = {"updated_at": now()}
                if event_type == "subscription.cancelled":
                    values["status"] = "cancelled"
                elif subscription_entity.get("current_end"):
                    values["status"] = "active"
                    values["ends_at"] = datetime.fromtimestamp(
                        int(subscription_entity["current_end"]), timezone.utc
                    ).isoformat()
                database.subscriptions.update_one(
                    {"razorpay_subscription_id": provider_id},
                    {"$set": values},
                )
        elif event_type == "refund.processed":
            refund_entity = (payload.get("refund") or {}).get("entity") or {}
            provider_payment_id = refund_entity.get("payment_id")
            payment = database.payments.find_one({"razorpay_payment_id": provider_payment_id})
            if payment:
                refund_amount = int(refund_entity.get("amount", 0) or 0)
                database.payments.update_one(
                    {"id": payment["id"]},
                    {
                        "$inc": {"refunded_amount_cents": refund_amount},
                        "$set": {
                            "razorpay_refund_id": refund_entity.get("id"),
                            "refunded_at": now(),
                            "updated_at": now(),
                        },
                    },
                )
                refreshed_payment = database.payments.find_one({"id": payment["id"]}) or payment
                full_refund = int(refreshed_payment.get("refunded_amount_cents", 0)) >= int(
                    payment.get("amount_cents", 0)
                )
                database.payments.update_one(
                    {"id": payment["id"]},
                    {"$set": {"status": "refunded" if full_refund else "partially_refunded"}},
                )
                if full_refund:
                    database.subscriptions.update_many(
                        {"payment_id": payment["id"], "status": "active"},
                        {"$set": {"status": "refunded", "updated_at": now()}},
                    )
                    database.revenue_shares.update_many(
                        {"payment_id": payment["id"], "status": "pending"},
                        {"$set": {"status": "void", "updated_at": now()}},
                    )
        database.webhook_events.update_one(
            {"event_id": body["id"]},
            {"$set": {"status": "processed", "processed_at": now()}},
        )
    except Exception:
        database.webhook_events.delete_one({"event_id": body["id"], "status": "processing"})
        app.logger.exception("Razorpay webhook processing failed.")
        return fail("Webhook event could not be processed.", 500)
    return jsonify({"ok": True})

@app.errorhandler(413)
def upload_too_large(error):
    return fail(f"Upload is too large. Maximum size is {upload_size_limit() // (1024 * 1024)} MB.", 413)

@app.errorhandler(500)
def server_error(error):
    cause = getattr(error, "original_exception", None)
    if isinstance(cause, RuntimeError) and "MONGODB_URI is required" in str(cause):
        return fail("MongoDB is not configured. Add MONGODB_URI to the workspace root .env file, then restart Flask.", 503)
    if isinstance(cause, RuntimeError) and "MONGODB_URI still has placeholders" in str(cause):
        return fail(str(cause), 503)
    if isinstance(cause, PyMongoError):
        app.logger.error("MongoDB operation failed: %s", cause)
        return fail("Could not connect to MongoDB Atlas. Check the database username and password, Atlas IP access list, and cluster status.", 503)
    app.logger.exception("Unhandled LearnHub API error", exc_info=cause or error)
    return fail("The server could not complete the request. Check the Flask terminal for details.", 500)


@app.route('/test-home')
def test_home_page():
    return "LearnHub Backend is Running!"


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
    )