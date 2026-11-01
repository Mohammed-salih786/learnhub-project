import hashlib
import hmac
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from pymongo.errors import DuplicateKeyError

from backend import app as learnhub


class PaymentTests(unittest.TestCase):
    def setUp(self):
        self.client = learnhub.app.test_client()
        self.student = {"id": "student-1", "role": "student"}

    def _signed_post(self, payload, secret="webhook-secret"):
        raw = json.dumps(payload, separators=(",", ":")).encode()
        signature = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
        return self.client.post(
            "/api/learnhub/webhooks/razorpay",
            data=raw,
            content_type="application/json",
            headers={"X-Razorpay-Signature": signature},
        )

    def test_subscribe_uses_plan_amount_from_database(self):
        database = SimpleNamespace(plans=MagicMock(), payments=MagicMock())
        database.plans.find_one.return_value = {
            "id": "plan-1",
            "key": "monthly",
            "amount_cents": 14900,
            "currency": "INR",
            "is_active": True,
        }
        client = SimpleNamespace(order=SimpleNamespace(create=MagicMock(return_value={"id": "order-1"})))
        with patch.object(learnhub, "current_user", return_value=self.student), patch.object(
            learnhub, "db", return_value=database
        ), patch.object(learnhub, "razorpay_client", return_value=client), patch.dict(
            os.environ, {"RAZORPAY_KEY_ID": "public-key"}
        ):
            response = self.client.post(
                "/api/learnhub/student/subscribe", json={"planKey": "monthly"}
            )

        self.assertEqual(response.status_code, 201)
        order_data = client.order.create.call_args.args[0]
        self.assertEqual(order_data["amount"], 14900)
        self.assertEqual(response.get_json()["amount"], 14900)
        stored_payment = database.payments.insert_one.call_args.args[0]
        self.assertEqual(stored_payment["user_id"], self.student["id"])
        self.assertEqual(stored_payment["status"], "created")

    def test_expired_paid_subscription_does_not_grant_entitlement(self):
        database = SimpleNamespace(
            profiles=MagicMock(),
            subscriptions=MagicMock(),
            plans=MagicMock(),
        )
        database.profiles.find_one.return_value = {"id": self.student["id"], "role": "student"}
        database.subscriptions.find_one.return_value = {
            "user_id": self.student["id"],
            "plan_id": "plan-1",
            "status": "active",
            "ends_at": "2000-01-01T00:00:00+00:00",
        }
        database.plans.find_one.return_value = {"key": "monthly"}
        with patch.object(learnhub, "db", return_value=database):
            result = learnhub.entitlement(self.student["id"])
        self.assertFalse(result["hasActiveSubscription"])

    def test_payment_verification_checks_signature_and_owner(self):
        database = SimpleNamespace(payments=MagicMock())
        database.payments.find_one.return_value = {
            "id": "payment-1",
            "user_id": self.student["id"],
            "razorpay_order_id": "order-1",
            "status": "created",
        }
        signature = hmac.new(
            b"payment-secret", b"order-1|pay-1", hashlib.sha256
        ).hexdigest()
        payload = {
            "razorpay_order_id": "order-1",
            "razorpay_payment_id": "pay-1",
            "razorpay_signature": signature,
        }
        with patch.object(learnhub, "current_user", return_value=self.student), patch.object(
            learnhub, "db", return_value=database
        ), patch.dict(os.environ, {"RAZORPAY_KEY_SECRET": "payment-secret"}), patch.object(
            learnhub, "capture_payment", return_value=True
        ) as capture, patch.object(learnhub, "entitlement", return_value={"hasActiveSubscription": True}):
            response = self.client.post("/api/learnhub/student/payments/verify", json=payload)

        self.assertEqual(response.status_code, 200)
        capture.assert_called_once_with(database, "order-1", "pay-1")

    def test_payment_verification_rejects_invalid_or_tampered_signature(self):
        database = SimpleNamespace(payments=MagicMock())
        database.payments.find_one.return_value = {
            "id": "payment-1",
            "user_id": self.student["id"],
            "razorpay_order_id": "order-1",
            "status": "created",
        }
        valid_signature = hmac.new(
            b"payment-secret", b"order-1|pay-1", hashlib.sha256
        ).hexdigest()
        valid_payload = {
            "razorpay_order_id": "order-1",
            "razorpay_payment_id": "pay-1",
            "razorpay_signature": valid_signature,
        }
        tampered_payload = {**valid_payload, "razorpay_payment_id": "pay-2"}
        with patch.object(learnhub, "current_user", return_value=self.student), patch.object(
            learnhub, "db", return_value=database
        ), patch.dict(os.environ, {"RAZORPAY_KEY_SECRET": "payment-secret"}), patch.object(
            learnhub, "capture_payment"
        ) as capture:
            invalid = self.client.post(
                "/api/learnhub/student/payments/verify",
                json={**valid_payload, "razorpay_signature": "0" * 64},
            )
            tampered = self.client.post(
                "/api/learnhub/student/payments/verify", json=tampered_payload
            )

        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(tampered.status_code, 400)
        capture.assert_not_called()

    def test_payment_verification_does_not_allow_another_users_order(self):
        database = SimpleNamespace(payments=MagicMock())
        database.payments.find_one.return_value = None
        with patch.object(learnhub, "current_user", return_value=self.student), patch.object(
            learnhub, "db", return_value=database
        ):
            response = self.client.post(
                "/api/learnhub/student/payments/verify",
                json={
                    "razorpay_order_id": "foreign-order",
                    "razorpay_payment_id": "pay-1",
                    "razorpay_signature": "a" * 64,
                },
            )
        self.assertEqual(response.status_code, 404)

    def test_webhook_rejects_invalid_signature(self):
        with patch.dict(os.environ, {"RAZORPAY_WEBHOOK_SECRET": "webhook-secret"}):
            response = self.client.post(
                "/api/learnhub/webhooks/razorpay",
                json={"id": "evt-1", "event": "payment.captured"},
                headers={"X-Razorpay-Signature": "invalid"},
            )
        self.assertEqual(response.status_code, 400)

    def test_webhook_event_retry_is_idempotent(self):
        database = SimpleNamespace(webhook_events=MagicMock())
        database.webhook_events.insert_one.side_effect = DuplicateKeyError("duplicate")
        payload = {"id": "evt-1", "event": "payment.captured", "payload": {}}
        with patch.object(learnhub, "db", return_value=database), patch.dict(
            os.environ, {"RAZORPAY_WEBHOOK_SECRET": "webhook-secret"}
        ):
            response = self._signed_post(payload)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["duplicate"])
        database.webhook_events.update_one.assert_not_called()

    def test_valid_capture_webhook_is_processed_once(self):
        database = SimpleNamespace(webhook_events=MagicMock(), payments=MagicMock())
        payload = {
            "id": "evt-captured",
            "event": "payment.captured",
            "payload": {"payment": {"entity": {"id": "pay-1", "order_id": "order-1"}}},
        }
        with patch.object(learnhub, "db", return_value=database), patch.dict(
            os.environ, {"RAZORPAY_WEBHOOK_SECRET": "webhook-secret"}
        ), patch.object(learnhub, "capture_payment", return_value=True) as capture:
            response = self._signed_post(payload)

        self.assertEqual(response.status_code, 200)
        capture.assert_called_once_with(database, "order-1", "pay-1")
        database.webhook_events.update_one.assert_called_once()

    def test_capture_is_idempotent_after_subscription_is_created(self):
        payment = {
            "id": "payment-1",
            "type": "subscription",
            "status": "captured",
            "razorpay_order_id": "order-1",
            "razorpay_payment_id": "pay-1",
            "user_id": self.student["id"],
        }
        database = SimpleNamespace(
            payments=MagicMock(),
            subscriptions=MagicMock(),
            lesson_progress=MagicMock(),
            revenue_shares=MagicMock(),
        )
        database.payments.find_one.return_value = payment
        database.subscriptions.find_one.return_value = {"payment_id": payment["id"]}
        database.lesson_progress.find.return_value = []

        self.assertTrue(learnhub.capture_payment(database, "order-1", "pay-1"))
        self.assertTrue(learnhub.capture_payment(database, "order-1", "pay-1"))

        database.subscriptions.insert_one.assert_not_called()
        self.assertEqual(database.revenue_shares.update_one.call_count, 2)
        self.assertTrue(all(
            call.kwargs["upsert"]
            for call in database.revenue_shares.update_one.call_args_list
        ))

    def test_partial_refund_webhook_does_not_revoke_subscription(self):
        payment = {"id": "payment-1", "amount_cents": 10000, "razorpay_payment_id": "pay-1"}
        database = SimpleNamespace(
            webhook_events=MagicMock(),
            payments=MagicMock(),
            subscriptions=MagicMock(),
            revenue_shares=MagicMock(),
        )
        database.payments.find_one.side_effect = [
            payment,
            {**payment, "refunded_amount_cents": 2500},
        ]
        payload = {
            "id": "evt-partial-refund",
            "event": "refund.processed",
            "payload": {"refund": {"entity": {"id": "rfnd-1", "payment_id": "pay-1", "amount": 2500}}},
        }
        with patch.object(learnhub, "db", return_value=database), patch.dict(
            os.environ, {"RAZORPAY_WEBHOOK_SECRET": "webhook-secret"}
        ):
            response = self._signed_post(payload)

        self.assertEqual(response.status_code, 200)
        database.subscriptions.update_many.assert_not_called()
        database.revenue_shares.update_many.assert_not_called()

    def test_revenue_share_splits_instructor_pool_and_platform_remainder(self):
        database = SimpleNamespace(
            lesson_progress=MagicMock(),
            lessons=MagicMock(),
            courses=MagicMock(),
            revenue_shares=MagicMock(),
        )
        database.lesson_progress.find.return_value = [
            {"lesson_id": "lesson-1", "percent_complete": 100},
            {"lesson_id": "lesson-2", "percent_complete": 100},
        ]
        database.lessons.find_one.side_effect = [
            {"course_id": "course-1", "duration_seconds": 300},
            {"course_id": "course-2", "duration_seconds": 300},
        ]
        database.courses.find_one.side_effect = [
            {"instructor_id": "instructor-1"},
            {"instructor_id": "instructor-2"},
        ]

        learnhub.allocate_payment_revenue(
            database, {"id": "payment-1", "amount_cents": 10000}
        )

        allocations = {
            call.args[1]["$setOnInsert"]["instructor_id"]: call.args[1]["$setOnInsert"]["amount_cents"]
            for call in database.revenue_shares.update_one.call_args_list
        }
        self.assertEqual(allocations["instructor-1"], 3500)
        self.assertEqual(allocations["instructor-2"], 3500)
        self.assertEqual(allocations["platform"], 3000)


if __name__ == "__main__":
    unittest.main()
