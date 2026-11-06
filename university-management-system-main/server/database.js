import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databasePath = resolve(process.env.DATABASE_PATH ?? "data/lms.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('student', 'lecturer', 'admin')),
    student_number TEXT UNIQUE
  );
  CREATE TABLE IF NOT EXISTS programmes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    award TEXT NOT NULL,
    duration TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    programme_id TEXT NOT NULL REFERENCES programmes(id),
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    lecturer TEXT NOT NULL,
    lecturer_id TEXT REFERENCES users(id),
    term TEXT NOT NULL,
    credits INTEGER NOT NULL,
    description TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    duration TEXT,
    description TEXT NOT NULL DEFAULT '',
    file_name TEXT,
    mime_type TEXT,
    resource_url TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    created_by TEXT REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL REFERENCES users(id),
    course_id TEXT NOT NULL REFERENCES courses(id),
    enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
  );
  CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date TEXT NOT NULL,
    points INTEGER NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_by TEXT REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id TEXT NOT NULL REFERENCES assignments(id),
    student_id TEXT NOT NULL REFERENCES users(id),
    response TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assignment_id, student_id)
  );
  CREATE TABLE IF NOT EXISTS submission_grades (
    submission_id INTEGER PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
    score REAL NOT NULL CHECK (score >= 0),
    feedback TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
    graded_by TEXT NOT NULL REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TEXT
  );
  CREATE TABLE IF NOT EXISTS grade_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    changed_by TEXT NOT NULL REFERENCES users(id),
    previous_score REAL,
    new_score REAL NOT NULL,
    previous_feedback TEXT,
    new_feedback TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL CHECK (new_status IN ('draft', 'published')),
    changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL REFERENCES users(id),
    course_id TEXT NOT NULL REFERENCES courses(id),
    assessment TEXT NOT NULL,
    score REAL NOT NULL,
    max_score REAL NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    feedback TEXT NOT NULL DEFAULT '',
    published_at TEXT,
    graded_by TEXT REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS module_progress (
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, module_id)
  );
  CREATE TABLE IF NOT EXISTS lectures (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_id TEXT REFERENCES modules(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    facilitator TEXT,
    description TEXT NOT NULL DEFAULT '',
    location TEXT,
    meeting_url TEXT,
    recording_url TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled')),
    created_by TEXT REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_id TEXT REFERENCES modules(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    assessment_type TEXT NOT NULL CHECK (assessment_type IN ('examination', 'quiz', 'coursework', 'test', 'practical')),
    instructions TEXT NOT NULL DEFAULT '',
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    max_score REAL CHECK (max_score IS NULL OR max_score > 0),
    location TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled')),
    created_by TEXT REFERENCES users(id),
    CHECK (ends_at > starts_at)
  );
  CREATE TABLE IF NOT EXISTS assessment_results (
    assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score REAL NOT NULL CHECK (score >= 0),
    max_score REAL NOT NULL CHECK (max_score > 0 AND score <= max_score),
    feedback TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
    graded_by TEXT NOT NULL REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TEXT,
    PRIMARY KEY (assessment_id, student_id)
  );
  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    created_by TEXT REFERENCES users(id)
  );
`);

function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing("users", "student_number", "TEXT");
addColumnIfMissing("materials", "file_name", "TEXT");
addColumnIfMissing("materials", "mime_type", "TEXT");
addColumnIfMissing("materials", "resource_url", "TEXT");
addColumnIfMissing("materials", "description", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("materials", "status", "TEXT NOT NULL DEFAULT 'published'");
addColumnIfMissing("materials", "created_by", "TEXT REFERENCES users(id)");
addColumnIfMissing("assignments", "instructions", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("assignments", "created_by", "TEXT REFERENCES users(id)");
addColumnIfMissing("lectures", "module_id", "TEXT REFERENCES modules(id) ON DELETE SET NULL");
addColumnIfMissing("lectures", "created_by", "TEXT REFERENCES users(id)");
addColumnIfMissing("assessments", "module_id", "TEXT REFERENCES modules(id) ON DELETE SET NULL");
addColumnIfMissing("assessments", "max_score", "REAL");
addColumnIfMissing("assessments", "created_by", "TEXT REFERENCES users(id)");
addColumnIfMissing("announcements", "created_by", "TEXT REFERENCES users(id)");
addColumnIfMissing("grades", "status", "TEXT NOT NULL DEFAULT 'draft'");
addColumnIfMissing("grades", "feedback", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("grades", "published_at", "TEXT");
addColumnIfMissing("grades", "graded_by", "TEXT REFERENCES users(id)");

const courseColumns = db.prepare("PRAGMA table_info(courses)").all();
if (!courseColumns.some((column) => column.name === "lecturer_id")) {
  db.exec("ALTER TABLE courses ADD COLUMN lecturer_id TEXT REFERENCES users(id)");
}
db.exec(`
  UPDATE courses
  SET lecturer_id = (
    SELECT MIN(users.id) FROM users
    WHERE users.role = 'lecturer' AND users.full_name = courses.lecturer
    HAVING COUNT(*) = 1
  )
  WHERE lecturer_id IS NULL;
  CREATE INDEX IF NOT EXISTS courses_lecturer_id_idx ON courses(lecturer_id);
`);

const seed = db.transaction(() => {
  const count = db
    .prepare("SELECT COUNT(*) AS count FROM programmes")
    .get().count;
  if (count > 0) return;

  db.prepare(
    "INSERT INTO users (id, full_name, email, role) VALUES (?, ?, ?, ?)",
  ).run(
    "student-demo",
    "Amina Nansubuga",
    "amina.nansubuga@example.edu",
    "student",
  );
  db.prepare(
    "INSERT INTO users (id, full_name, email, role) VALUES (?, ?, ?, ?)",
  ).run(
    "lecturer-demo",
    "Dr. James Okello",
    "j.okello@example.edu",
    "lecturer",
  );
  db.prepare(
    "INSERT INTO users (id, full_name, email, role) VALUES (?, ?, ?, ?)",
  ).run("admin-demo", "Grace Atim", "g.atim@example.edu", "admin");
  db.prepare(
    "INSERT INTO programmes (id, name, award, duration) VALUES (?, ?, ?, ?)",
  ).run(
    "pg-public-health",
    "Public Health Leadership",
    "Postgraduate Diploma",
    "12 months",
  );
  db.prepare(
    "INSERT INTO programmes (id, name, award, duration) VALUES (?, ?, ?, ?)",
  ).run(
    "cert-project-mgmt",
    "Project Management Practice",
    "Professional Certificate",
    "6 months",
  );

  const addCourse = db.prepare(
    "INSERT INTO courses (id, programme_id, code, title, lecturer, lecturer_id, term, credits, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  addCourse.run(
    "course-health-systems",
    "pg-public-health",
    "PHL 610",
    "Health Systems & Policy",
    "Dr. James Okello",
    "lecturer-demo",
    "Term 2 · 2026",
    4,
    "Examine how health systems are designed, financed, and strengthened across diverse communities.",
  );
  addCourse.run(
    "course-research-methods",
    "pg-public-health",
    "PHL 624",
    "Applied Research Methods",
    "Dr. Sarah Kato",
    null,
    "Term 2 · 2026",
    3,
    "Build practical skills in research design, evidence appraisal, and ethical fieldwork.",
  );
  addCourse.run(
    "course-programme-design",
    "cert-project-mgmt",
    "PMP 402",
    "Programme Design Studio",
    "Mr. Peter Lule",
    null,
    "Term 2 · 2026",
    3,
    "Translate community needs into coherent programmes with measurable outcomes and sustainable delivery.",
  );

  const addModule = db.prepare(
    "INSERT INTO modules (id, course_id, title, sort_order) VALUES (?, ?, ?, ?)",
  );
  addModule.run(
    "mod-health-1",
    "course-health-systems",
    "Foundations of health systems",
    1,
  );
  addModule.run(
    "mod-health-2",
    "course-health-systems",
    "Financing and equitable access",
    2,
  );
  addModule.run(
    "mod-health-3",
    "course-health-systems",
    "Policy into practice",
    3,
  );
  addModule.run(
    "mod-research-1",
    "course-research-methods",
    "Research questions and design",
    1,
  );
  addModule.run(
    "mod-research-2",
    "course-research-methods",
    "Ethics and field methods",
    2,
  );
  addModule.run(
    "mod-programme-1",
    "course-programme-design",
    "Needs assessment",
    1,
  );
  addModule.run(
    "mod-programme-2",
    "course-programme-design",
    "Theory of change",
    2,
  );

  const addMaterial = db.prepare(
    "INSERT INTO materials (id, module_id, title, kind, duration) VALUES (?, ?, ?, ?, ?)",
  );
  addMaterial.run(
    "mat-health-1",
    "mod-health-1",
    "A systems view of community health",
    "Video lecture",
    "18 min",
  );
  addMaterial.run(
    "mat-health-2",
    "mod-health-1",
    "WHO health systems framework",
    "Reading",
    "12 pages",
  );
  addMaterial.run(
    "mat-health-3",
    "mod-health-2",
    "Financing for universal health coverage",
    "Lecture notes",
    "PDF",
  );
  addMaterial.run(
    "mat-research-1",
    "mod-research-1",
    "From topic to researchable question",
    "Video lecture",
    "22 min",
  );
  addMaterial.run(
    "mat-programme-1",
    "mod-programme-1",
    "Community needs assessment guide",
    "Reading",
    "9 pages",
  );

  db.prepare(
    "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)",
  ).run("student-demo", "course-health-systems");
  db.prepare(
    "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)",
  ).run("student-demo", "course-research-methods");
  const addAssignment = db.prepare(
    "INSERT INTO assignments (id, course_id, title, due_date, points) VALUES (?, ?, ?, ?, ?)",
  );
  addAssignment.run(
    "assignment-policy-brief",
    "course-health-systems",
    "Health policy brief",
    "2026-11-18",
    30,
  );
  addAssignment.run(
    "assignment-literature-review",
    "course-research-methods",
    "Critical literature review",
    "2026-11-22",
    25,
  );
  addAssignment.run(
    "assignment-systems-map",
    "course-health-systems",
    "Health system stakeholder map",
    "2026-11-12",
    20,
  );
});

seed();
