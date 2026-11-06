# Great Lakes Institute of Professional Learning LMS

A Codespaces-ready university learning platform foundation for the Great Lakes Institute of Professional Learning. The current slice includes a responsive role-aware campus interface, an Express API, and SQLite-backed academic records.

## Run in Codespaces

```bash
npm install
npm install-scripts approve better-sqlite3 esbuild
npm run dev
```

Open the forwarded port **5173** for the web application. The API listens on port **3001** and is proxied through Vite at `/api`. The database is created and seeded at `data/lms.sqlite` on first run. Set `DATABASE_PATH` or `PORT` to override the defaults.

## Functional in this version

- Student, lecturer, and academic administrator dashboard previews.
- Programme and course catalogue, course details, module/material listings, and course search.
- Student course enrolment persisted in SQLite.
- Assignment visibility and submission are limited to the signed-in student's enrolled courses. Submissions persist in SQLite and can be revised before the deadline.
- Student workspace includes dashboard, enrolled courses, explicit course catalogue, course materials, lectures, weekly timetable, exams and assessments, assignments, published grades/feedback, announcements, and profile pages.
- Course progress is stored per student/module. Course materials only have open/download links when a resource URL is actually configured; current seed materials have no attached files.
- Lectures, timetable entries, assessments/results, and announcements are read from SQLite and scoped to enrolled courses. Empty states are shown when no records are scheduled or published.
- Facilitators can list and review submissions for courses assigned to their lecturer account, save grades and feedback as drafts, and publish or update results.
- Students see submission status and only published grades/feedback. Draft results are excluded by the API query.
- Grade changes record the lecturer, previous and new values/status, and timestamp in an audit table.
- Database-backed overview counts, health endpoint, and initial relational schema for users, programmes, courses, modules, materials, enrolments, assignments, submissions, and grades.

Run the grading and authorization integration test with `npm test`. It uses a temporary SQLite database and does not change `data/lms.sqlite`.

## Authentication and security status

The role selector creates an HTTP-only server session using seeded demo identities. The API enforces student, lecturer, submission ownership, and assigned-course permissions from that session; student IDs and lecturer IDs in request data do not determine access. The demo role-switch endpoint is disabled when `NODE_ENV=production`.

This is not production authentication. Local demo role switching allows impersonation, development sessions use Express's in-memory store, and no institutional identity provider or account login is integrated. Production startup requires `SESSION_SECRET`, but setting it does not add authentication; integrate the institution's identity provider and a persistent session store before using real student records. Existing `grades` records are preserved; new submission grades and history use additive SQLite tables. Existing course lecturer names are linked only when they match one lecturer account unambiguously; unlinked courses cannot be graded until an administrator maps them.

File upload/storage, online examination attempts, examination submissions, notifications, certificate workflows, and administrator CRUD pages remain future work. Assessments are schedule/details/results views only; an “Available” assessment does not start an online exam.

## Provisional decisions

- Stack: React 19, TypeScript, Vite, Express 5, and SQLite via `better-sqlite3`; selected as a low-friction initial Codespaces setup pending the research report.
- The product brief's “Great Lakes Institute of Professional Learning” name is used in the interface. The original README named the “Great Lakes Research Institute for Mental Health and Wellbeing Studies.” **[LUMS DECISION REQUIRED]** Confirm the institution's canonical name and scope before production branding.
- The Perplexity research report has not yet been supplied, so no research findings are represented as verified or used to select this stack.
