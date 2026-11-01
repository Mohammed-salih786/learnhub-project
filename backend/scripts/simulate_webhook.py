import argparse
import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request
import uuid


def main():
    parser = argparse.ArgumentParser(description="Send a signed sample Razorpay webhook to LearnHub.")
    parser.add_argument("--url", default="http://127.0.0.1:5000/api/learnhub/webhooks/razorpay")
    parser.add_argument("--order-id", required=True, help="Existing LearnHub Razorpay order id")
    parser.add_argument("--payment-id", required=True, help="Test payment id to include in the signed event")
    parser.add_argument("--event", default="payment.captured", choices=("payment.captured", "payment.failed"))
    args = parser.parse_args()
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    if not secret:
        parser.error("Set RAZORPAY_WEBHOOK_SECRET in the environment before running this script.")

    payload = {
        "id": f"evt_sim_{uuid.uuid4().hex}",
        "event": args.event,
        "payload": {
            "payment": {
                "entity": {
                    "id": args.payment_id,
                    "order_id": args.order_id,
                    "status": "captured" if args.event == "payment.captured" else "failed",
                }
            }
        },
    }
    raw_body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    request = urllib.request.Request(
        args.url,
        data=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": signature,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            print(f"Webhook response: HTTP {response.status}")
            print(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        print(f"Webhook response: HTTP {error.code}")
        print(error.read().decode("utf-8"))
        raise SystemExit(1) from error
    except urllib.error.URLError as error:
        print(f"Could not reach webhook endpoint: {error.reason}")
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
