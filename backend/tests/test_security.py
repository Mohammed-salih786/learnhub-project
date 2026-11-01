import os
from io import BytesIO
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from backend import app as learnhub
from werkzeug.security import generate_password_hash


class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.client = learnhub.app.test_client()

    def test_sixth_wrong_login_in_fifteen_minutes_returns_retry_after(self):
        rate_limits = MagicMock()
        rate_limits.count_documents.side_effect = [0, 1, 2, 3, 4, 5]
        database = SimpleNamespace(profiles=MagicMock(), rate_limits=rate_limits)
        database.profiles.find_one.return_value = None
        with patch.object(learnhub, "db", return_value=database):
            responses = [self.client.post("/api/learnhub/auth/password/login", json={"email": "missing@example.com", "password": "wrong-password"}) for _ in range(6)]
        self.assertEqual([response.status_code for response in responses[:5]], [401] * 5)
        self.assertEqual(responses[5].status_code, 429)
        self.assertGreater(responses[5].get_json()["retry_after"], 0)

    def test_successful_login_resets_failed_attempt_counters(self):
        rate_limits = MagicMock()
        rate_limits.count_documents.return_value = 0
        user = {"id": "user-1", "email": "user@example.com", "role": "student", "password_hash": generate_password_hash("correct-password")}
        database = SimpleNamespace(profiles=MagicMock(), rate_limits=rate_limits)
        database.profiles.find_one.return_value = user
        with patch.object(learnhub, "db", return_value=database), patch.dict(os.environ, {"JWT_SECRET": "test-secret-with-at-least-thirty-two-chars"}):
            response = self.client.post("/api/learnhub/auth/password/login", json={"email": "user@example.com", "password": "correct-password"})
        self.assertEqual(response.status_code, 200)
        rate_limits.delete_many.assert_called_once()
    def test_role_transition_rejects_instructor_assignment(self):
        instructor = {"id": "instructor-1", "role": "instructor"}
        with patch.object(learnhub, "current_user", return_value=instructor):
            response = self.client.post("/api/learnhub/auth/role", json={"role": "instructor"})

        self.assertEqual(response.status_code, 403)
        self.assertIn("admin approval", response.get_json()["error"])

    def test_direct_instructor_registration_creates_pending_application(self):
        database = SimpleNamespace(
            profiles=MagicMock(),
            plans=MagicMock(),
            subscriptions=MagicMock(),
            instructor_profiles=MagicMock(),
            instructor_applications=MagicMock(),
            rate_limits=MagicMock(),
        )
        database.profiles.find_one.return_value = None
        database.plans.find_one.return_value = None
        database.rate_limits.count_documents.return_value = 0
        with patch.object(learnhub, "db", return_value=database), patch.dict(
            os.environ, {"JWT_SECRET": "test-secret-with-at-least-thirty-two-chars"}
        ):
            response = self.client.post(
                "/api/learnhub/auth/password/register",
                json={
                    "fullName": "Pending Instructor",
                    "email": "instructor@example.com",
                    "password": "secure-password",
                    "role": "instructor",
                    "bio": "I have taught product design for several years.",
                    "headline": "Product design instructor",
                    "sampleLink": "https://example.com/work",
                },
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["user"]["role"], "student")
        instructor_profile = database.instructor_profiles.insert_one.call_args.args[0]
        application = database.instructor_applications.insert_one.call_args.args[0]
        self.assertFalse(instructor_profile["verified_badge"])
        self.assertEqual(instructor_profile["status"], "pending")
        self.assertEqual(application["status"], "pending")
        self.assertEqual(application["sample_link"], "https://example.com/work")

    def test_pending_instructor_cannot_publish_course(self):
        database = SimpleNamespace(courses=MagicMock(), instructor_profiles=MagicMock())
        database.courses.find_one.return_value = {
            "id": "course-1",
            "instructor_id": "instructor-1",
            "status": "draft",
        }
        database.instructor_profiles.find_one.return_value = None
        instructor = {"id": "instructor-1", "role": "instructor"}
        with patch.object(learnhub, "current_user", return_value=instructor), patch.object(
            learnhub, "db", return_value=database
        ):
            response = self.client.patch(
                "/api/learnhub/instructor/courses/course-1", json={"status": "published"}
            )

        self.assertEqual(response.status_code, 403)
        database.courses.update_one.assert_not_called()

    def test_students_cannot_fetch_unpublished_course_or_lesson(self):
        database = SimpleNamespace(courses=MagicMock(), lessons=MagicMock())
        database.courses.find_one.return_value = None
        database.lessons.find_one.return_value = {
            "id": "lesson-1",
            "course_id": "course-1",
            "preview": True,
        }
        student = {"id": "student-1", "role": "student"}
        with patch.object(learnhub, "db", return_value=database):
            course_response = self.client.get("/api/learnhub/student/courses/draft-course")
        with patch.object(learnhub, "current_user", return_value=student), patch.object(
            learnhub, "db", return_value=database
        ):
            lesson_response = self.client.get("/api/learnhub/student/lessons/lesson-1")

        self.assertEqual(course_response.status_code, 404)
        self.assertEqual(lesson_response.status_code, 404)
        database.courses.find_one.assert_any_call({"slug": "draft-course", "status": "published"})
        database.courses.find_one.assert_any_call({"id": "course-1", "status": "published"})

    def test_instructor_cannot_add_resource_to_another_instructors_lesson(self):
        database = SimpleNamespace(
            lessons=MagicMock(),
            courses=MagicMock(),
            lesson_resources=MagicMock(),
        )
        database.lessons.find_one.return_value = {
            "id": "lesson-1",
            "course_id": "course-1",
        }
        database.courses.find_one.return_value = None
        instructor = {"id": "instructor-1", "role": "instructor"}
        with patch.object(learnhub, "current_user", return_value=instructor), patch.object(
            learnhub, "db", return_value=database
        ):
            response = self.client.post(
                "/api/learnhub/instructor/lessons/lesson-1/resources",
                json={"title": "Notes", "resourceType": "file", "url": "/uploads/notes.pdf"},
            )

        self.assertEqual(response.status_code, 404)
        database.lesson_resources.insert_one.assert_not_called()

    def test_archiving_enrolled_course_archives_dependent_records(self):
        collection_names = (
            "modules",
            "lessons",
            "lesson_resources",
            "lesson_progress",
            "tests",
            "questions",
            "test_attempts",
            "enrollments",
            "certificates",
            "reviews",
            "courses",
        )
        collections = {name: MagicMock() for name in collection_names}
        database = SimpleNamespace(**collections)
        database.enrollments.count_documents.return_value = 1
        for name in collection_names:
            getattr(database, name).find.return_value = []

        archived = learnhub.archive_or_delete_course(database, "course-1")

        self.assertTrue(archived)
        database.courses.update_one.assert_called_once()
        for name in collection_names[:-1]:
            getattr(database, name).update_many.assert_called_once()


    def test_mass_assignment_fields_are_rejected_by_write_schemas(self):
        for schema_name, payload in (
            ("course_update", {"status": "published", "instructor_id": "other"}),
            ("lesson_create", {"courseId": "course-1", "status": "published", "id": "forged"}),
            ("profile_update", {"role": "admin", "user_id": "other"}),
            ("plan_write", {"key": "monthly", "created_at": "forged"}),
            ("moderation_create", {"targetType": "course", "targetId": "course-1", "reason": "This report has enough detail.", "status": "resolved"}),
        ):
            with self.subTest(schema=schema_name):
                values, error = learnhub.validate_payload(payload, schema_name)
                self.assertIsNone(values)
                self.assertIn("Unknown field", error)
    def test_student_without_entitlement_cannot_fetch_paid_lesson_video(self):
        database = SimpleNamespace(lessons=MagicMock(), courses=MagicMock(), lesson_progress=MagicMock(), profiles=MagicMock(), subscriptions=MagicMock(), plans=MagicMock())
        database.lessons.find_one.return_value = {"id": "lesson-1", "course_id": "course-1", "is_paid": True, "video_url": "https://video.example/private", "content": "private lesson body"}
        database.courses.find_one.return_value = {"id": "course-1", "status": "published"}
        database.lesson_progress.find_one.return_value = None
        database.profiles.find_one.return_value = {"id": "student-1", "role": "student", "free_course_count": 2, "trial_ends_at": "2000-01-01T00:00:00+00:00"}
        database.subscriptions.find_one.return_value = None
        student = {"id": "student-1", "role": "student"}
        with patch.object(learnhub, "current_user", return_value=student), patch.object(learnhub, "db", return_value=database):
            response = self.client.get("/api/learnhub/student/lessons/lesson-1")
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("private", response.get_data(as_text=True))
    def test_course_payload_hides_locked_lesson_data_and_answer_keys(self):
        collection_names = ("profiles", "categories", "modules", "lessons", "tests", "reviews", "enrollments")
        database = SimpleNamespace(**{name: MagicMock() for name in collection_names})
        database.profiles.find_one.return_value = None
        database.categories.find_one.return_value = None
        database.modules.find.return_value.sort.return_value = [{"id": "module-1", "course_id": "course-1"}]
        database.lessons.find.return_value.sort.return_value = [{"id": "lesson-1", "is_paid": True, "video_url": "https://video.example/secret", "content": "secret lesson"}]
        database.tests.find.return_value = [{"id": "test-1", "questions": [{"id": "q1", "answer_key": "hidden"}]}]
        database.reviews.find.return_value = []
        course = {"id": "course-1", "instructor_id": "instructor-1"}
        with patch.object(learnhub, "db", return_value=database):
            result = learnhub.with_course_refs(course)
        lesson = result["modules"][0]["lessons"][0]
        self.assertNotIn("video_url", lesson)
        self.assertNotIn("content", lesson)
        self.assertTrue(lesson["locked"])
        self.assertNotIn("answer_key", str(result["tests"]))

    def test_certificate_requires_passing_course_tests(self):
        database = SimpleNamespace(courses=MagicMock(), certificates=MagicMock(), lessons=MagicMock(), lesson_progress=MagicMock(), tests=MagicMock(), test_attempts=MagicMock(), profiles=MagicMock(), subscriptions=MagicMock(), plans=MagicMock())
        database.courses.find_one.return_value = {"id": "course-1", "status": "published"}
        database.certificates.find_one.return_value = None
        database.lessons.find.return_value = [{"id": "lesson-1"}]
        database.lesson_progress.find.return_value = [{"lesson_id": "lesson-1", "completed": True}]
        database.profiles.find_one.return_value = {"id": "student-1", "role": "student", "free_course_count": 0}
        database.subscriptions.find_one.side_effect = [
            {"id": "sub-1", "plan_id": "plan-1", "status": "active", "ends_at": "2999-01-01T00:00:00+00:00"}, None,
        ]
        database.plans.find_one.return_value = {"key": "monthly"}
        database.tests.find.return_value = [{"id": "test-1", "course_id": "course-1"}]
        database.test_attempts.find_one.return_value = None
        student = {"id": "student-1", "role": "student"}
        with patch.object(learnhub, "current_user", return_value=student), patch.object(learnhub, "db", return_value=database):
            response = self.client.post("/api/learnhub/student/certificate/course-1")
        self.assertEqual(response.status_code, 403)
        database.certificates.insert_one.assert_not_called()
    def test_upload_rejects_unsupported_and_mismatched_types(self):
        instructor = {"id": "instructor-1", "role": "instructor"}
        with patch.object(learnhub, "current_user", return_value=instructor):
            unsupported = self.client.post("/api/learnhub/instructor/upload", data={"file": (BytesIO(b"bad"), "virus.exe", "application/octet-stream")})
            mismatch = self.client.post("/api/learnhub/instructor/upload", data={"file": (BytesIO(b"not a png"), "image.png", "text/plain")})
        self.assertEqual(unsupported.status_code, 415)
        self.assertEqual(mismatch.status_code, 415)

    def test_upload_rejects_files_over_configured_limit(self):
        instructor = {"id": "instructor-1", "role": "instructor"}
        with patch.object(learnhub, "current_user", return_value=instructor), patch.object(learnhub, "upload_size_limit", return_value=3):
            response = self.client.post("/api/learnhub/instructor/upload", data={"file": (BytesIO(b"1234"), "notes.pdf", "application/pdf")})
        self.assertEqual(response.status_code, 413)
        self.assertIn("too large", response.get_json()["error"])
    def test_answer_keys_are_removed_recursively(self):
        safe = learnhub.strip_answer_keys({"questions": [{"id": "q1", "answer_key": "a", "choices": [{"answer_key": "nested"}]}]})
        self.assertEqual(safe, {"questions": [{"id": "q1", "choices": [{}]}]})

    def test_test_submission_requires_course_entitlement(self):
        database = SimpleNamespace(
            tests=MagicMock(), courses=MagicMock(), profiles=MagicMock(),
            subscriptions=MagicMock(), plans=MagicMock(), test_attempts=MagicMock(), questions=MagicMock(),
        )
        database.tests.find_one.return_value = {"id": "test-1", "course_id": "course-1"}
        database.courses.find_one.return_value = {"id": "course-1", "status": "published"}
        database.profiles.find_one.return_value = {"id": "student-1", "role": "student", "free_course_count": 2, "trial_ends_at": "2000-01-01T00:00:00+00:00"}
        database.subscriptions.find_one.return_value = None
        student = {"id": "student-1", "role": "student"}
        with patch.object(learnhub, "current_user", return_value=student), patch.object(learnhub, "db", return_value=database):
            response = self.client.post("/api/learnhub/student/tests/test-1/submit", json={"answers": {"q1": "a"}})
        self.assertEqual(response.status_code, 403)
        database.test_attempts.insert_one.assert_not_called()

    def test_test_submission_caps_attempts_and_uses_actual_count(self):
        database = SimpleNamespace(
            tests=MagicMock(), courses=MagicMock(), profiles=MagicMock(),
            subscriptions=MagicMock(), plans=MagicMock(), test_attempts=MagicMock(), questions=MagicMock(),
        )
        database.tests.find_one.return_value = {"id": "test-1", "course_id": "course-1", "max_attempts": 3}
        database.courses.find_one.return_value = {"id": "course-1", "status": "published"}
        database.profiles.find_one.return_value = {"id": "student-1", "role": "student", "free_course_count": 0}
        database.subscriptions.find_one.side_effect = [
            {"id": "sub-1", "plan_id": "plan-1", "status": "active", "ends_at": "2999-01-01T00:00:00+00:00"},
            None,
        ]
        database.plans.find_one.return_value = {"key": "monthly"}
        database.test_attempts.count_documents.return_value = 2
        database.questions.find.return_value = [{"id": "q1", "marks": 1, "answer_key": "a"}]
        student = {"id": "student-1", "role": "student"}
        with patch.object(learnhub, "current_user", return_value=student), patch.object(learnhub, "db", return_value=database):
            response = self.client.post("/api/learnhub/student/tests/test-1/submit", json={"answers": {"q1": "a", "unknown": "a"}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["attempt"]["attempts_count"], 3)
        database.test_attempts.count_documents.assert_called_once_with({"user_id": "student-1", "test_id": "test-1"})

    def test_test_submission_rejects_fourth_attempt(self):
        database = SimpleNamespace(
            tests=MagicMock(), courses=MagicMock(), profiles=MagicMock(),
            subscriptions=MagicMock(), plans=MagicMock(), test_attempts=MagicMock(), questions=MagicMock(),
        )
        database.tests.find_one.return_value = {"id": "test-1", "course_id": "course-1"}
        database.courses.find_one.return_value = {"id": "course-1", "status": "published"}
        database.profiles.find_one.return_value = {"id": "student-1", "role": "student", "free_course_count": 0}
        database.subscriptions.find_one.side_effect = [
            {"id": "sub-1", "plan_id": "plan-1", "status": "active", "ends_at": "2999-01-01T00:00:00+00:00"},
            None,
        ]
        database.plans.find_one.return_value = {"key": "monthly"}
        database.test_attempts.count_documents.return_value = 3
        student = {"id": "student-1", "role": "student"}
        with patch.object(learnhub, "current_user", return_value=student), patch.object(learnhub, "db", return_value=database):
            response = self.client.post("/api/learnhub/student/tests/test-1/submit", json={"answers": {}})
        self.assertEqual(response.status_code, 429)
        database.test_attempts.insert_one.assert_not_called()
class CourseApprovalTests(unittest.TestCase):
    def setUp(self):
        self.client = learnhub.app.test_client()
        self.instructor = {"id": "instructor-1", "role": "instructor"}
        self.admin = {"id": "admin-1", "role": "admin"}

    def test_submit_for_review_requires_title_description_price_and_lesson(self):
        complete_course = {
            "id": "course-1",
            "instructor_id": self.instructor["id"],
            "title": "Product design",
            "description": "A complete course description.",
            "price_cents": 0,
            "status": "draft",
        }
        cases = (
            ({"title": ""}, {"id": "lesson-1"}, "course title"),
            ({"description": " "}, {"id": "lesson-1"}, "course description"),
            ({"price_cents": None}, {"id": "lesson-1"}, "course price"),
            ({}, None, "at least one lesson"),
        )
        for overrides, lesson, expected_message in cases:
            with self.subTest(expected_message=expected_message):
                course = {**complete_course, **overrides}
                if "price_cents" in overrides and overrides["price_cents"] is None:
                    course.pop("price_cents", None)
                database = SimpleNamespace(courses=MagicMock(), lessons=MagicMock())
                database.courses.find_one.return_value = course
                database.lessons.find_one.return_value = lesson
                with patch.object(learnhub, "current_user", return_value=self.instructor), patch.object(
                    learnhub, "db", return_value=database
                ):
                    response = self.client.patch(
                        "/api/learnhub/instructor/courses/course-1",
                        json={"status": "pending_review"},
                    )

                self.assertEqual(response.status_code, 400)
                self.assertIn(expected_message, response.get_json()["error"])
                database.courses.update_one.assert_not_called()

    def test_submit_for_review_updates_status_and_clears_old_rejection(self):
        course = {
            "id": "course-1",
            "instructor_id": self.instructor["id"],
            "title": "Product design",
            "description": "A complete course description.",
            "price_cents": 0,
            "status": "rejected",
            "rejection_reason": "Add another lesson.",
        }
        database = SimpleNamespace(courses=MagicMock(), lessons=MagicMock())
        database.courses.find_one.return_value = course
        database.lessons.find_one.return_value = {"id": "lesson-1"}
        with patch.object(learnhub, "current_user", return_value=self.instructor), patch.object(
            learnhub, "db", return_value=database
        ):
            response = self.client.patch(
                "/api/learnhub/instructor/courses/course-1",
                json={"status": "pending_review"},
            )

        self.assertEqual(response.status_code, 200)
        update = database.courses.update_one.call_args.args[1]
        self.assertEqual(update["$set"]["status"], "pending_review")
        self.assertIn("rejection_reason", update["$unset"])

    def test_instructor_cannot_publish_course_directly(self):
        database = SimpleNamespace(courses=MagicMock())
        database.courses.find_one.return_value = {
            "id": "course-1",
            "instructor_id": self.instructor["id"],
            "status": "draft",
        }
        with patch.object(learnhub, "current_user", return_value=self.instructor), patch.object(
            learnhub, "db", return_value=database
        ):
            response = self.client.patch(
                "/api/learnhub/instructor/courses/course-1",
                json={"status": "published"},
            )

        self.assertEqual(response.status_code, 403)
        database.courses.update_one.assert_not_called()

    def test_admin_approval_publishes_and_notifies_instructor(self):
        course = {
            "id": "course-1",
            "instructor_id": self.instructor["id"],
            "title": "Product design",
            "status": "pending_review",
        }
        database = SimpleNamespace(
            courses=MagicMock(),
            profiles=MagicMock(),
            notifications=MagicMock(),
            audit_logs=MagicMock(),
        )
        database.courses.find_one.return_value = course
        database.courses.update_one.return_value = SimpleNamespace(modified_count=1)
        database.profiles.find_one.return_value = {
            "id": self.instructor["id"],
            "email": "teacher@example.com",
            "role": "instructor",
        }
        with patch.object(learnhub, "current_user", return_value=self.admin), patch.object(
            learnhub, "db", return_value=database
        ), patch.dict(os.environ, {"SMTP_HOST": "", "EMAIL_FROM": ""}):
            response = self.client.post("/api/learnhub/admin/courses/course-1/approve")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["course"]["status"], "published")
        self.assertEqual(database.courses.update_one.call_args.args[0]["status"], "pending_review")
        self.assertEqual(database.notifications.insert_one.call_args.args[0]["type"], "course_approved")

    def test_admin_rejection_requires_reason_and_saves_notification(self):
        course = {
            "id": "course-1",
            "instructor_id": self.instructor["id"],
            "title": "Product design",
            "status": "pending_review",
        }
        database = SimpleNamespace(
            courses=MagicMock(),
            profiles=MagicMock(),
            notifications=MagicMock(),
            audit_logs=MagicMock(),
        )
        database.courses.find_one.return_value = course
        database.courses.update_one.return_value = SimpleNamespace(modified_count=1)
        database.profiles.find_one.return_value = {
            "id": self.instructor["id"],
            "email": "teacher@example.com",
            "role": "instructor",
        }
        with patch.object(learnhub, "current_user", return_value=self.admin), patch.object(
            learnhub, "db", return_value=database
        ), patch.dict(os.environ, {"SMTP_HOST": "", "EMAIL_FROM": ""}):
            missing_reason = self.client.post(
                "/api/learnhub/admin/courses/course-1/reject", json={}
            )
            response = self.client.post(
                "/api/learnhub/admin/courses/course-1/reject",
                json={"reason": "Please include a clear course outline."},
            )

        self.assertEqual(missing_reason.status_code, 400)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["course"]["status"], "rejected")
        self.assertEqual(database.courses.update_one.call_args.args[1]["$set"]["rejection_reason"], "Please include a clear course outline.")
        self.assertEqual(database.notifications.insert_one.call_args.args[0]["type"], "course_rejected")

    def test_admin_course_filter_rejects_unsupported_status(self):
        database = SimpleNamespace(courses=MagicMock(), profiles=MagicMock())
        with patch.object(learnhub, "current_user", return_value=self.admin), patch.object(
            learnhub, "db", return_value=database
        ):
            response = self.client.get("/api/learnhub/admin/courses?status=unknown")

        self.assertEqual(response.status_code, 400)
        database.courses.find.assert_not_called()


class AdminFeatureTests(unittest.TestCase):
    def setUp(self):
        self.client = learnhub.app.test_client()
        self.admin = {"id": "admin-1", "role": "admin", "email": "admin@example.com"}

    def test_suspended_user_cannot_log_in_or_use_existing_jwt(self):
        user = {
            "id": "user-1",
            "role": "student",
            "email": "user@example.com",
            "status": "suspended",
            "password_hash": generate_password_hash("password-long"),
        }
        database = SimpleNamespace(profiles=MagicMock(), rate_limits=MagicMock())
        database.profiles.find_one.return_value = user
        database.rate_limits.count_documents.return_value = 0
        with patch.object(learnhub, "db", return_value=database), patch.dict(
            os.environ, {"JWT_SECRET": "test-secret-with-at-least-thirty-two-chars"}
        ):
            token = learnhub.token_for(user)
            login = self.client.post(
                "/api/learnhub/auth/password/login",
                json={"email": "user@example.com", "password": "password-long"},
            )
            with self.client as client:
                client.set_cookie("learnhub_session", token)
                profile = client.get("/api/learnhub/profile")

        self.assertEqual(login.status_code, 403)
        self.assertEqual(profile.status_code, 401)

    def test_admin_cannot_suspend_themselves_or_last_admin(self):
        database = SimpleNamespace(profiles=MagicMock(), audit_logs=MagicMock())
        database.profiles.find_one.side_effect = [
            self.admin,
            {"id": "admin-2", "role": "admin", "status": "active"},
        ]
        database.profiles.count_documents.return_value = 1
        with patch.object(learnhub, "current_user", return_value=self.admin), patch.object(
            learnhub, "db", return_value=database
        ):
            self_suspend = self.client.post("/api/learnhub/admin/users/admin-1/suspend", json={})
            final_admin = self.client.post("/api/learnhub/admin/users/admin-2/suspend", json={})

        self.assertEqual(self_suspend.status_code, 403)
        self.assertEqual(final_admin.status_code, 409)
        database.profiles.update_one.assert_not_called()
        database.audit_logs.insert_one.assert_not_called()

    def test_suspend_action_updates_status_and_writes_audit_log(self):
        database = SimpleNamespace(profiles=MagicMock(), audit_logs=MagicMock())
        database.profiles.find_one.side_effect = [
            {"id": "user-1", "role": "student", "email": "student@example.com"},
            {"id": "user-1", "role": "student", "email": "student@example.com", "status": "suspended"},
        ]
        with patch.object(learnhub, "current_user", return_value=self.admin), patch.object(
            learnhub, "db", return_value=database
        ):
            response = self.client.post(
                "/api/learnhub/admin/users/user-1/suspend",
                json={"reason": "Repeated abuse reports."},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(database.profiles.update_one.call_args.args[1]["$set"]["status"], "suspended")
        audit = database.audit_logs.insert_one.call_args.args[0]
        self.assertEqual(audit["actor_id"], self.admin["id"])
        self.assertEqual(audit["action"], "user_suspended")
        self.assertEqual(audit["meta"]["reason"], "Repeated abuse reports.")

    def test_instructor_approval_sets_role_badge_and_notification(self):
        application = {
            "id": "application-1",
            "user_id": "teacher-1",
            "status": "pending",
            "bio": "Experienced teacher.",
            "headline": "Design educator",
        }
        database = SimpleNamespace(
            instructor_applications=MagicMock(),
            rate_limits=MagicMock(),
            profiles=MagicMock(),
            instructor_profiles=MagicMock(),
            notifications=MagicMock(),
            audit_logs=MagicMock(),
        )
        database.instructor_applications.find_one.return_value = application
        database.instructor_applications.update_one.return_value = SimpleNamespace(modified_count=1)
        with patch.object(learnhub, "current_user", return_value=self.admin), patch.object(
            learnhub, "db", return_value=database
        ):
            response = self.client.post(
                "/api/learnhub/admin/instructor-applications/application-1/approve"
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(database.profiles.update_one.call_args.args[1]["$set"]["role"], "instructor")
        profile_update = database.instructor_profiles.update_one.call_args.args[1]["$set"]
        self.assertFalse(profile_update["verified_badge"])
        self.assertEqual(profile_update["status"], "approved")
        self.assertEqual(database.notifications.insert_one.call_args.args[0]["user_id"], "teacher-1")
        self.assertEqual(database.audit_logs.insert_one.call_args.args[0]["action"], "instructor_application_approved")

    def test_category_delete_is_blocked_if_courses_reference_it(self):
        database = SimpleNamespace(categories=MagicMock(), courses=MagicMock())
        database.categories.find_one.return_value = {"id": "category-1", "slug": "design"}
        database.courses.count_documents.return_value = 2
        with patch.object(learnhub, "current_user", return_value=self.admin), patch.object(
            learnhub, "db", return_value=database
        ):
            response = self.client.delete("/api/learnhub/admin/categories/category-1")

        self.assertEqual(response.status_code, 409)
        database.categories.delete_one.assert_not_called()

    def test_moderation_can_unpublish_linked_published_course(self):
        flag = {
            "id": "flag-1",
            "target_type": "course",
            "target_id": "course-1",
            "status": "pending",
        }
        database = SimpleNamespace(
            moderation_flags=MagicMock(),
            courses=MagicMock(),
            audit_logs=MagicMock(),
        )
        database.moderation_flags.find_one.return_value = flag
        database.courses.update_one.return_value = SimpleNamespace(matched_count=1)
        with patch.object(learnhub, "current_user", return_value=self.admin), patch.object(
            learnhub, "db", return_value=database
        ):
            response = self.client.patch(
                "/api/learnhub/admin/moderation/flag-1/resolve",
                json={"status": "resolved", "unpublishCourse": True},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(database.courses.update_one.call_args.args[0], {"id": "course-1", "status": "published"})
        self.assertEqual(database.audit_logs.insert_one.call_args.args[0]["action"], "moderation_flag_resolved")

    def test_user_listing_filters_and_paginates(self):
        database = SimpleNamespace(profiles=MagicMock())
        database.profiles.find.return_value.sort.return_value.skip.return_value.limit.return_value = [
            {"id": "user-2", "email": "second@example.com", "role": "student", "status": "active"}
        ]
        database.profiles.count_documents.return_value = 31
        with patch.object(learnhub, "current_user", return_value=self.admin), patch.object(
            learnhub, "db", return_value=database
        ):
            response = self.client.get(
                "/api/learnhub/admin/users?page=2&limit=10&role=student&status=active&search=second"
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["page"], 2)
        self.assertEqual(response.get_json()["total"], 31)
        query = database.profiles.find.call_args.args[0]
        self.assertEqual(query["role"], "student")
        self.assertEqual(query["$and"][0]["$or"][0]["status"], "active")
        self.assertEqual(database.profiles.find.return_value.sort.return_value.skip.call_args.args[0], 10)

    def test_category_create_rejects_unknown_fields_and_records_audit(self):
        database = SimpleNamespace(categories=MagicMock(), audit_logs=MagicMock())
        database.categories.find_one.return_value = None
        with patch.object(learnhub, "current_user", return_value=self.admin), patch.object(
            learnhub, "db", return_value=database
        ):
            invalid = self.client.post(
                "/api/learnhub/admin/categories",
                json={"name": "Design", "slug": "design", "id": "forged"},
            )
            response = self.client.post(
                "/api/learnhub/admin/categories",
                json={"name": "Design", "slug": "design", "sort_order": 3},
            )

        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["category"]["sort_order"], 3)
        self.assertEqual(database.audit_logs.insert_one.call_args.args[0]["action"], "category_created")

    def test_instructor_verification_updates_badge_and_audit(self):
        database = SimpleNamespace(profiles=MagicMock(), instructor_profiles=MagicMock(), audit_logs=MagicMock())
        database.profiles.find_one.return_value = {"id": "teacher-1", "role": "instructor"}
        with patch.object(learnhub, "current_user", return_value=self.admin), patch.object(
            learnhub, "db", return_value=database
        ):
            response = self.client.patch(
                "/api/learnhub/admin/instructors/teacher-1/verification",
                json={"verified_badge": False},
            )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(database.instructor_profiles.update_one.call_args.args[1]["$set"]["verified_badge"])
        self.assertEqual(database.audit_logs.insert_one.call_args.args[0]["action"], "instructor_verification_updated")


if __name__ == "__main__":
    unittest.main()
