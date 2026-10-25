# LearnHub Architecture

## Runtime layout

- `apps/web`: Next.js frontend.
- `backend/app.py`: Python Flask API and server-side authentication.
- MongoDB Atlas: LearnHub application data.

The frontend rewrites `/api/*` requests to Flask. API and database logic lives in Python.

## Main collections

`profiles`, `courses`, `categories`, `modules`, `lessons`, `lesson_resources`, `tests`, `questions`, `enrollments`, `lesson_progress`, `test_attempts`, `subscriptions`, `plans`, `payments`, `payment_events`, `certificates`, `reviews`, `notifications`, and `moderation_flags`.

## Security

- Passwords are hashed with Werkzeug; sessions use signed, HttpOnly JWT cookies.
- API authorization reads the role from each MongoDB user record.
- The configured `ADMIN_EMAIL` is the only account eligible for admin routes.
- Atlas credentials and JWT secrets are server-only environment variables.

Use a separate Atlas database per environment. Flask needs `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`, and app-specific secrets. The Next.js deployment needs `FLASK_API_URL` pointing to Flask.
