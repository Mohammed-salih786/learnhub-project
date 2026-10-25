from __future__ import annotations

import os
import uuid
import hmac
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

import jwt
from bson import ObjectId
from dotenv import load_dotenv
from flask import Flask, jsonify, request, g, redirect, send_from_directory
from flask_cors import CORS
from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
app = Flask(__name__)
CORS(app, origins=[x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if x.strip()], supports_credentials=True)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024

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

def fail(message, status=400):
    return jsonify({"ok": False, "error": message}), status

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
        if not user or user.get("role") != claims.get("role"): return None
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

def with_course_refs(course):
    result = clean(course)
    instructor = db().profiles.find_one({"id": course.get("instructor_id")})
    category = db().categories.find_one({"id": course.get("category_id")})
    result["instructor"] = profile_public(instructor) if instructor else None
    if instructor:
        result["instructor"]["avatar_url"] = instructor.get("avatar_url")
    result["category"] = clean(category) if category else None
    modules = list(db().modules.find({"course_id": course.get("id")}).sort("sort_order", ASCENDING))
    for module in modules:
        module["lessons"] = [clean(x) for x in db().lessons.find({"module_id": module.get("id")}).sort("sort_order", ASCENDING)]
    result["modules"] = [clean(x) for x in modules]
    result["tests"] = [clean(x) for x in db().tests.find({"course_id": course.get("id")})]
    result["reviews"] = [clean(x) for x in db().reviews.find({"course_id": course.get("id")})]
    result["total_enrollments"] = [{"count": db().enrollments.count_documents({"course_id": course.get("id")})}]
    ratings = [x.get("rating", 0) for x in db().reviews.find({"course_id": course.get("id")}) if x.get("rating") is not None]
    result["avg_rating"] = [{"avg": sum(ratings) / len(ratings) if ratings else None}]
    result["review_count"] = [{"count": len(ratings)}]
    return result

def entitlement(user_id):
    profile = db().profiles.find_one({"id": user_id})
    sub = db().subscriptions.find_one({"user_id": user_id, "status": {"$in": ["active", "trial"]}}, sort=[("created_at", -1)])
    plan = db().plans.find_one({"id": sub.get("plan_id")}) if sub else None
    trial_end = profile.get("trial_ends_at") if profile else None
    active_trial = bool(sub and sub.get("status") == "trial" and trial_end and trial_end > now())
    active = bool(sub and sub.get("status") == "active" and (not sub.get("ends_at") or sub["ends_at"] > now()))
    return {"role": profile.get("role") if profile else "student", "hasActiveSubscription": active, "hasActiveTrial": active_trial,
            "freeCoursesConsumed": profile.get("free_course_count", 0) if profile else 0,
            "freeCourseLimit": int(os.getenv("TRIAL_FREE_COURSE_LIMIT", "2")), "planKey": plan.get("key") if plan else None}

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
    body = request.get_json(silent=True) or {}
    full_name, email, password = str(body.get("fullName") or "").strip(), str(body.get("email") or "").strip().lower(), str(body.get("password") or "")
    role = body.get("role", "student")
    if len(full_name) < 2 or "@" not in email or len(password) < 8 or role not in ("student", "instructor"):
        return fail("Enter a name, valid email, and password with at least 8 characters.")
    database = db()
    if database.profiles.find_one({"email": email}): return fail("An account with that email already exists.", 409)
    user = {"id": uid(), "email": email, "full_name": full_name, "role": role, "password_hash": generate_password_hash(password), "free_course_count": 0, "trial_starts_at": now(), "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(), "created_at": now()}
    database.profiles.insert_one(user)
    trial = database.plans.find_one({"key": "trial"})
    if trial: database.subscriptions.insert_one({"id": uid(), "user_id": user["id"], "plan_id": trial["id"], "status": "trial", "starts_at": now(), "ends_at": user["trial_ends_at"], "created_at": now()})
    if role == "instructor": database.instructor_profiles.insert_one({"id": uid(), "user_id": user["id"], "bio": None, "headline": None, "verified_badge": False})
    response = jsonify({"ok": True, "user": profile_public(user)})
    response.set_cookie("learnhub_session", token_for(user), httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    response.set_cookie("learnhub_role", role, httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    return response, 201

@app.route("/api/learnhub/auth/password/login", methods=["POST"])
def login():
    body = request.get_json(silent=True) or {}; email = str(body.get("email") or "").strip().lower(); password = str(body.get("password") or "")
    user = db().profiles.find_one({"email": email})
    if not user or not user.get("password_hash") or not check_password_hash(user["password_hash"], password): return fail("Email or password is incorrect.", 401)
    if body.get("expectedRole") == "admin" and user.get("role") != "admin": return fail("These credentials do not belong to an administrator.", 403)
    response = jsonify({"ok": True, "user": profile_public(user)})
    response.set_cookie("learnhub_session", token_for(user), httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    response.set_cookie("learnhub_role", user["role"], httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    return response

@app.post("/api/learnhub/auth/admin/register")
def admin_register():
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
    body = request.get_json(silent=True) or {}; role = body.get("role")
    if role not in ("student", "instructor"): return fail("Unsupported account role.")
    if g.user.get("role") == "admin": return fail("Admin role cannot be changed here.", 403)
    db().profiles.update_one({"id": g.user["id"]}, {"$set": {"role": role}})
    if role == "instructor": db().instructor_profiles.update_one({"user_id": g.user["id"]}, {"$setOnInsert": {"id": uid(), "verified_badge": False}}, upsert=True)
    updated = db().profiles.find_one({"id": g.user["id"]}); response = jsonify({"ok": True, "user": profile_public(updated)})
    response.set_cookie("learnhub_session", token_for(updated), httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    response.set_cookie("learnhub_role", role, httponly=True, secure=request.is_secure, samesite="Lax", max_age=604800, path="/")
    return response

@app.get("/api/learnhub/profile")
@auth()
def get_profile():
    user = g.user; data = profile_public(user)
    if user.get("role") == "instructor": data["instructorProfile"] = clean(db().instructor_profiles.find_one({"user_id": user["id"]}))
    return jsonify({"ok": True, "profile": data})

@app.route("/api/learnhub/profile", methods=["PUT", "PATCH"])
@auth()
def put_profile():
    body = request.get_json(silent=True) or {}; fields = {target: body[source] for source, target in (("full_name", "full_name"), ("fullName", "full_name"), ("phone", "phone"), ("avatar_url", "avatar_url")) if source in body}
    db().profiles.update_one({"id": g.user["id"]}, {"$set": fields})
    if g.user.get("role") == "instructor": db().instructor_profiles.update_one({"user_id": g.user["id"]}, {"$set": {"bio": body.get("bio"), "headline": body.get("headline")}}, upsert=True)
    return jsonify({"ok": True, "profile": profile_public(db().profiles.find_one({"id": g.user["id"]}))})

@app.get("/api/learnhub/categories")
def categories(): return jsonify({"ok": True, "categories": [clean(x) for x in db().categories.find({}).sort("name", ASCENDING)]})

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
    item = db().courses.find_one({"slug": slug})
    if not item: return fail("Course not found.", 404)
    result = with_course_refs(item); user = current_user()
    if user:
        result["enrollment"] = clean(db().enrollments.find_one({"user_id": user["id"], "course_id": item["id"]}))
        result["entitlement"] = entitlement(user["id"])
    return jsonify({"ok": True, "course": result, "data": result})

@app.get("/api/learnhub/student/courses")
@auth("student")
def student_courses():
    user_id = g.user["id"]; enrollments = []
    for row in db().enrollments.find({"user_id": user_id}):
        course = by_id(db().courses, row.get("course_id")); progress = list(db().lesson_progress.find({"user_id": user_id}))
        row = clean(row); row["course"] = with_course_refs(course) if course else None; row["progress"] = [clean(p) for p in progress]; enrollments.append(row)
    catalog = [with_course_refs(x) for x in db().courses.find({"status": "published"}).sort("published_at", -1).limit(24)]
    return jsonify({"ok": True, "enrollments": enrollments, "catalog": catalog, "total": len(catalog)})

@app.get("/api/learnhub/student/lessons/<lesson_id>")
@auth("student")
def student_lesson(lesson_id):
    lesson = by_id(db().lessons, lesson_id)
    if not lesson: return fail("Lesson not found.", 404)
    course = by_id(db().courses, lesson.get("course_id")); lesson = clean(lesson); lesson["course"] = clean(course)
    progress = db().lesson_progress.find_one({"user_id": g.user["id"], "lesson_id": lesson_id})
    lesson["progress"] = clean(progress)
    if not lesson.get("preview") and not entitlement(g.user["id"])["hasActiveSubscription"] and not entitlement(g.user["id"])["hasActiveTrial"]:
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
    if not course: return fail("Course not found.", 404)
    existing = database.certificates.find_one({"course_id": course_id, "user_id": g.user["id"]})
    if existing: return jsonify({"ok": True, "certificate": clean(existing)})
    if request.method == "GET": return fail("Certificate not found.", 404)
    lesson_ids = [x["id"] for x in database.lessons.find({"course_id": course_id})]
    progress = list(database.lesson_progress.find({"user_id": g.user["id"], "lesson_id": {"$in": lesson_ids}}))
    if not lesson_ids or len([x for x in progress if x.get("completed")]) < len(lesson_ids): return fail("Complete the course before requesting a certificate.", 403)
    record = {"id": uid(), "course_id": course_id, "user_id": g.user["id"], "certificate_url": "", "generated_at": now()}
    database.certificates.insert_one(record); return jsonify({"ok": True, "certificate": clean(record)}), 201

@app.get("/api/learnhub/student/checkout")
@auth("student")
def checkout(): return jsonify({"ok": True, "entitlement": entitlement(g.user["id"]), "plans": [clean(x) for x in db().plans.find({"is_active": True}).sort("amount_cents", ASCENDING)]})

@app.post("/api/learnhub/student/subscribe")
@auth("student")
def subscribe():
    body = request.get_json(silent=True) or {}; plan = db().plans.find_one({"key": body.get("planKey")})
    if not plan: return fail("Plan not found.", 404)
    return jsonify({"ok": True, "message": "Configure Razorpay keys to enable online subscription checkout.", "plan": clean(plan), "checkoutEnabled": bool(os.getenv("RAZORPAY_KEY_ID") and os.getenv("RAZORPAY_KEY_SECRET"))})

@app.get("/api/learnhub/student/notifications")
@auth("student")
def notifications():
    rows = [clean(x) for x in db().notifications.find({"user_id": g.user["id"]}).sort("created_at", -1).limit(50)]
    return jsonify({"ok": True, "notifications": rows, "unreadCount": sum(not x.get("read_at") for x in rows)})

@app.patch("/api/learnhub/student/notifications")
@auth("student")
def update_notifications():
    body = request.get_json(silent=True) or {}; query = {"user_id": g.user["id"]}
    if body.get("ids"): query["id"] = {"$in": body["ids"]}
    elif not body.get("markAllRead"): return fail("ids or markAllRead is required.")
    else: query["read_at"] = None
    db().notifications.update_many(query, {"$set": {"read_at": now()}}); return jsonify({"ok": True})

@app.post("/api/learnhub/student/tests/<test_id>/submit")
@auth("student")
def submit_test(test_id):
    body = request.get_json(silent=True) or {}; test = by_id(db().tests, test_id)
    if not test: return fail("Test not found.", 404)
    questions = list(db().questions.find({"test_id": test_id})); answers = body.get("answers", {})
    score = sum(float(q.get("marks", 1)) for q in questions if answers.get(q.get("id")) == q.get("answer_key"))
    total = sum(float(q.get("marks", 1)) for q in questions) or 1; percent = score / total * 100
    attempt = {"id": uid(), "user_id": g.user["id"], "test_id": test_id, "score": score, "score_percent": percent, "passed": percent >= float(test.get("pass_percent", 60)), "submitted_at": now(), "attempts_count": 1}
    db().test_attempts.insert_one(attempt); return jsonify({"ok": True, "attempt": clean(attempt)})

@app.route("/api/learnhub/instructor/courses", methods=["GET", "POST"])
@auth("instructor")
def instructor_courses():
    database = db()
    if request.method == "GET": return jsonify({"ok": True, "data": [with_course_refs(x) for x in database.courses.find({"instructor_id": g.user["id"]}).sort("created_at", -1)]})
    body = request.get_json(silent=True) or {}; slug = body.get("slug") or "-".join(body.get("title", "").lower().split())
    if database.courses.find_one({"slug": slug}): return fail("A course with this slug already exists.", 409)
    category = database.categories.find_one({"name": body.get("category")})
    course = {"id": uid(), "instructor_id": g.user["id"], "category_id": category.get("id") if category else None, "title": body.get("title"), "slug": slug, "short_description": body.get("shortDescription"), "description": body.get("description"), "price_cents": body.get("priceCents", 0), "status": "draft", "created_at": now()}
    database.courses.insert_one(course); return jsonify({"ok": True, "course": clean(course)}), 201

@app.route("/api/learnhub/instructor/courses/<course_id>", methods=["GET", "PUT", "PATCH", "DELETE"])
@auth("instructor")
def instructor_course(course_id):
    database = db(); course = database.courses.find_one({"id": course_id, "instructor_id": g.user["id"]})
    if not course: return fail("Course not found.", 404)
    if request.method == "GET": return jsonify({"ok": True, "course": with_course_refs(course)})
    if request.method == "DELETE": database.courses.delete_one({"id": course_id}); return jsonify({"ok": True})
    values = request.get_json(silent=True) or {}; fields = {k: v for k, v in values.items() if k in ("title", "slug", "description", "short_description", "thumbnail_url", "price_cents", "status", "category_id")}; fields["updated_at"] = now()
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
    body = request.get_json(silent=True) or {}; course_id = body.get("courseId") or body.get("course_id")
    if not db().courses.find_one({"id": course_id, "instructor_id": g.user["id"]}): return fail("Course not found.", 404)
    lesson = {**body, "id": uid(), "course_id": course_id, "title": body.get("title", "Untitled lesson"), "created_at": now()}
    db().lessons.insert_one(lesson); return jsonify({"ok": True, "lesson": clean(lesson)}), 201

@app.post("/api/learnhub/instructor/lessons/<lesson_id>/resources")
@auth("instructor")
def create_lesson_resource(lesson_id):
    lesson = db().lessons.find_one({"id": lesson_id}); course = db().courses.find_one({"id": lesson.get("course_id"), "instructor_id": g.user["id"]}) if lesson else None
    if not course: return fail("Lesson not found.", 404)
    body = request.get_json(silent=True) or {}; resource = {**body, "id": uid(), "lesson_id": lesson_id, "created_at": now()}
    db().lesson_resources.insert_one(resource); return jsonify({"ok": True, "resource": clean(resource)}), 201

@app.post("/api/learnhub/instructor/upload")
@auth("instructor")
def upload():
    if "file" not in request.files: return fail("Select a file to upload.")
    file = request.files["file"]; filename = f"{uid()}-{Path(file.filename or 'upload').name}"
    target = Path(os.getenv("UPLOAD_FOLDER", "uploads")); target.mkdir(parents=True, exist_ok=True); file.save(target / filename)
    return jsonify({"ok": True, "url": f"/uploads/{filename}", "filename": filename})

@app.get("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(Path(os.getenv("UPLOAD_FOLDER", "uploads")), filename)

@app.get("/api/learnhub/admin/plans")
@auth("admin")
def admin_plans(): return jsonify({"ok": True, "plans": [clean(x) for x in db().plans.find({}).sort("amount_cents", 1)]})

@app.route("/api/learnhub/admin/plans", methods=["POST", "PUT", "PATCH"])
@auth("admin")
def save_plan():
    body = request.get_json(silent=True) or {}; key = body.get("key")
    if not key: return fail("Plan key is required.")
    db().plans.update_one({"key": key}, {"$set": {**body, "updated_at": now()}, "$setOnInsert": {"id": uid()}}, upsert=True)
    return jsonify({"ok": True, "plan": clean(db().plans.find_one({"key": key}))})

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
def payouts(): return jsonify({"ok": True, "payouts": [clean(x) for x in db().payments.find({"status": "captured"}).sort("created_at", -1).limit(500)]})

@app.route("/api/learnhub/admin/moderation", methods=["GET", "POST"])
@auth("admin")
def moderation():
    database = db()
    if request.method == "GET": return jsonify({"ok": True, "flags": [clean(x) for x in database.moderation_flags.find({}).sort("created_at", -1)]})
    body = request.get_json(silent=True) or {}; flag = {**body, "id": uid(), "status": "pending", "created_at": now()}; database.moderation_flags.insert_one(flag); return jsonify({"ok": True, "flag": clean(flag)}), 201

@app.patch("/api/learnhub/admin/moderation/<flag_id>/resolve")
@auth("admin")
def resolve_moderation(flag_id):
    body = request.get_json(silent=True) or {}; db().moderation_flags.update_one({"id": flag_id}, {"$set": {"status": body.get("status", "resolved"), "resolved_at": now(), "resolved_by": g.user["id"]}}); return jsonify({"ok": True})

@app.post("/api/learnhub/webhooks/razorpay")
def razorpay_webhook():
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", ""); signature = request.headers.get("X-Razorpay-Signature", "")
    if not secret or not signature: return fail("Webhook is not configured.", 503)
    import hmac, hashlib
    expected = hmac.new(secret.encode(), request.get_data(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected): return fail("Invalid webhook signature.", 401)
    body = request.get_json(silent=True) or {}; db().payment_events.update_one({"event_id": body.get("id")}, {"$setOnInsert": {"id": uid(), "event_id": body.get("id"), "payload": body, "created_at": now()}}, upsert=True)
    return jsonify({"ok": True})

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
