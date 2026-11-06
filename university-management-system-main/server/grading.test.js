import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

test("grading is role-scoped, publishable, audited, and persistent", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gli-lms-grading-"));
  const databasePath = join(directory, "grading.sqlite");
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}/api`;
  let server;
  let database;

  async function startServer() {
    server = spawn(process.execPath, ["server/index.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        DATABASE_PATH: databasePath,
        NODE_ENV: "test",
      },
      stdio: "ignore",
    });
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        const response = await fetch(`${baseUrl}/health`);
        if (response.ok) return;
      } catch {
        await delay(50);
      }
    }
    throw new Error("Test API did not start.");
  }

  async function stopServer() {
    if (!server || server.exitCode !== null) return;
    server.kill("SIGTERM");
    await Promise.race([once(server, "exit"), delay(1000)]);
  }

  async function login(role, userId) {
    const response = await fetch(`${baseUrl}/demo/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, userId }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    const cookie = response.headers.getSetCookie()[0]?.split(";", 1)[0];
    assert.ok(cookie, "demo sign-in should set a session cookie");
    return cookie;
  }

  async function request(cookie, path, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("Cookie", cookie);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const body = response.status === 204 ? null : await response.json();
    return { status: response.status, body };
  }

  try {
    await startServer();
    database = new Database(databasePath);
    database.pragma("foreign_keys = ON");
    database
      .prepare("INSERT INTO users (id, full_name, email, role) VALUES (?, ?, ?, ?)")
      .run(
        "lecturer-other-test",
        "Dr. Sarah Kato",
        "sarah.kato.test@example.edu",
        "lecturer",
      );
      database
        .prepare("UPDATE courses SET lecturer_id = ? WHERE id = ?")
        .run("lecturer-other-test", "course-research-methods");
      database
        .prepare("INSERT INTO users (id, full_name, email, role) VALUES (?, ?, ?, ?)")
        .run(
          "grading-other-student-test",
          "Other Test Student",
          "grading.other.student.test@example.edu",
          "student",
        );
      database
        .prepare("INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)")
        .run("grading-other-student-test", "course-health-systems");
      database
        .prepare("INSERT INTO submissions (assignment_id, student_id, response) VALUES (?, ?, ?)")
        .run(
          "assignment-policy-brief",
          "grading-other-student-test",
          "Another student's response and grade must remain private.",
        );
      const otherStudentSubmissionId = database
        .prepare("SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?")
        .get("assignment-policy-brief", "grading-other-student-test").id;
      database
        .prepare("INSERT INTO submission_grades (submission_id, score, feedback, status, graded_by) VALUES (?, ?, ?, ?, ?)")
        .run(
          otherStudentSubmissionId,
          29,
          "Private result for another learner.",
          "published",
          "lecturer-demo",
        );
      database
        .prepare("UPDATE materials SET file_name = ?, mime_type = ?, resource_url = ? WHERE id = ?")
        .run("systems-framework.pdf", "application/pdf", "https://example.test/systems.pdf", "mat-health-2");
      const now = new Date();
      const lectureStart = new Date(now.getTime() + 60 * 60 * 1000);
      const lectureEnd = new Date(lectureStart.getTime() + 60 * 60 * 1000);
      const assessmentStart = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const assessmentEnd = new Date(assessmentStart.getTime() + 2 * 60 * 60 * 1000);
      const asSqlDateTime = (date) => date.toISOString().slice(0, 19);
      database.prepare(`INSERT INTO lectures
        (id, course_id, title, starts_at, ends_at, facilitator, description, location, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run("lecture-enrolled-test", "course-health-systems", "Health systems seminar", asSqlDateTime(lectureStart), asSqlDateTime(lectureEnd), "Dr. James Okello", "Seminar description", "Room 2", "published");
      database.prepare(`INSERT INTO lectures
        (id, course_id, title, starts_at, ends_at, facilitator, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run("lecture-other-course-test", "course-programme-design", "Unenrolled lecture", asSqlDateTime(lectureStart), asSqlDateTime(lectureEnd), "Mr. Peter Lule", "published");
      database.prepare(`INSERT INTO assessments
        (id, course_id, title, assessment_type, instructions, starts_at, ends_at, duration_minutes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run("exam-enrolled-test", "course-health-systems", "Health systems exam", "examination", "Bring your student card.", asSqlDateTime(assessmentStart), asSqlDateTime(assessmentEnd), 120, "published");
      database.prepare(`INSERT INTO assessments
        (id, course_id, title, assessment_type, instructions, starts_at, ends_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run("exam-other-course-test", "course-programme-design", "Unenrolled exam", "test", "Private exam.", asSqlDateTime(assessmentStart), asSqlDateTime(assessmentEnd), "published");
      database.prepare(`INSERT INTO assessment_results
        (assessment_id, student_id, score, max_score, feedback, status, graded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run("exam-enrolled-test", "student-demo", 10, 20, "Draft result must stay hidden.", "draft", "lecturer-demo");
      database.prepare(`INSERT INTO assessment_results
        (assessment_id, student_id, score, max_score, feedback, status, graded_by, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
        .run("exam-enrolled-test", "grading-other-student-test", 18, 20, "Another student's result.", "published", "lecturer-demo");
      database.prepare("INSERT INTO announcements (id, course_id, title, body) VALUES (?, ?, ?, ?)")
        .run("announcement-enrolled-test", "course-health-systems", "Course update", "Published course information.");
      database.prepare("INSERT INTO announcements (id, course_id, title, body) VALUES (?, ?, ?, ?)")
        .run("announcement-other-course-test", "course-programme-design", "Private course update", "Not visible to this student.");
      database.prepare("INSERT INTO announcements (id, title, body) VALUES (?, ?, ?)")
        .run("announcement-university-test", "Campus notice", "A university-wide notice.");
    const unauthenticated = await fetch(`${baseUrl}/assignments`);
    assert.equal(unauthenticated.status, 401);

    const studentCookie = await login("student");
    const initialStudentGrades = await request(studentCookie, "/student/grades");
    assert.equal(initialStudentGrades.status, 200);
    assert.ok(!initialStudentGrades.body.some((grade) => grade.course_id === "course-health-systems"));
    const initialStudentAssessments = await request(studentCookie, "/student/assessments");
    assert.equal(initialStudentAssessments.body.length, 1);
    assert.equal(initialStudentAssessments.body[0].grade, null);
    assert.equal(initialStudentAssessments.body[0].feedback, null);
    const studentCourses = await request(studentCookie, "/courses");
    assert.equal(studentCourses.status, 200);
    assert.ok(studentCourses.body.some((course) => course.id === "course-health-systems"));
    assert.ok(!studentCourses.body.some((course) => course.id === "course-programme-design"));
    assert.equal((await request(studentCookie, "/course-catalogue")).body.length, 3);
    assert.equal((await request(studentCookie, "/courses/course-programme-design")).status, 200);
    const profile = await request(studentCookie, "/student/profile");
    assert.equal(profile.body.full_name, "Amina Nansubuga");
    assert.equal(profile.body.student_number, null);
    const materials = await request(studentCookie, "/student/materials");
    assert.ok(materials.body.some((material) => material.resource_url === "https://example.test/systems.pdf"));
    assert.ok(!materials.body.some((material) => material.course_id === "course-programme-design"));
    const lectures = await request(studentCookie, "/student/lectures");
    assert.ok(lectures.body.some((lecture) => lecture.id === "lecture-enrolled-test"));
    assert.ok(!lectures.body.some((lecture) => lecture.id === "lecture-other-course-test"));
    const weekStart = new Date();
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
    const timetable = await request(studentCookie, `/student/timetable?weekStart=${weekStart.toISOString().slice(0, 10)}`);
    assert.ok(timetable.body.events.some((event) => event.id === "lecture-enrolled-test"));
    assert.ok(!timetable.body.events.some((event) => event.id === "lecture-other-course-test"));
    const studentAssessments = await request(studentCookie, "/student/assessments");
    assert.equal(studentAssessments.body.length, 1);
    assert.equal(studentAssessments.body[0].availability, "upcoming");
    assert.equal(studentAssessments.body[0].grade, null);
    assert.equal((await request(studentCookie, "/student/assessments/exam-other-course-test")).status, 404);
    const studentAnnouncements = await request(studentCookie, "/student/announcements");
    assert.ok(studentAnnouncements.body.some((item) => item.id === "announcement-university-test"));
    assert.ok(!studentAnnouncements.body.some((item) => item.id === "announcement-other-course-test"));
    const moduleProgress = await request(studentCookie, "/student/modules/mod-health-1/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    assert.equal(moduleProgress.status, 200);
    assert.equal((await request(studentCookie, "/student/modules/mod-programme-1/progress", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }),
    })).status, 404);
    const studentSubmit = await request(studentCookie, "/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignmentId: "assignment-policy-brief",
        response: "A complete analysis with evidence and recommendations for implementation.",
      }),
    });
    assert.equal(studentSubmit.status, 201);
    const ownSubmissionId = database
      .prepare("SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?")
      .get("assignment-policy-brief", "student-demo").id;

    const otherCourseSubmit = await request(studentCookie, "/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignmentId: "assignment-literature-review",
        response: "A separate submitted analysis with literature synthesis and methods.",
      }),
    });
    assert.equal(otherCourseSubmit.status, 201);
    const otherSubmissionId = database
      .prepare("SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?")
      .get("assignment-literature-review", "student-demo").id;

    const lecturerCookie = await login("lecturer");
    assert.equal((await request(lecturerCookie, "/course-catalogue")).status, 403);
    assert.equal((await request(lecturerCookie, "/assignments")).status, 200);
    const lecturerDashboard = await request(lecturerCookie, "/lecturer/dashboard");
    assert.equal(lecturerDashboard.body.metrics.courses, 1);
    assert.equal((await request(lecturerCookie, "/lecturer/courses/course-health-systems/students")).status, 200);
    assert.equal((await request(lecturerCookie, "/lecturer/courses/course-programme-design/students")).status, 404);
    assert.equal((await request(lecturerCookie, "/lecturer/submission-roster?courseId=course-programme-design")).status, 404);
    assert.equal((await request(lecturerCookie, "/submissions?courseId=course-programme-design")).status, 404);
    assert.equal((await request(lecturerCookie, "/lecturer/materials", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: "course-programme-design", moduleId: "mod-programme-1", title: "Unauthorized", kind: "Reading" }),
    })).status, 404);
    assert.equal((await request(lecturerCookie, "/lecturer/assignments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: "course-programme-design", title: "Unauthorized", dueDate: "2027-01-01", points: 10 }),
    })).status, 404);
    const assignedCourses = await request(lecturerCookie, "/courses");
    assert.ok(assignedCourses.body.some((course) => course.id === "course-health-systems"));
    assert.ok(!assignedCourses.body.some((course) => course.id === "course-research-methods"));
    assert.equal((await request(lecturerCookie, "/courses/course-programme-design")).status, 404);

    const materialBody = {
      courseId: "course-health-systems", moduleId: "mod-health-1",
      title: "Facilitator draft notes", kind: "Lecture notes", description: "Session notes",
      resourceUrl: "https://example.test/notes.pdf", status: "draft",
    };
    const materialCreate = await request(lecturerCookie, "/lecturer/materials", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(materialBody),
    });
    assert.equal(materialCreate.status, 201);
    const materialId = materialCreate.body.id;
    assert.ok((await request(lecturerCookie, "/lecturer/materials")).body.some((item) => item.id === materialId));
    assert.ok(!(await request(studentCookie, "/student/materials")).body.some((item) => item.id === materialId));
    assert.equal((await request(lecturerCookie, "/lecturer/materials/not-owned", { method: "DELETE" })).status, 404);
    assert.equal((await request(lecturerCookie, `/lecturer/materials/${materialId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...materialBody, status: "published" }),
    })).status, 200);
    assert.ok((await request(studentCookie, "/student/materials")).body.some((item) => item.id === materialId));

    const managedLectureStart = new Date(Date.now() + 10 * 86400000).toISOString();
    const managedLectureEnd = new Date(Date.now() + 10 * 86400000 + 3600000).toISOString();
    const lectureBody = {
      courseId: "course-health-systems", moduleId: "mod-health-1", title: "Scheduled seminar",
      startsAt: managedLectureStart, endsAt: managedLectureEnd, description: "Seminar agenda",
      location: "Room 4", meetingUrl: null, recordingUrl: null, status: "draft",
    };
    const lectureCreate = await request(lecturerCookie, "/lecturer/lectures", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lectureBody),
    });
    assert.equal(lectureCreate.status, 201);
    const lectureId = lectureCreate.body.id;
    assert.ok(!(await request(studentCookie, "/student/lectures")).body.some((item) => item.id === lectureId));
    assert.equal((await request(lecturerCookie, `/lecturer/lectures/${lectureId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lectureBody, status: "published" }),
    })).status, 200);
    assert.ok((await request(studentCookie, "/student/lectures")).body.some((item) => item.id === lectureId));

    const assignmentBody = {
      courseId: "course-health-systems", title: "Lecturer-created coursework",
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      points: 15, instructions: "Submit a concise analysis.", status: "draft",
    };
    const assignmentCreate = await request(lecturerCookie, "/lecturer/assignments", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(assignmentBody),
    });
    assert.equal(assignmentCreate.status, 201);
    const assignmentId = assignmentCreate.body.id;
    assert.ok(!(await request(studentCookie, "/assignments")).body.some((item) => item.id === assignmentId));
    assert.equal((await request(lecturerCookie, `/lecturer/assignments/${assignmentId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...assignmentBody, status: "published" }),
    })).status, 200);
    assert.ok((await request(studentCookie, "/assignments")).body.some((item) => item.id === assignmentId));

    const assessmentBody = {
      courseId: "course-health-systems", moduleId: "mod-health-1", title: "Scheduled quiz",
      assessmentType: "quiz", instructions: "Read the instructions.",
      startsAt: new Date(Date.now() + 20 * 86400000).toISOString(),
      endsAt: new Date(Date.now() + 20 * 86400000 + 3600000).toISOString(),
      durationMinutes: 45, maxScore: 20, location: null, status: "draft",
    };
    const assessmentCreate = await request(lecturerCookie, "/lecturer/assessments", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(assessmentBody),
    });
    assert.equal(assessmentCreate.status, 201);
    const assessmentId = assessmentCreate.body.id;
    assert.ok(!(await request(studentCookie, "/student/assessments")).body.some((item) => item.id === assessmentId));
    assert.equal((await request(lecturerCookie, `/lecturer/assessments/${assessmentId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...assessmentBody, status: "published" }),
    })).status, 200);
    assert.ok((await request(studentCookie, "/student/assessments")).body.some((item) => item.id === assessmentId && item.availability === "upcoming"));
    const assessmentResultPath = `/lecturer/assessments/${assessmentId}/results/student-demo`;
    assert.equal((await request(lecturerCookie, assessmentResultPath, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 18, maxScore: 20, feedback: "Draft exam feedback", status: "draft" }),
    })).status, 200);
    assert.equal((await request(lecturerCookie, `/lecturer/assessments/${assessmentId}/results`)).body[0].result_status, "draft");
    const studentAssessmentDraft = (await request(studentCookie, "/student/assessments")).body.find((item) => item.id === assessmentId);
    assert.equal(studentAssessmentDraft.grade, null);
    assert.equal((await request(lecturerCookie, assessmentResultPath, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 25, maxScore: 20, feedback: "Out of range", status: "published" }),
    })).status, 400);
    assert.equal((await request(lecturerCookie, assessmentResultPath, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 18, maxScore: 20, feedback: "Published exam feedback", status: "published" }),
    })).status, 200);
    const studentAssessmentPublished = (await request(studentCookie, "/student/assessments")).body.find((item) => item.id === assessmentId);
    assert.equal(studentAssessmentPublished.grade, 18);
    assert.equal(studentAssessmentPublished.feedback, "Published exam feedback");

    const announcementBody = {
      courseId: "course-health-systems", title: "Course notice",
      body: "A published notice for this course.", status: "draft",
    };
    const announcementCreate = await request(lecturerCookie, "/lecturer/announcements", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(announcementBody),
    });
    assert.equal(announcementCreate.status, 201);
    const announcementId = announcementCreate.body.id;
    assert.ok(!(await request(studentCookie, "/student/announcements")).body.some((item) => item.id === announcementId));
    assert.equal((await request(lecturerCookie, `/lecturer/announcements/${announcementId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...announcementBody, status: "published" }),
    })).status, 200);
    assert.ok((await request(studentCookie, "/student/announcements")).body.some((item) => item.id === announcementId));

    const roster = await request(lecturerCookie, "/lecturer/courses/course-health-systems/students");
    assert.equal(roster.status, 200);
    assert.ok(roster.body.some((item) => item.student_id === "student-demo"));
    assert.equal((await request(lecturerCookie, "/lecturer/courses/course-programme-design/students")).status, 404);

    const initialReview = await request(
      lecturerCookie,
      `/submissions/${ownSubmissionId}`,
    );
    assert.equal(initialReview.status, 200);
    assert.equal(initialReview.body.grade_status, null);

    const draftResponse = (score, feedback, status) =>
      request(lecturerCookie, `/grades/${ownSubmissionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, feedback, status }),
      });
    assert.equal(
      (await draftResponse(31, "Out of range", "draft")).status,
      400,
    );
    assert.equal((await draftResponse(-1, "Negative", "draft")).status, 400);
    assert.equal(
      (await draftResponse(24, "Initial private feedback", "draft")).status,
      201,
    );
    assert.equal(
      (await draftResponse(25, "Revised private feedback", "draft")).status,
      200,
    );

    const hiddenDraft = await request(studentCookie, "/assignments");
    const sameAssignmentResults = hiddenDraft.body.filter(
      (item) => item.id === "assignment-policy-brief",
    );
    assert.equal(sameAssignmentResults.length, 1);
    const draftAssignment = sameAssignmentResults[0];
    assert.equal(draftAssignment.submission_status, "awaiting_grading");
    assert.equal(draftAssignment.grade, null);
    assert.equal(draftAssignment.feedback, null);
    assert.equal(
      (
        await request(studentCookie, "/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: "assignment-policy-brief",
            response: "A changed response after facilitator grading has begun.",
          }),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(studentCookie, `/grades/${ownSubmissionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score: 20, feedback: "Tampering", status: "published" }),
        })
      ).status,
      403,
    );

    assert.equal(
      (
        await request(lecturerCookie, `/grades/${otherSubmissionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score: 20, feedback: "Wrong course", status: "draft" }),
        })
      ).status,
      404,
    );
    const otherLecturerCookie = await login("lecturer", "lecturer-other-test");
    assert.equal(
      (await request(otherLecturerCookie, `/submissions/${ownSubmissionId}`)).status,
      404,
    );
    assert.equal(
      (await request(otherLecturerCookie, `/submissions/${otherSubmissionId}`)).status,
      200,
    );
    assert.equal(
      (
        await request(await login("admin"), `/grades/${ownSubmissionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score: 20, feedback: "Admin", status: "published" }),
        })
      ).status,
      403,
    );

    assert.equal(
      (await draftResponse(28, "Published feedback for the student.", "published"))
        .status,
      200,
    );
    assert.equal(
      (await draftResponse(27, "Attempt to unpublish", "draft")).status,
      409,
    );
    const publishedAssignment = (await request(studentCookie, "/assignments")).body.find(
      (item) => item.id === "assignment-policy-brief",
    );
    assert.equal(publishedAssignment.submission_status, "graded");
    assert.equal(publishedAssignment.grade, 28);
    assert.equal(publishedAssignment.feedback, "Published feedback for the student.");
    const publishedStudentGrades = await request(studentCookie, "/student/grades");
    assert.ok(publishedStudentGrades.body.some((grade) => grade.assessment === "Health policy brief" && grade.score === 28));
    assert.ok(!publishedStudentGrades.body.some((grade) => grade.feedback === "Another student's result."));

    const auditRows = database
      .prepare("SELECT * FROM grade_history WHERE submission_id = ? ORDER BY id")
      .all(ownSubmissionId);
    assert.equal(auditRows.length, 3);
    assert.deepEqual(
      auditRows.map(({ previous_score, new_score, changed_by }) => [
        previous_score,
        new_score,
        changed_by,
      ]),
      [
        [null, 24, "lecturer-demo"],
        [24, 25, "lecturer-demo"],
        [25, 28, "lecturer-demo"],
      ],
    );

    await stopServer();
    await startServer();
    const afterRestart = await request(await login("student"), "/assignments");
    const persisted = afterRestart.body.find(
      (item) => item.id === "assignment-policy-brief",
    );
    assert.equal(persisted.grade, 28);
    assert.equal(persisted.feedback, "Published feedback for the student.");
  } finally {
    await stopServer();
    if (database) {
      database
        .prepare("DELETE FROM submissions WHERE student_id = ?")
        .run("student-demo");
      database
        .prepare("DELETE FROM submissions WHERE student_id = ?")
        .run("grading-other-student-test");
      database
        .prepare("DELETE FROM enrollments WHERE student_id = ?")
        .run("grading-other-student-test");
      database
        .prepare("UPDATE courses SET lecturer_id = NULL WHERE lecturer_id = ?")
        .run("lecturer-other-test");
      database
        .prepare("DELETE FROM users WHERE id IN (?, ?)")
        .run("lecturer-other-test", "grading-other-student-test");
      database.close();
    }
    await rm(directory, { recursive: true, force: true });
  }
});