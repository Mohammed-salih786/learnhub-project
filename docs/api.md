# LearnHub API Notes

## Public endpoints

- GET /api/health
  - Returns service health and environment status.

- GET /api/categories
  - Returns all public categories.

- GET /api/courses
  - Returns published courses with filters and sorting.

## Auth endpoints

- POST /api/auth/otp/request
  - Accepts phone or email and returns OTP trigger state.

- POST /api/auth/otp/verify
  - Verifies OTP and creates or signs into the user session.

- POST /api/auth/role
  - Allows role selection only when the profile has no existing role.

## Student endpoints

- GET /api/student/courses
  - Returns learner enrollments, available catalog items, and progress status.

- GET /api/student/courses/:slug
  - Returns course details and remaining lessons for the signed-in learner.

- GET /api/student/lessons/:id
  - Enforces entitlement checks before playback URL issuance.

- POST /api/student/tests/:id/submit
  - Validates payload and grades the test server-side.

- GET /api/student/checkout
  - Returns active plan options and trial eligibility for upgrades.

## Instructor endpoints

- POST /api/instructor/courses
  - Creates a draft course for the signed-in instructor.

- PUT /api/instructor/courses/:id
  - Updates only the instructor-owned course.

- GET /api/instructor/courses/:id/studio
  - Returns learner, completion, and lesson status for the course studio.

- POST /api/instructor/lessons/:id/resources
  - Uploads notes or resources for the course.

- POST /api/instructor/lessons
  - Creates a lesson draft with metadata and preview access rules.

## Admin endpoints

- GET /api/admin/overview
  - Returns core KPIs, conversion, and operational metrics.

- GET /api/admin/moderation
  - Returns the moderation queue and severity classification for course reviews.

- POST /api/admin/moderation/:id/resolve
  - Approves or rejects a moderation flag.

- GET /api/admin/payouts
  - Returns instructor payout status, scheduled settlements, and review blockers.

- GET /api/admin/analytics
  - Returns revenue mix, retention trends, and policy health metrics.

## Security notes

- Playback URL generation happens only on the server.
- Role changes are restricted to first-login onboarding and are not editable later.
- Trial dates are stored in the database and cannot be updated by the user.
- All request payloads are validated with Zod before processing.
