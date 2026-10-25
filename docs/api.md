# Flask API reference

All endpoints are served by `backend/app.py` under `/api/learnhub/`. The Next.js frontend proxies its `/api/*` paths to this namespace.

- `GET /health`, `GET /categories`, `GET /courses`
- `POST /auth/password/register`, `POST /auth/password/login`, `POST /auth/logout`, `GET /auth/verify-role`, `POST /auth/role`
- `GET/PATCH /profile`
- `GET /student/courses`, `GET /student/courses/:slug`, `GET /student/lessons/:id`, `POST /student/progress`, `POST /student/tests/:id/submit`, `GET /student/checkout`, `POST /student/subscribe`, `GET/PATCH /student/notifications`, `GET/POST /student/certificate/:courseId`
- `GET/POST /instructor/courses`, `GET/PUT/PATCH/DELETE /instructor/courses/:id`, `GET /instructor/courses/:id/studio`, `POST /instructor/lessons`, `POST /instructor/lessons/:id/resources`, `POST /instructor/upload`
- `GET/POST/PATCH /admin/plans`, `GET /admin/overview`, `GET /admin/analytics`, `GET /admin/payouts`, `GET/POST /admin/moderation`, `PATCH /admin/moderation/:id/resolve`
- `POST /webhooks/razorpay`

LearnHub uses an HttpOnly JWT cookie. Admin routes require the account email to match `ADMIN_EMAIL`.
