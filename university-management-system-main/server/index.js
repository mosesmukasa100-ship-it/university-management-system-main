import express from "express";
import session from "express-session";
import { randomUUID } from "node:crypto";
import { db } from "./database.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const demoMode = process.env.NODE_ENV !== "production";
const sessionSecret = process.env.SESSION_SECRET;

if (!demoMode && !sessionSecret) {
  throw new Error("SESSION_SECRET is required outside demo mode.");
}

app.use(express.json({ limit: "32kb" }));
app.use(
  session({
    name: "gli.lms.sid",
    secret: sessionSecret ?? "local-demo-session-secret-change-before-deployment",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: !demoMode,
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);

function requireSession(request, response, next) {
  const user = request.session.userId
    ? db
        .prepare("SELECT id, full_name, email, role FROM users WHERE id = ?")
        .get(request.session.userId)
    : null;
  if (!user) {
    return response.status(401).json({ error: "A valid session is required." });
  }
  request.user = user;
  next();
}

function requireRole(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.user.role)) {
      return response.status(403).json({ error: "This action is not permitted for your role." });
    }
    next();
  };
}

function lecturerOwnsCourse(lecturerId, courseId) {
  return db
    .prepare("SELECT id FROM courses WHERE id = ? AND lecturer_id = ?")
    .get(courseId, lecturerId);
}

function isValidDateTime(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isValidDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function validResourceUrl(value) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.href;
  } catch {
    if (value.startsWith("/") && !value.startsWith("//")) return value;
  }
  return undefined;
}

function assignedRecord(recordId, lecturerId, table) {
  const allowedTables = {
    materials: "materials",
    lectures: "lectures",
    assignments: "assignments",
    assessments: "assessments",
    announcements: "announcements",
  };
  const safeTable = allowedTables[table];
  if (!safeTable) return null;
  if (table === "materials") {
    return db
      .prepare(
        `SELECT item.id, modules.course_id FROM materials item
         JOIN modules ON modules.id = item.module_id
         JOIN courses c ON c.id = modules.course_id
         WHERE item.id = ? AND c.lecturer_id = ?`,
      )
      .get(recordId, lecturerId);
  }
  return db
    .prepare(
      `SELECT item.id, item.course_id FROM ${safeTable} item JOIN courses c ON c.id = item.course_id WHERE item.id = ? AND c.lecturer_id = ?`,
    )
    .get(recordId, lecturerId);
}

function saveLecturerLecture(user, body, existingId = null) {
  const {
    courseId, moduleId = null, title, startsAt, endsAt,
    facilitator = user.full_name, description = "", location = null,
    meetingUrl = null, recordingUrl = null, status = "draft",
  } = body;
  if (
    typeof courseId !== "string" || typeof title !== "string" || !title.trim() ||
    title.length > 200 || !isValidDateTime(startsAt) || !isValidDateTime(endsAt) ||
    Date.parse(endsAt) <= Date.parse(startsAt) ||
    typeof facilitator !== "string" || facilitator.length > 200 ||
    typeof description !== "string" || description.length > 5000 ||
    !["draft", "published", "cancelled"].includes(status)
  ) {
    return { status: 400, error: "Provide a title, valid schedule, facilitator, and lecture status." };
  }
  if (!lecturerOwnsCourse(user.id, courseId)) {
    return { status: 404, error: "Assigned course not found." };
  }
  if (moduleId && !db.prepare("SELECT id FROM modules WHERE id = ? AND course_id = ?").get(moduleId, courseId)) {
    return { status: 400, error: "Choose a topic belonging to the selected course." };
  }
  const safeMeetingUrl = validResourceUrl(meetingUrl);
  const safeRecordingUrl = validResourceUrl(recordingUrl);
  if (safeMeetingUrl === undefined || safeRecordingUrl === undefined) {
    return { status: 400, error: "Meeting and recording links must use HTTPS or a same-site path." };
  }
  if (existingId) {
    db.prepare(`
      UPDATE lectures SET course_id = ?, module_id = ?, title = ?, starts_at = ?, ends_at = ?,
        facilitator = ?, description = ?, location = ?, meeting_url = ?, recording_url = ?, status = ?
      WHERE id = ?
    `).run(courseId, moduleId, title.trim(), startsAt, endsAt, facilitator.trim(), description.trim(), location, safeMeetingUrl, safeRecordingUrl, status, existingId);
    return { id: existingId };
  }
  const id = randomUUID();
  db.prepare(`
    INSERT INTO lectures
      (id, course_id, module_id, title, starts_at, ends_at, facilitator, description,
       location, meeting_url, recording_url, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, courseId, moduleId, title.trim(), startsAt, endsAt, facilitator.trim(), description.trim(), location, safeMeetingUrl, safeRecordingUrl, status, user.id);
  return { id };
}

function saveLecturerAssignment(user, body, existingId = null) {
  const { courseId, title, dueDate, points, instructions = "", status = "draft" } = body;
  if (
    typeof courseId !== "string" || typeof title !== "string" || !title.trim() ||
    title.length > 200 || !isValidDate(dueDate) ||
    !Number.isInteger(points) || points < 1 || points > 10000 ||
    typeof instructions !== "string" || instructions.length > 10000 ||
    !["draft", "published", "closed"].includes(status)
  ) {
    return { status: 400, error: "Provide a title, valid due date, maximum marks, instructions, and status." };
  }
  if (!lecturerOwnsCourse(user.id, courseId)) {
    return { status: 404, error: "Assigned course not found." };
  }
  const storedStatus = status === "published" ? "published" : status;
  if (existingId) {
    db.prepare(`
      UPDATE assignments SET course_id = ?, title = ?, due_date = ?, points = ?, instructions = ?, status = ?
      WHERE id = ?
    `).run(courseId, title.trim(), dueDate, points, instructions.trim(), storedStatus, existingId);
    return { id: existingId };
  }
  const id = randomUUID();
  db.prepare(`
    INSERT INTO assignments (id, course_id, title, due_date, points, instructions, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, courseId, title.trim(), dueDate, points, instructions.trim(), storedStatus, user.id);
  return { id };
}

function saveLecturerAssessment(user, body, existingId = null) {
  const {
    courseId, moduleId = null, title, assessmentType, instructions = "",
    startsAt, endsAt, durationMinutes = null, maxScore = null,
    location = null, status = "draft",
  } = body;
  const types = ["examination", "quiz", "coursework", "test", "practical"];
  if (
    typeof courseId !== "string" || typeof title !== "string" || !title.trim() || title.length > 200 ||
    !types.includes(assessmentType) || typeof instructions !== "string" || instructions.length > 10000 ||
    !isValidDateTime(startsAt) || !isValidDateTime(endsAt) || Date.parse(endsAt) <= Date.parse(startsAt) ||
    (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440)) ||
    (maxScore !== null && (typeof maxScore !== "number" || !Number.isFinite(maxScore) || maxScore <= 0)) ||
    !["draft", "published", "cancelled"].includes(status)
  ) {
    return { status: 400, error: "Assessment details, type, schedule, duration, marks, or status are invalid." };
  }
  if (!lecturerOwnsCourse(user.id, courseId)) return { status: 404, error: "Assigned course not found." };
  if (moduleId && !db.prepare("SELECT id FROM modules WHERE id = ? AND course_id = ?").get(moduleId, courseId)) {
    return { status: 400, error: "Choose a topic belonging to the selected course." };
  }
  if (existingId) {
    db.prepare(`
      UPDATE assessments SET course_id = ?, module_id = ?, title = ?, assessment_type = ?,
        instructions = ?, starts_at = ?, ends_at = ?, duration_minutes = ?, max_score = ?,
        location = ?, status = ? WHERE id = ?
    `).run(courseId, moduleId, title.trim(), assessmentType, instructions.trim(), startsAt, endsAt, durationMinutes, maxScore, location, status, existingId);
    return { id: existingId };
  }
  const id = randomUUID();
  db.prepare(`
    INSERT INTO assessments
      (id, course_id, module_id, title, assessment_type, instructions, starts_at, ends_at,
       duration_minutes, max_score, location, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, courseId, moduleId, title.trim(), assessmentType, instructions.trim(), startsAt, endsAt, durationMinutes, maxScore, location, status, user.id);
  return { id };
}

function saveLecturerAnnouncement(user, body, existingId = null) {
  const { courseId, title, body: message, status = "draft" } = body;
  if (
    typeof courseId !== "string" || typeof title !== "string" || !title.trim() || title.length > 200 ||
    typeof message !== "string" || !message.trim() || message.length > 10000 ||
    !["draft", "published"].includes(status)
  ) return { status: 400, error: "Provide a title, message, course, and valid publication status." };
  if (!lecturerOwnsCourse(user.id, courseId)) return { status: 404, error: "Assigned course not found." };
  if (existingId) {
    db.prepare(`
      UPDATE announcements SET course_id = ?, title = ?, body = ?, status = ?,
        published_at = CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END
      WHERE id = ?
    `).run(courseId, title.trim(), message.trim(), status, status, existingId);
    return { id: existingId };
  }
  const id = randomUUID();
  db.prepare(`
    INSERT INTO announcements (id, course_id, title, body, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, courseId, title.trim(), message.trim(), status, user.id);
  return { id };
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", database: "connected" });
});

app.get("/api/session", (request, response) => {
  const user = request.session.userId
    ? db
        .prepare("SELECT id, full_name, email, role FROM users WHERE id = ?")
        .get(request.session.userId)
    : null;
  response.json({ user, demoMode });
});

app.post("/api/demo/session", (request, response, next) => {
  if (!demoMode) return response.status(404).json({ error: "Not found." });
  const userIds = {
    student: "student-demo",
    lecturer: "lecturer-demo",
    admin: "admin-demo",
  };
  const requestedTestUserId =
    process.env.NODE_ENV === "test" && request.body?.role === "lecturer"
      ? request.body?.userId
      : null;
  const requestedTestUser = requestedTestUserId
    ? db
        .prepare("SELECT id FROM users WHERE id = ? AND role = 'lecturer'")
        .get(requestedTestUserId)
    : null;
  if (requestedTestUserId && !requestedTestUser) {
    return response.status(400).json({ error: "Choose a valid test lecturer." });
  }
  const userId = requestedTestUser?.id ?? userIds[request.body?.role];
  if (!userId) return response.status(400).json({ error: "Choose a valid demo role." });
  request.session.regenerate((error) => {
    if (error) return next(error);
    request.session.userId = userId;
    const user = db
      .prepare("SELECT id, full_name, email, role FROM users WHERE id = ?")
      .get(userId);
    response.json({ user, demoMode: true });
  });
});

app.delete("/api/demo/session", (request, response, next) => {
  request.session.destroy((error) => {
    if (error) return next(error);
    response.clearCookie("gli.lms.sid", { httpOnly: true, sameSite: "lax" });
    response.status(204).end();
  });
});

app.use("/api", requireSession);

app.get("/api/programmes", (_request, response) => {
  const programmes = db
    .prepare(
      `
    SELECT p.*, COUNT(c.id) AS course_count
    FROM programmes p LEFT JOIN courses c ON c.programme_id = p.id
    GROUP BY p.id ORDER BY p.name
  `,
    )
    .all();
  response.json(programmes);
});

app.get("/api/courses", (request, response) => {
  response.json(
    db
      .prepare(
        `
    SELECT c.*, p.name AS programme_name,
      (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS module_count,
      (SELECT COUNT(*) FROM module_progress mp JOIN modules m ON m.id = mp.module_id
        WHERE m.course_id = c.id AND mp.student_id = ?) AS completed_modules,
      CASE WHEN (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) = 0 THEN 0
        ELSE ROUND(100.0 * (SELECT COUNT(*) FROM module_progress mp JOIN modules m ON m.id = mp.module_id
          WHERE m.course_id = c.id AND mp.student_id = ?)
          / (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id)) END AS progress_percent,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS enrolled_count
    FROM courses c JOIN programmes p ON p.id = c.programme_id
    ${request.user.role === "student" ? "JOIN enrollments visible ON visible.course_id = c.id AND visible.student_id = ?" : ""}
    ${request.user.role === "lecturer" ? "WHERE c.lecturer_id = ?" : ""}
    ORDER BY c.code
  `,
      )
      .all(
        request.user.role === "student" ? request.user.id : null,
        request.user.role === "student" ? request.user.id : null,
        ...(request.user.role === "student" ? [request.user.id] : []),
        ...(request.user.role === "lecturer" ? [request.user.id] : []),
      ),
  );
});

app.get("/api/course-catalogue", requireRole("student"), (request, response) => {
  response.json(
    db
      .prepare(
        `
      SELECT c.*, p.name AS programme_name,
        (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS module_count,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS enrolled_count,
        EXISTS(SELECT 1 FROM enrollments own WHERE own.course_id = c.id AND own.student_id = ?) AS enrolled
      FROM courses c JOIN programmes p ON p.id = c.programme_id
      ORDER BY c.code
    `,
      )
      .all(request.user.id),
  );
});

app.get("/api/courses/:id", (request, response) => {
  const course = db
    .prepare(
      `
    SELECT c.*, p.name AS programme_name,
      (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS module_count,
      (SELECT COUNT(*) FROM module_progress mp JOIN modules m ON m.id = mp.module_id
        WHERE m.course_id = c.id AND mp.student_id = ?) AS completed_modules,
      CASE WHEN (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) = 0 THEN 0
        ELSE ROUND(100.0 * (SELECT COUNT(*) FROM module_progress mp JOIN modules m ON m.id = mp.module_id
          WHERE m.course_id = c.id AND mp.student_id = ?)
          / (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id)) END AS progress_percent
    FROM courses c JOIN programmes p ON p.id = c.programme_id
    WHERE c.id = ? AND (? != 'lecturer' OR c.lecturer_id = ?)
  `,
    )
    .get(request.user.id, request.user.id, request.params.id, request.user.role, request.user.id);
  if (!course) return response.status(404).json({ error: "Course not found." });

  course.modules = db
    .prepare(
      `
    SELECT m.id, m.title, m.sort_order, module_progress.completed_at,
      materials.id AS material_id, materials.title AS material_title,
      materials.kind AS material_kind, materials.duration AS material_duration,
      materials.file_name, materials.mime_type, materials.resource_url
    FROM modules m LEFT JOIN materials ON materials.module_id = m.id
      AND (? != 'student' OR materials.status = 'published')
    LEFT JOIN module_progress ON module_progress.module_id = m.id AND module_progress.student_id = ?
    WHERE m.course_id = ? ORDER BY m.sort_order, materials.title
  `,
    )
    .all(request.user.role, request.user.id, course.id);
  response.json(course);
});

app.get("/api/student/profile", requireRole("student"), (request, response) => {
  const programmes = db
    .prepare(
      `
      SELECT DISTINCT p.id, p.name, p.award, p.duration
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      JOIN programmes p ON p.id = c.programme_id
      WHERE e.student_id = ? ORDER BY p.name
    `,
    )
    .all(request.user.id);
  const terms = db
    .prepare(
      "SELECT DISTINCT c.term FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.student_id = ? ORDER BY c.term",
    )
    .all(request.user.id)
    .map(({ term }) => term);
  response.json({
    full_name: request.user.full_name,
    email: request.user.email,
    student_number: request.user.student_number ?? null,
    programmes,
    academic_terms: terms,
  });
});

app.get("/api/student/materials", requireRole("student"), (request, response) => {
  response.json(
    db
      .prepare(
        `
      SELECT materials.id, materials.title, materials.kind, materials.duration,
        materials.file_name, materials.mime_type, materials.resource_url,
        modules.id AS module_id, modules.title AS module_title,
        courses.id AS course_id, courses.code AS course_code, courses.title AS course_title
      FROM enrollments
      JOIN courses ON courses.id = enrollments.course_id
      JOIN modules ON modules.course_id = courses.id
      JOIN materials ON materials.module_id = modules.id
      WHERE enrollments.student_id = ? AND materials.status = 'published'
      ORDER BY courses.code, modules.sort_order, materials.title
    `,
      )
      .all(request.user.id),
  );
});

app.post(
  "/api/student/modules/:moduleId/progress",
  requireRole("student"),
  (request, response) => {
    const { completed } = request.body ?? {};
    if (typeof completed !== "boolean") {
      return response.status(400).json({ error: "completed must be true or false." });
    }
    const module = db
      .prepare(
        `
        SELECT modules.id FROM modules
        JOIN enrollments ON enrollments.course_id = modules.course_id
        WHERE modules.id = ? AND enrollments.student_id = ?
      `,
      )
      .get(request.params.moduleId, request.user.id);
    if (!module) return response.status(404).json({ error: "Enrolled course module not found." });

    if (completed) {
      db.prepare(
        "INSERT OR IGNORE INTO module_progress (student_id, module_id) VALUES (?, ?)",
      ).run(request.user.id, module.id);
    } else {
      db.prepare("DELETE FROM module_progress WHERE student_id = ? AND module_id = ?").run(
        request.user.id,
        module.id,
      );
    }
    response.json({ completed });
  },
);

app.get("/api/assignments", (request, response) => {
  if (request.user.role === "student") {
    return response.json(
      db
        .prepare(
          `
    SELECT a.*, c.code AS course_code, c.title AS course_title,
      s.id AS submission_id, s.submitted_at, s.response,
      CASE WHEN g.submission_id IS NOT NULL THEN 'graded'
        WHEN s.id IS NOT NULL THEN 'awaiting_grading' ELSE 'not_submitted' END AS submission_status,
      g.score AS grade, g.feedback AS feedback, g.published_at,
      CASE WHEN s.id IS NOT NULL AND a.due_date >= date('now')
        AND a.status IN ('open', 'published')
        AND NOT EXISTS (SELECT 1 FROM submission_grades gd WHERE gd.submission_id = s.id)
        THEN 1 ELSE 0 END AS can_edit_submission,
      CASE WHEN s.id IS NULL AND a.due_date >= date('now')
        AND a.status IN ('open', 'published') THEN 1 ELSE 0 END AS can_submit
    FROM assignments a JOIN courses c ON c.id = a.course_id
    JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = ?
    LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
    LEFT JOIN submission_grades g ON g.submission_id = s.id AND g.status = 'published'
    WHERE a.status IN ('open', 'published')
    ORDER BY a.due_date
  `,
        )
        .all(request.user.id, request.user.id),
    );
  }

  const assignments = db
    .prepare(
      `
    SELECT DISTINCT a.*, c.code AS course_code, c.title AS course_title
    FROM assignments a JOIN courses c ON c.id = a.course_id
    ${request.user.role === "lecturer" ? "WHERE c.lecturer_id = ?" : ""}
    ORDER BY a.due_date
  `,
    )
    .all(...(request.user.role === "lecturer" ? [request.user.id] : []));
  response.json(assignments);
});

app.get("/api/lecturer/assignments", requireRole("lecturer"), (request, response) => {
  const courseId = typeof request.query.courseId === "string" ? request.query.courseId : null;
  if (courseId && !lecturerOwnsCourse(request.user.id, courseId)) {
    return response.status(404).json({ error: "Assigned course not found." });
  }
  const assignments = db.prepare(`
    SELECT a.*, c.code AS course_code, c.title AS course_title,
      CASE WHEN a.status = 'open' THEN 'published' ELSE a.status END AS display_status,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS enrolled_count,
      (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submitted_count,
      (SELECT COUNT(*) FROM submissions s JOIN submission_grades g ON g.submission_id = s.id
        WHERE s.assignment_id = a.id AND g.status = 'published') AS graded_count,
      (SELECT COUNT(*) FROM submissions s JOIN submission_grades g ON g.submission_id = s.id
        WHERE s.assignment_id = a.id AND g.status = 'draft') AS draft_graded_count,
      (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id
        AND date(s.submitted_at) > a.due_date) AS late_count
    FROM assignments a JOIN courses c ON c.id = a.course_id
    WHERE c.lecturer_id = ? ${courseId ? "AND c.id = ?" : ""}
    ORDER BY a.due_date
  `).all(request.user.id, ...(courseId ? [courseId] : []));
  response.json(assignments);
});

app.post("/api/lecturer/assignments", requireRole("lecturer"), (request, response) => {
  const result = saveLecturerAssignment(request.user, request.body ?? {});
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.status(201).json({ id: result.id });
});

app.put("/api/lecturer/assignments/:id", requireRole("lecturer"), (request, response) => {
  if (!assignedRecord(request.params.id, request.user.id, "assignments")) {
    return response.status(404).json({ error: "Assigned course assignment not found." });
  }
  const result = saveLecturerAssignment(request.user, request.body ?? {}, request.params.id);
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.json({ updated: true });
});

app.get("/api/student/lectures", requireRole("student"), (request, response) => {
  response.json(
    db
      .prepare(
        `
      SELECT l.id, l.title, l.starts_at, l.ends_at, l.description,
        l.location, l.meeting_url, l.recording_url,
        COALESCE(l.facilitator, c.lecturer) AS facilitator,
        c.id AS course_id, c.code AS course_code, c.title AS course_title
      FROM lectures l
      JOIN courses c ON c.id = l.course_id
      JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
      WHERE l.status = 'published'
      ORDER BY l.starts_at
    `,
      )
      .all(request.user.id),
  );
});

app.get("/api/student/timetable", requireRole("student"), (request, response) => {
  const weekStart = request.query.weekStart;
  if (
    typeof weekStart !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) ||
    Number.isNaN(Date.parse(`${weekStart}T00:00:00Z`)) ||
    new Date(`${weekStart}T00:00:00Z`).toISOString().slice(0, 10) !== weekStart
  ) {
    return response.status(400).json({ error: "weekStart must be a valid YYYY-MM-DD date." });
  }
  const weekEnd = new Date(`${weekStart}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const weekEndDate = weekEnd.toISOString().slice(0, 10);
  const events = db
    .prepare(
      `
      SELECT l.id, 'lecture' AS event_type, l.title, l.starts_at, l.ends_at,
        l.description, l.location, l.meeting_url, l.recording_url,
        COALESCE(l.facilitator, c.lecturer) AS facilitator,
        c.code AS course_code, c.title AS course_title
      FROM lectures l
      JOIN courses c ON c.id = l.course_id
      JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
      WHERE l.status = 'published' AND l.starts_at >= ? AND l.starts_at < ?
      UNION ALL
      SELECT a.id, 'assessment' AS event_type, a.title, a.starts_at, a.ends_at,
        a.instructions AS description, a.location, NULL AS meeting_url,
        NULL AS recording_url, c.lecturer AS facilitator,
        c.code AS course_code, c.title AS course_title
      FROM assessments a
      JOIN courses c ON c.id = a.course_id
      JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
      WHERE a.status = 'published' AND a.starts_at >= ? AND a.starts_at < ?
      ORDER BY starts_at
    `,
    )
    .all(
      request.user.id,
      `${weekStart}T00:00:00`,
      `${weekEndDate}T00:00:00`,
      request.user.id,
      `${weekStart}T00:00:00`,
      `${weekEndDate}T00:00:00`,
    );
  response.json({ week_start: weekStart, week_end: weekEndDate, events });
});

app.get("/api/student/assessments", requireRole("student"), (request, response) => {
  response.json(
    db
      .prepare(
        `
      SELECT a.id, a.title, a.assessment_type, a.instructions, a.starts_at,
        a.ends_at, a.duration_minutes, a.location, a.status,
        c.id AS course_id, c.code AS course_code, c.title AS course_title,
        CASE WHEN a.status = 'cancelled' THEN 'cancelled'
          WHEN datetime('now') < datetime(a.starts_at) THEN 'upcoming'
          WHEN datetime('now') <= datetime(a.ends_at) THEN 'available'
          ELSE 'closed' END AS availability,
        r.score AS grade, r.max_score, r.feedback, r.published_at AS result_published_at
      FROM assessments a
      JOIN courses c ON c.id = a.course_id
      JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
      LEFT JOIN assessment_results r ON r.assessment_id = a.id
        AND r.student_id = ? AND r.status = 'published'
      WHERE a.status = 'published'
      ORDER BY a.starts_at
    `,
      )
      .all(request.user.id, request.user.id),
  );
});

app.get("/api/student/assessments/:id", requireRole("student"), (request, response) => {
  const assessment = db
    .prepare(
      `
      SELECT a.id, a.title, a.assessment_type, a.instructions, a.starts_at,
        a.ends_at, a.duration_minutes, a.location, a.status,
        c.id AS course_id, c.code AS course_code, c.title AS course_title,
        CASE WHEN a.status = 'cancelled' THEN 'cancelled'
          WHEN datetime('now') < datetime(a.starts_at) THEN 'upcoming'
          WHEN datetime('now') <= datetime(a.ends_at) THEN 'available'
          ELSE 'closed' END AS availability,
        r.score AS grade, r.max_score, r.feedback, r.published_at AS result_published_at
      FROM assessments a
      JOIN courses c ON c.id = a.course_id
      JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
      LEFT JOIN assessment_results r ON r.assessment_id = a.id
        AND r.student_id = ? AND r.status = 'published'
      WHERE a.id = ? AND a.status = 'published'
    `,
    )
    .get(request.user.id, request.user.id, request.params.id);
  if (!assessment) return response.status(404).json({ error: "Assessment not found in your enrolled courses." });
  response.json(assessment);
});

app.get("/api/student/grades", requireRole("student"), (request, response) => {
  response.json(
    db
      .prepare(
        `
      SELECT CAST(s.id AS TEXT) AS id, 'assignment' AS result_type,
        a.title AS assessment, c.id AS course_id, c.code AS course_code,
        c.title AS course_title, g.score, a.points AS max_score,
        g.feedback, g.published_at
      FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN courses c ON c.id = a.course_id
      JOIN enrollments e ON e.course_id = c.id AND e.student_id = s.student_id
      JOIN submission_grades g ON g.submission_id = s.id AND g.status = 'published'
      WHERE s.student_id = ?
      UNION ALL
      SELECT ar.assessment_id || ':' || ar.student_id, a.assessment_type,
        a.title, c.id, c.code, c.title, ar.score, ar.max_score,
        ar.feedback, ar.published_at
      FROM assessment_results ar
      JOIN assessments a ON a.id = ar.assessment_id AND a.status = 'published'
      JOIN courses c ON c.id = a.course_id
      JOIN enrollments e ON e.course_id = c.id AND e.student_id = ar.student_id
      WHERE ar.student_id = ? AND ar.status = 'published'
      UNION ALL
      SELECT CAST(g.id AS TEXT), 'course grade', g.assessment,
        c.id, c.code, c.title, g.score, g.max_score, g.feedback, g.published_at
      FROM grades g
      JOIN courses c ON c.id = g.course_id
      JOIN enrollments e ON e.course_id = c.id AND e.student_id = g.student_id
      WHERE g.student_id = ? AND g.status = 'published'
      ORDER BY published_at DESC
    `,
      )
      .all(request.user.id, request.user.id, request.user.id),
  );
});

app.get("/api/student/announcements", requireRole("student"), (request, response) => {
  response.json(
    db
      .prepare(
        `
      SELECT a.id, a.title, a.body, a.published_at,
        c.id AS course_id, c.code AS course_code, c.title AS course_title,
        CASE WHEN a.course_id IS NULL THEN 'university' ELSE 'course' END AS announcement_type
      FROM announcements a
      LEFT JOIN courses c ON c.id = a.course_id
      WHERE a.status = 'published' AND (
        a.course_id IS NULL OR EXISTS (
          SELECT 1 FROM enrollments e WHERE e.course_id = a.course_id AND e.student_id = ?
        )
      )
      ORDER BY a.published_at DESC
    `,
      )
      .all(request.user.id),
  );
});

app.get("/api/lecturer/profile", requireRole("lecturer"), (request, response) => {
  response.json({
    id: request.user.id,
    full_name: request.user.full_name,
    email: request.user.email,
  });
});

app.get("/api/lecturer/materials", requireRole("lecturer"), (request, response) => {
  response.json(
    db
      .prepare(
        `
      SELECT m.*, modules.title AS module_title, courses.code AS course_code,
        courses.title AS course_title
      FROM materials m
      JOIN modules ON modules.id = m.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE courses.lecturer_id = ?
      ORDER BY courses.code, modules.sort_order, m.title
    `,
      )
      .all(request.user.id),
  );
});

app.post("/api/lecturer/materials", requireRole("lecturer"), (request, response) => {
  const {
    courseId, moduleId, title, kind, description = "", duration = null,
    fileName = null, mimeType = null, resourceUrl = null, status = "draft",
  } = request.body ?? {};
  if (
    typeof courseId !== "string" || typeof moduleId !== "string" ||
    typeof title !== "string" || !title.trim() || title.length > 200 ||
    typeof kind !== "string" || !kind.trim() || kind.length > 80 ||
    typeof description !== "string" || description.length > 5000 ||
    !["draft", "published"].includes(status)
  ) {
    return response.status(400).json({ error: "Provide a title, material type, valid course, description, and publication status." });
  }
  if (!lecturerOwnsCourse(request.user.id, courseId)) {
    return response.status(404).json({ error: "Assigned course not found." });
  }
  const module = db.prepare("SELECT id FROM modules WHERE id = ? AND course_id = ?").get(moduleId, courseId);
  if (!module) return response.status(400).json({ error: "Choose a module belonging to the selected course." });
  const safeUrl = validResourceUrl(resourceUrl);
  if (safeUrl === undefined) return response.status(400).json({ error: "Resource links must use HTTPS or a same-site path." });

  const id = randomUUID();
  db.prepare(`
    INSERT INTO materials
      (id, module_id, title, kind, duration, description, file_name, mime_type, resource_url, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, moduleId, title.trim(), kind.trim(), duration, description.trim(), fileName, mimeType, safeUrl, status, request.user.id);
  response.status(201).json({ id });
});

app.put("/api/lecturer/materials/:id", requireRole("lecturer"), (request, response) => {
  const existing = assignedRecord(request.params.id, request.user.id, "materials");
  if (!existing) return response.status(404).json({ error: "Assigned course material not found." });
  const {
    moduleId, title, kind, description = "", duration = null,
    fileName = null, mimeType = null, resourceUrl = null, status = "draft",
  } = request.body ?? {};
  if (
    typeof moduleId !== "string" || typeof title !== "string" || !title.trim() || title.length > 200 ||
    typeof kind !== "string" || !kind.trim() || kind.length > 80 ||
    typeof description !== "string" || description.length > 5000 || !["draft", "published"].includes(status)
  ) return response.status(400).json({ error: "Material details are invalid." });
  if (!db.prepare("SELECT id FROM modules WHERE id = ? AND course_id = ?").get(moduleId, existing.course_id)) {
    return response.status(400).json({ error: "Choose a module belonging to the assigned course." });
  }
  const safeUrl = validResourceUrl(resourceUrl);
  if (safeUrl === undefined) return response.status(400).json({ error: "Resource links must use HTTPS or a same-site path." });
  db.prepare(`
    UPDATE materials SET module_id = ?, title = ?, kind = ?, duration = ?, description = ?,
      file_name = ?, mime_type = ?, resource_url = ?, status = ? WHERE id = ?
  `).run(moduleId, title.trim(), kind.trim(), duration, description.trim(), fileName, mimeType, safeUrl, status, request.params.id);
  response.json({ updated: true });
});

app.delete("/api/lecturer/materials/:id", requireRole("lecturer"), (request, response) => {
  const existing = assignedRecord(request.params.id, request.user.id, "materials");
  if (!existing) return response.status(404).json({ error: "Assigned course material not found." });
  db.prepare("DELETE FROM materials WHERE id = ?").run(request.params.id);
  response.status(204).end();
});

app.get("/api/lecturer/lectures", requireRole("lecturer"), (request, response) => {
  response.json(
    db.prepare(`
      SELECT l.*, modules.title AS module_title, courses.code AS course_code,
        courses.title AS course_title
      FROM lectures l JOIN courses ON courses.id = l.course_id
      LEFT JOIN modules ON modules.id = l.module_id
      WHERE courses.lecturer_id = ? ORDER BY l.starts_at
    `).all(request.user.id),
  );
});

app.post("/api/lecturer/lectures", requireRole("lecturer"), (request, response) => {
  const result = saveLecturerLecture(request.user, request.body ?? {});
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.status(201).json({ id: result.id });
});

app.put("/api/lecturer/lectures/:id", requireRole("lecturer"), (request, response) => {
  const existing = assignedRecord(request.params.id, request.user.id, "lectures");
  if (!existing) return response.status(404).json({ error: "Assigned lecture not found." });
  const result = saveLecturerLecture(request.user, request.body ?? {}, request.params.id);
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.json({ updated: true });
});

app.get("/api/lecturer/assessments", requireRole("lecturer"), (request, response) => {
  response.json(db.prepare(`
    SELECT a.*, modules.title AS module_title, courses.code AS course_code,
      courses.title AS course_title,
      CASE WHEN a.status = 'draft' THEN 'draft'
        WHEN a.status = 'cancelled' THEN 'cancelled'
        WHEN datetime('now') < datetime(a.starts_at) THEN 'scheduled'
        WHEN datetime('now') <= datetime(a.ends_at) THEN 'available'
        ELSE 'closed' END AS display_status,
      (SELECT COUNT(*) FROM assessment_results r
        WHERE r.assessment_id = a.id AND r.status = 'published') AS published_results
    FROM assessments a JOIN courses ON courses.id = a.course_id
    LEFT JOIN modules ON modules.id = a.module_id
    WHERE courses.lecturer_id = ? ORDER BY a.starts_at
  `).all(request.user.id));
});

app.post("/api/lecturer/assessments", requireRole("lecturer"), (request, response) => {
  const result = saveLecturerAssessment(request.user, request.body ?? {});
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.status(201).json({ id: result.id });
});

app.put("/api/lecturer/assessments/:id", requireRole("lecturer"), (request, response) => {
  if (!assignedRecord(request.params.id, request.user.id, "assessments")) {
    return response.status(404).json({ error: "Assigned assessment not found." });
  }
  const result = saveLecturerAssessment(request.user, request.body ?? {}, request.params.id);
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.json({ updated: true });
});

app.get("/api/lecturer/assessments/:id/results", requireRole("lecturer"), (request, response) => {
  const assessment = assignedRecord(request.params.id, request.user.id, "assessments");
  if (!assessment) return response.status(404).json({ error: "Assigned assessment not found." });
  response.json(db.prepare(`
    SELECT u.id AS student_id, u.full_name AS student_name, u.student_number,
      r.score, r.max_score, r.feedback, r.status AS result_status, r.updated_at, r.published_at
    FROM enrollments e JOIN users u ON u.id = e.student_id
    LEFT JOIN assessment_results r ON r.assessment_id = ? AND r.student_id = u.id
    WHERE e.course_id = ? ORDER BY u.full_name
  `).all(assessment.id, assessment.course_id));
});

app.post(
  "/api/lecturer/assessments/:id/results/:studentId",
  requireRole("lecturer"),
  (request, response) => {
    const { score, maxScore, feedback = "", status } = request.body ?? {};
    const assessment = db.prepare(`
      SELECT a.id, a.max_score, c.id AS course_id
      FROM assessments a JOIN courses c ON c.id = a.course_id
      WHERE a.id = ? AND c.lecturer_id = ?
    `).get(request.params.id, request.user.id);
    if (!assessment) return response.status(404).json({ error: "Assigned assessment not found." });
    const student = db.prepare(`
      SELECT users.id FROM users JOIN enrollments ON enrollments.student_id = users.id
      WHERE users.id = ? AND users.role = 'student' AND enrollments.course_id = ?
    `).get(request.params.studentId, assessment.course_id);
    if (!student) return response.status(404).json({ error: "Student is not enrolled in this course." });
    const maximum = assessment.max_score ?? maxScore;
    if (
      typeof score !== "number" || !Number.isFinite(score) ||
      typeof maximum !== "number" || !Number.isFinite(maximum) || maximum <= 0 || score < 0 || score > maximum ||
      typeof feedback !== "string" || feedback.length > 5000 ||
      !["draft", "published"].includes(status)
    ) return response.status(400).json({ error: "Provide a valid score, maximum marks, feedback, and draft/published status." });
    if (!assessment.max_score) {
      db.prepare("UPDATE assessments SET max_score = ? WHERE id = ?").run(maximum, assessment.id);
    }
    db.prepare(`
      INSERT INTO assessment_results
        (assessment_id, student_id, score, max_score, feedback, status, graded_by, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP,
        CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)
      ON CONFLICT(assessment_id, student_id) DO UPDATE SET
        score = excluded.score, max_score = excluded.max_score, feedback = excluded.feedback,
        status = excluded.status, graded_by = excluded.graded_by, updated_at = CURRENT_TIMESTAMP,
        published_at = CASE WHEN excluded.status = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END
    `).run(assessment.id, student.id, score, maximum, feedback.trim(), status, request.user.id, status);
    response.json({ saved: true, status });
  },
);

app.get("/api/lecturer/announcements", requireRole("lecturer"), (request, response) => {
  response.json(db.prepare(`
    SELECT a.*, c.code AS course_code, c.title AS course_title
    FROM announcements a JOIN courses c ON c.id = a.course_id
    WHERE c.lecturer_id = ?
    ORDER BY a.published_at DESC
  `).all(request.user.id));
});

app.post("/api/lecturer/announcements", requireRole("lecturer"), (request, response) => {
  const result = saveLecturerAnnouncement(request.user, request.body ?? {});
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.status(201).json({ id: result.id });
});

app.put("/api/lecturer/announcements/:id", requireRole("lecturer"), (request, response) => {
  const existing = assignedRecord(request.params.id, request.user.id, "announcements");
  if (!existing) return response.status(404).json({ error: "Announcement not found for this lecturer." });
  const result = saveLecturerAnnouncement(request.user, request.body ?? {}, request.params.id);
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.json({ updated: true });
});

app.get("/api/lecturer/dashboard", requireRole("lecturer"), (request, response) => {
  const lecturerId = request.user.id;
  const metrics = {
    courses: db.prepare("SELECT COUNT(*) AS count FROM courses WHERE lecturer_id = ?").get(lecturerId).count,
    enrolledStudents: db.prepare(`
      SELECT COUNT(DISTINCT e.student_id) AS count FROM enrollments e
      JOIN courses c ON c.id = e.course_id WHERE c.lecturer_id = ?
    `).get(lecturerId).count,
    submissions: db.prepare(`
      SELECT COUNT(*) AS count FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
      WHERE c.lecturer_id = ?
    `).get(lecturerId).count,
    awaitingGrading: db.prepare(`
      SELECT COUNT(*) AS count FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
      LEFT JOIN submission_grades g ON g.submission_id = s.id
      WHERE c.lecturer_id = ? AND (g.status IS NULL OR g.status = 'draft')
    `).get(lecturerId).count,
    gradedSubmissions: db.prepare(`
      SELECT COUNT(*) AS count FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
      JOIN submission_grades g ON g.submission_id = s.id AND g.status = 'published'
      WHERE c.lecturer_id = ?
    `).get(lecturerId).count,
    upcomingAssessments: db.prepare(`
      SELECT COUNT(*) AS count FROM assessments a JOIN courses c ON c.id = a.course_id
      WHERE c.lecturer_id = ? AND a.status = 'published' AND datetime(a.starts_at) > datetime('now')
    `).get(lecturerId).count,
    upcomingLectures: db.prepare(`
      SELECT COUNT(*) AS count FROM lectures l JOIN courses c ON c.id = l.course_id
      WHERE c.lecturer_id = ? AND l.status = 'published' AND datetime(l.starts_at) > datetime('now')
    `).get(lecturerId).count,
    completedModules: db.prepare(`
      SELECT COUNT(*) AS count FROM module_progress mp JOIN modules m ON m.id = mp.module_id
      JOIN courses c ON c.id = m.course_id WHERE c.lecturer_id = ?
    `).get(lecturerId).count,
    totalModules: db.prepare(`
      SELECT COUNT(*) AS count FROM modules m JOIN courses c ON c.id = m.course_id
      WHERE c.lecturer_id = ?
    `).get(lecturerId).count,
  };
  const recentSubmissions = db.prepare(`
    SELECT s.id, s.submitted_at, a.title AS assignment_title, a.due_date,
      c.code AS course_code, c.title AS course_title, u.full_name AS student_name,
      g.status AS grade_status
    FROM submissions s JOIN assignments a ON a.id = s.assignment_id
    JOIN courses c ON c.id = a.course_id JOIN users u ON u.id = s.student_id
    LEFT JOIN submission_grades g ON g.submission_id = s.id
    WHERE c.lecturer_id = ? ORDER BY s.submitted_at DESC LIMIT 5
  `).all(lecturerId);
  const recentAnnouncements = db.prepare(`
    SELECT a.id, a.title, a.published_at, c.code AS course_code
    FROM announcements a JOIN courses c ON c.id = a.course_id
    WHERE c.lecturer_id = ? AND a.status = 'published'
    ORDER BY a.published_at DESC LIMIT 5
  `).all(lecturerId);
  response.json({ metrics, recentSubmissions, recentAnnouncements });
});

app.get("/api/lecturer/courses/:courseId/students", requireRole("lecturer"), (request, response) => {
  if (!lecturerOwnsCourse(request.user.id, request.params.courseId)) {
    return response.status(404).json({ error: "Assigned course not found." });
  }
  response.json(db.prepare(`
    SELECT u.id AS student_id, u.full_name AS student_name, u.student_number,
      (SELECT COUNT(*) FROM modules m WHERE m.course_id = ?) AS total_modules,
      (SELECT COUNT(*) FROM module_progress mp JOIN modules m ON m.id = mp.module_id
        WHERE m.course_id = ? AND mp.student_id = u.id) AS completed_modules,
      CASE WHEN (SELECT COUNT(*) FROM modules m WHERE m.course_id = ?) = 0 THEN 0
        ELSE ROUND(100.0 * (SELECT COUNT(*) FROM module_progress mp JOIN modules m ON m.id = mp.module_id
          WHERE m.course_id = ? AND mp.student_id = u.id)
          / (SELECT COUNT(*) FROM modules m WHERE m.course_id = ?)) END AS progress_percent,
      (SELECT COUNT(*) FROM assignments a WHERE a.course_id = ? AND a.status IN ('open', 'published')
        AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = u.id)) AS pending_assignments,
      (SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id
        WHERE a.course_id = ? AND s.student_id = u.id) AS submitted_assignments,
      (SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id
        JOIN submission_grades g ON g.submission_id = s.id AND g.status = 'published'
        WHERE a.course_id = ? AND s.student_id = u.id) AS published_grades
    FROM enrollments e JOIN users u ON u.id = e.student_id
    WHERE e.course_id = ? ORDER BY u.full_name
  `).all(
    request.params.courseId, request.params.courseId, request.params.courseId,
    request.params.courseId, request.params.courseId, request.params.courseId,
    request.params.courseId, request.params.courseId, request.params.courseId,
  ));
});

app.get("/api/submissions", requireRole("lecturer"), (request, response) => {
  const courseId = typeof request.query.courseId === "string" ? request.query.courseId : null;
  const assignmentId = typeof request.query.assignmentId === "string" ? request.query.assignmentId : null;
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
  if (courseId && !lecturerOwnsCourse(request.user.id, courseId)) {
    return response.status(404).json({ error: "Assigned course not found." });
  }
  if (assignmentId && !assignedRecord(assignmentId, request.user.id, "assignments")) {
    return response.status(404).json({ error: "Assigned assignment not found." });
  }
  response.json(
    db
      .prepare(
        `
    SELECT s.id, s.assignment_id, s.student_id, s.response, s.submitted_at,
      a.title AS assignment_title, a.due_date, a.points,
      c.id AS course_id, c.code AS course_code, c.title AS course_title,
      u.full_name AS student_name, u.student_number, g.score AS grade, g.feedback,
      g.status AS grade_status, g.updated_at AS grade_updated_at,
      CASE WHEN g.status = 'published' THEN 'graded'
        WHEN g.status = 'draft' THEN 'draft'
        ELSE 'awaiting_grading' END AS submission_status,
      CASE WHEN date(s.submitted_at) > a.due_date THEN 1 ELSE 0 END AS is_late
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN courses c ON c.id = a.course_id
    JOIN users u ON u.id = s.student_id
    LEFT JOIN submission_grades g ON g.submission_id = s.id
    WHERE c.lecturer_id = ?
      AND (? IS NULL OR c.id = ?)
      AND (? IS NULL OR a.id = ?)
      AND (? = '' OR LOWER(u.full_name) LIKE '%' || LOWER(?) || '%'
        OR LOWER(COALESCE(u.student_number, '')) LIKE '%' || LOWER(?) || '%')
    ORDER BY s.submitted_at DESC
  `,
      )
      .all(request.user.id, courseId, courseId, assignmentId, assignmentId, search, search, search),

    app.get("/api/lecturer/submission-roster", requireRole("lecturer"), (request, response) => {
      const courseId = typeof request.query.courseId === "string" ? request.query.courseId : null;
      const assignmentId = typeof request.query.assignmentId === "string" ? request.query.assignmentId : null;
      const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
      if (courseId && !lecturerOwnsCourse(request.user.id, courseId)) {
        return response.status(404).json({ error: "Assigned course not found." });
      }
      if (assignmentId && !assignedRecord(assignmentId, request.user.id, "assignments")) {
        return response.status(404).json({ error: "Assigned assignment not found." });
      }
      response.json(db.prepare(`
        SELECT a.id AS assignment_id, a.title AS assignment_title, a.due_date, a.points,
          c.id AS course_id, c.code AS course_code, c.title AS course_title,
          u.id AS student_id, u.full_name AS student_name, u.student_number,
          s.id AS submission_id, s.submitted_at, s.response,
          g.score AS grade, g.feedback, g.status AS grade_status,
          CASE WHEN s.id IS NULL THEN 'not_submitted'
            WHEN g.status = 'published' THEN 'graded'
            WHEN g.status = 'draft' THEN 'draft'
            ELSE 'awaiting_grading' END AS submission_status,
          CASE WHEN s.id IS NOT NULL AND date(s.submitted_at) > a.due_date THEN 1 ELSE 0 END AS is_late
        FROM assignments a
        JOIN courses c ON c.id = a.course_id AND c.lecturer_id = ?
        JOIN enrollments e ON e.course_id = c.id
        JOIN users u ON u.id = e.student_id
        LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = u.id
        LEFT JOIN submission_grades g ON g.submission_id = s.id
        WHERE a.status IN ('open', 'published', 'closed')
          AND (? IS NULL OR c.id = ?)
          AND (? IS NULL OR a.id = ?)
          AND (? = '' OR LOWER(u.full_name) LIKE '%' || LOWER(?) || '%'
            OR LOWER(COALESCE(u.student_number, '')) LIKE '%' || LOWER(?) || '%')
        ORDER BY a.due_date, u.full_name
      `).all(request.user.id, courseId, courseId, assignmentId, assignmentId, search, search, search));
    });
  );
});

app.get("/api/lecturer/submission-roster", requireRole("lecturer"), (request, response) => {
  const courseId = typeof request.query.courseId === "string" ? request.query.courseId : null;
  const assignmentId = typeof request.query.assignmentId === "string" ? request.query.assignmentId : null;
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
  if (courseId && !lecturerOwnsCourse(request.user.id, courseId)) {
    return response.status(404).json({ error: "Assigned course not found." });
  }
  if (assignmentId && !assignedRecord(assignmentId, request.user.id, "assignments")) {
    return response.status(404).json({ error: "Assigned assignment not found." });
  }
  response.json(db.prepare(`
    SELECT a.id AS assignment_id, a.title AS assignment_title, a.due_date, a.points,
      c.id AS course_id, c.code AS course_code, c.title AS course_title,
      u.id AS student_id, u.full_name AS student_name, u.student_number,
      s.id AS submission_id, s.submitted_at, s.response,
      g.score AS grade, g.feedback, g.status AS grade_status,
      CASE WHEN s.id IS NULL THEN 'not_submitted'
        WHEN g.status = 'published' THEN 'graded'
        WHEN g.status = 'draft' THEN 'draft'
        ELSE 'awaiting_grading' END AS submission_status,
      CASE WHEN s.id IS NOT NULL AND date(s.submitted_at) > a.due_date THEN 1 ELSE 0 END AS is_late
    FROM assignments a
    JOIN courses c ON c.id = a.course_id AND c.lecturer_id = ?
    JOIN enrollments e ON e.course_id = c.id
    JOIN users u ON u.id = e.student_id
    LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = u.id
    LEFT JOIN submission_grades g ON g.submission_id = s.id
    WHERE a.status IN ('open', 'published', 'closed')
      AND (? IS NULL OR c.id = ?)
      AND (? IS NULL OR a.id = ?)
      AND (? = '' OR LOWER(u.full_name) LIKE '%' || LOWER(?) || '%'
        OR LOWER(COALESCE(u.student_number, '')) LIKE '%' || LOWER(?) || '%')
    ORDER BY a.due_date, u.full_name
  `).all(request.user.id, courseId, courseId, assignmentId, assignmentId, search, search, search));
});

app.get("/api/submissions/:id", requireRole("lecturer"), (request, response) => {
  const submissionId = Number(request.params.id);
  if (!Number.isSafeInteger(submissionId) || submissionId < 1)
    return response
      .status(400)
      .json({ error: "A valid submission ID is required." });

  const submission = db
    .prepare(
      `
    SELECT s.id, s.assignment_id, s.student_id, s.response, s.submitted_at,
      a.title AS assignment_title, a.due_date, a.points,
      c.id AS course_id, c.code AS course_code, c.title AS course_title,
      u.full_name AS student_name, g.score AS grade, g.feedback,
      g.status AS grade_status, g.updated_at AS grade_updated_at
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN courses c ON c.id = a.course_id
    JOIN users u ON u.id = s.student_id
    LEFT JOIN submission_grades g ON g.submission_id = s.id
    WHERE s.id = ? AND c.lecturer_id = ?
  `,
    )
    .get(submissionId, request.user.id);
  if (!submission)
    return response
      .status(404)
      .json({ error: "Submission not found for this lecturer." });
  response.json(submission);
});

app.post(
  "/api/grades/:submissionId",
  requireRole("lecturer"),
  (request, response) => {
    const submissionId = Number(request.params.submissionId);
    const { score, feedback, status } = request.body ?? {};
    if (!Number.isSafeInteger(submissionId) || submissionId < 1) {
      return response.status(400).json({ error: "A valid submission ID is required." });
    }
    if (
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      typeof feedback !== "string" ||
      feedback.length > 5000 ||
      !["draft", "published"].includes(status)
    ) {
      return response.status(400).json({
        error: "Provide a numeric score, feedback up to 5,000 characters, and draft or published status.",
      });
    }

    const submission = db
      .prepare(
        `
      SELECT s.id, a.points, c.lecturer_id
      FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN courses c ON c.id = a.course_id
      WHERE s.id = ? AND c.lecturer_id = ?
    `,
      )
      .get(submissionId, request.user.id);
    if (!submission) {
      return response.status(404).json({ error: "Submission not found for this lecturer." });
    }
    if (score < 0 || score > submission.points) {
      return response.status(400).json({
        error: `Score must be between 0 and ${submission.points}.`,
      });
    }

    const previous = db
      .prepare("SELECT * FROM submission_grades WHERE submission_id = ?")
      .get(submissionId);
    if (previous?.status === "published" && status === "draft") {
      return response.status(409).json({
        error: "A published grade cannot be moved back to draft.",
      });
    }

    const saveGrade = db.transaction(() => {
      db.prepare(
        `
        INSERT INTO submission_grades
          (submission_id, score, feedback, status, graded_by, updated_at, published_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP,
          CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)
        ON CONFLICT(submission_id) DO UPDATE SET
          score = excluded.score,
          feedback = excluded.feedback,
          status = excluded.status,
          graded_by = excluded.graded_by,
          updated_at = CURRENT_TIMESTAMP,
          published_at = CASE WHEN excluded.status = 'published'
            THEN CURRENT_TIMESTAMP ELSE NULL END
      `,
      ).run(
        submissionId,
        score,
        feedback.trim(),
        status,
        request.user.id,
        status,
      );
      db.prepare(
        `
        INSERT INTO grade_history
          (submission_id, changed_by, previous_score, new_score,
           previous_feedback, new_feedback, previous_status, new_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        submissionId,
        request.user.id,
        previous?.score ?? null,
        score,
        previous?.feedback ?? null,
        feedback.trim(),
        previous?.status ?? null,
        status,
      );
      return db
        .prepare("SELECT * FROM submission_grades WHERE submission_id = ?")
        .get(submissionId);
    });

    const grade = saveGrade();
    response.status(previous ? 200 : 201).json(grade);
  },
);

app.get("/api/enrollments", requireRole("student"), (request, response) => {
  response.json(
    db
      .prepare(
        `
    SELECT c.*, e.enrolled_at, p.name AS programme_name,
      (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS module_count
    FROM enrollments e JOIN courses c ON c.id = e.course_id
    JOIN programmes p ON p.id = c.programme_id
    WHERE e.student_id = ? ORDER BY c.code
  `,
      )
      .all(request.user.id),
  );
});

app.post("/api/enrollments", requireRole("student"), (request, response) => {
  const { courseId, studentId: requestedStudentId } = request.body ?? {};
  if (typeof courseId !== "string") {
    return response
      .status(400)
      .json({ error: "A valid courseId is required." });
  }
  if (requestedStudentId && requestedStudentId !== request.user.id) {
    return response.status(403).json({ error: "You cannot enrol another student." });
  }
  const studentId = request.user.id;
  const course = db
    .prepare("SELECT id FROM courses WHERE id = ?")
    .get(courseId);
  const student = db
    .prepare("SELECT id FROM users WHERE id = ? AND role = 'student'")
    .get(studentId);
  if (!course || !student)
    return response.status(404).json({ error: "Course or student not found." });
  try {
    db.prepare(
      "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)",
    ).run(studentId, courseId);
    return response.status(201).json({ enrolled: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE")
      return response
        .status(409)
        .json({ error: "Already enrolled in this course." });
    throw error;
  }
});

app.post("/api/submissions", requireRole("student"), (request, response) => {
  const {
    assignmentId,
    response: text,
    studentId: requestedStudentId,
  } = request.body ?? {};
  if (
    typeof assignmentId !== "string" ||
    typeof text !== "string" ||
    text.trim().length < 10 ||
    text.length > 10000
  ) {
    return response
      .status(400)
      .json({ error: "Provide a response between 10 and 10,000 characters." });
  }
  if (requestedStudentId && requestedStudentId !== request.user.id) {
    return response.status(403).json({ error: "You cannot submit work for another student." });
  }
  const studentId = request.user.id;
  const assignment = db
    .prepare(
      "SELECT id, due_date, course_id FROM assignments WHERE id = ? AND status IN ('open', 'published')",
    )
    .get(assignmentId);
  const student = db
    .prepare("SELECT id FROM users WHERE id = ? AND role = 'student'")
    .get(studentId);
  if (!assignment || !student)
    return response
      .status(404)
      .json({ error: "Open assignment or student not found." });
  const enrollment = db
    .prepare(
      "SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?",
    )
    .get(studentId, assignment.course_id);
  if (!enrollment)
    return response
      .status(403)
      .json({
        error: "Enrol in this course before submitting its assignment.",
      });
  if (assignment.due_date < new Date().toISOString().slice(0, 10)) {
    return response
      .status(409)
      .json({ error: "The assignment deadline has passed." });
  }
  const existingSubmission = db
    .prepare(
      "SELECT g.status FROM submissions s LEFT JOIN submission_grades g ON g.submission_id = s.id WHERE s.assignment_id = ? AND s.student_id = ?",
    )
    .get(assignmentId, studentId);
  if (existingSubmission?.status) {
    return response.status(409).json({
      error: "This submission is being graded and can no longer be changed.",
    });
  }
  db.prepare(
    `
    INSERT INTO submissions (assignment_id, student_id, response) VALUES (?, ?, ?)
    ON CONFLICT(assignment_id, student_id) DO UPDATE SET response = excluded.response, submitted_at = CURRENT_TIMESTAMP
  `,
  ).run(assignmentId, studentId, text.trim());
  response.status(201).json({ submitted: true });
});

app.get("/api/dashboard/:role", (request, response) => {
  const { role } = request.params;
  if (!["student", "lecturer", "admin"].includes(role))
    return response.status(400).json({ error: "Unknown dashboard role." });
  if (role !== request.user.role) {
    return response.status(403).json({ error: "You cannot view another role's dashboard." });
  }
  const metrics = {
    courses: db.prepare("SELECT COUNT(*) AS value FROM courses").get().value,
    programmes: db.prepare("SELECT COUNT(*) AS value FROM programmes").get()
      .value,
    students: db
      .prepare("SELECT COUNT(*) AS value FROM users WHERE role = 'student'")
      .get().value,
    lecturers: db
      .prepare("SELECT COUNT(*) AS value FROM users WHERE role = 'lecturer'")
      .get().value,
    taughtCourses: db
      .prepare(
        "SELECT COUNT(*) AS value FROM courses WHERE lecturer_id = ?",
      )
      .get(request.user.id).value,
    submissions:
      role === "student"
        ? db
            .prepare("SELECT COUNT(*) AS value FROM submissions WHERE student_id = ?")
            .get(request.user.id).value
        : role === "lecturer"
        ? db
            .prepare(
              "SELECT COUNT(*) AS value FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id WHERE c.lecturer_id = ?",
            )
            .get(request.user.id).value
        : db.prepare("SELECT COUNT(*) AS value FROM submissions").get().value,
    pendingAssignments:
      role === "student"
        ? db
            .prepare("SELECT COUNT(*) AS value FROM assignments a JOIN enrollments e ON e.course_id = a.course_id WHERE a.status = 'open' AND e.student_id = ?")
            .get(request.user.id).value
        : role === "lecturer"
        ? db
            .prepare(
              "SELECT COUNT(*) AS value FROM assignments a JOIN courses c ON c.id = a.course_id WHERE a.status = 'open' AND c.lecturer_id = ?",
            )
            .get(request.user.id).value
        : db
            .prepare(
              "SELECT COUNT(*) AS value FROM assignments WHERE status = 'open'",
            )
            .get().value,
    enrollments:
      role === "student"
        ? db
            .prepare("SELECT COUNT(*) AS value FROM enrollments WHERE student_id = ?")
            .get(request.user.id).value
        : role === "lecturer"
        ? db
            .prepare(
              "SELECT COUNT(*) AS value FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE c.lecturer_id = ?",
            )
            .get(request.user.id).value
        : db.prepare("SELECT COUNT(*) AS value FROM enrollments").get().value,
  };
  response.json(metrics);
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`LMS API listening on http://0.0.0.0:${port}`);
});
