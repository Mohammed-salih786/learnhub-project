# LearnHub Analytics Events

This document defines the initial event taxonomy for the web app and is aligned with the Phase 1 foundation work.

## Core event definitions

- `landing_view`
  - Trigger: landing page viewed
  - Properties: `source`, `device_type`, `utm_campaign`

- `plan_click`
  - Trigger: user clicks a pricing plan
  - Properties: `plan_key`, `plan_price`

- `design_view`
  - Trigger: design system page viewed
  - Properties: `theme`, `component_name`

- `course_search`
  - Trigger: search query is submitted
  - Properties: `query`, `category`, `results_count`

- `course_enroll_click`
  - Trigger: student begins enrollment flow
  - Properties: `course_id`, `plan_key`

- `lesson_start`
  - Trigger: learner opens a lesson video
  - Properties: `course_id`, `lesson_id`, `device_type`

- `lesson_complete`
  - Trigger: learner marks or reaches lesson completion
  - Properties: `course_id`, `lesson_id`, `completion_percent`

- `course_publish`
  - Trigger: instructor publishes a course
  - Properties: `course_id`, `modules_count`, `test_count`

- `support_ticket_created`
  - Trigger: support issue raised
  - Properties: `category`, `priority`

## Event logging guidance

- Event names must be consistent across the web app and future mobile usage.
- Event payloads must remain low-cardinality and purpose-built.
- PostHog captures analytics events for product growth and funnel analysis.
- Sentry records client and server errors separately from analytics events.
