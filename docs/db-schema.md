# LearnHub Database Schema

## Entity relationship diagram

```mermaid
erDiagram
  profiles ||--o| instructor_profiles : owns
  profiles ||--o{ courses : teaches
  profiles ||--o{ enrollments : enrolls
  profiles ||--o{ lesson_progress : tracks
  profiles ||--o{ subscriptions : subscribes
  profiles ||--o{ payments : pays
  profiles ||--o{ certificates : receives

  categories ||--o{ courses : organizes
  courses ||--o{ modules : contains
  courses ||--o{ lessons : contains
  courses ||--o{ tests : has
  courses ||--o{ enrollments : has
  courses ||--o{ reviews : receives

  modules ||--o{ lessons : contains
  lessons ||--o{ lesson_resources : has
  tests ||--o{ questions : has
  tests ||--o{ test_attempts : records
  plans ||--o{ subscriptions : provides
  plans ||--o{ payments : defines
```

## Core tables

- profiles: base user record with role, trial dates, and access metadata.
- instructor_profiles: public instructor profile and verification state.
- courses: product catalog for published and draft content.
- modules: course curriculum grouping.
- lessons: actual learning content and preview/paid flags.
- tests and questions: grading and assessment model.
- enrollments and lesson_progress: learner activity tracking.
- subscriptions and payments: commerce and entitlement records.
- moderation_flags and admin_audit_log: governance and operational review.

## RLS principles

- Users can read and update only their own profile or subscription records.
- Instructors can only modify their own courses and lesson content.
- Students can read their own progress and enrollments.
- Admins can review moderation and audit logs.
- Course catalog reads remain public for published content.
