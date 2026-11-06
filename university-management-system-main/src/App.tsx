import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  Menu,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
type Role = "student" | "lecturer" | "admin";
type Page =
  | "overview"
  | "courses"
  | "catalogue"
  | "materials"
  | "lectures"
  | "timetable"
  | "assessments"
  | "assignments"
  | "grades"
  | "progress"
  | "announcements"
  | "profile"
  | "programmes"
  | "submissions";
type Course = {
  id: string;
  code: string;
  title: string;
  lecturer: string;
  term: string;
  credits: number;
  description: string;
  programme_name: string;
  module_count: number;
  enrolled_count: number;
  completed_modules?: number;
  progress_percent?: number;
};
type Assignment = {
  id: string;
  title: string;
  course_code: string;
  course_title: string;
  due_date: string;
  points: number;
  submitted_at: string | null;
  response: string | null;
  submission_status: "not_submitted" | "awaiting_grading" | "graded";
  grade: number | null;
  feedback: string | null;
  can_edit_submission?: boolean;
  can_submit?: boolean;
  instructions?: string;
};
type Submission = {
  id: number;
  assignment_id: string;
  student_id: string;
  response: string;
  submitted_at: string;
  assignment_title: string;
  due_date: string;
  points: number;
  course_id: string;
  course_code: string;
  course_title: string;
  student_name: string;
  grade: number | null;
  feedback: string | null;
  grade_status: "draft" | "published" | null;
  grade_updated_at: string | null;
};
type SessionInfo = {
  user: { id: string; full_name: string; email: string; role: Role } | null;
  demoMode: boolean;
};
type Programme = {
  id: string;
  name: string;
  award: string;
  duration: string;
  course_count: number;
};
type CourseDetail = Course & {
  modules: {
    id: string;
    title: string;
    sort_order: number;
    material_id: string | null;
    material_title: string | null;
    material_kind: string | null;
    material_duration: string | null;
    file_name?: string | null;
    mime_type?: string | null;
    resource_url?: string | null;
    completed_at?: string | null;
  }[];
};
type StudentProfile = {
  full_name: string;
  email: string;
  student_number: string | null;
  programmes: { id: string; name: string; award: string; duration: string }[];
  academic_terms: string[];
};
type StudentLecture = {
  id: string; title: string; starts_at: string; ends_at: string; facilitator: string
  description: string; location: string | null; meeting_url: string | null; recording_url: string | null
  course_id: string; course_code: string; course_title: string
};
type StudentMaterial = {
  id: string; title: string; kind: string; duration: string | null
  file_name: string | null; mime_type: string | null; resource_url: string | null
  module_id: string; module_title: string; course_id: string; course_code: string; course_title: string
};
type TimetableEvent = StudentLecture & { event_type: "lecture" | "assessment" };
type Timetable = { week_start: string; week_end: string; events: TimetableEvent[] };
type Assessment = {
  id: string; title: string; assessment_type: string; instructions: string
  starts_at: string; ends_at: string; duration_minutes: number | null; location: string | null
  availability: "upcoming" | "available" | "closed" | "cancelled"
  course_id: string; course_code: string; course_title: string
  grade: number | null; max_score: number | null; feedback: string | null; result_published_at: string | null
};
type GradeResult = {
  id: string; result_type: string; assessment: string; course_id: string; course_code: string
  course_title: string; score: number; max_score: number; feedback: string; published_at: string
};
type Announcement = {
  id: string; title: string; body: string; published_at: string
  course_id: string | null; course_code: string | null; course_title: string | null
  announcement_type: "university" | "course"
};
type LecturerDashboardData = {
  metrics: { courses: number; enrolledStudents: number; submissions: number; awaitingGrading: number; gradedSubmissions: number; upcomingAssessments: number; upcomingLectures: number; completedModules: number; totalModules: number };
  recentSubmissions: Submission[];
  recentAnnouncements: { id: string; title: string; published_at: string; course_code: string }[];
};
type LecturerProfile = { id: string; full_name: string; email: string };
type LecturerMaterial = StudentMaterial & { description: string; status: "draft" | "published"; module_id: string };
type LecturerLecture = StudentLecture & { module_id: string | null; module_title: string | null; status: "draft" | "published" | "cancelled" };
type LecturerAssignment = Assignment & { course_id: string; status: "open" | "draft" | "published" | "closed"; enrolled_count: number; submitted_count: number; graded_count: number; draft_graded_count: number; late_count: number };
type LecturerAssessment = Assessment & { status: "draft" | "published" | "cancelled"; display_status: "draft" | "scheduled" | "available" | "closed" | "cancelled"; module_id: string | null; module_title: string | null; max_score: number | null; published_results: number };
type LecturerAnnouncement = { id: string; course_id: string; course_code: string; course_title: string; title: string; body: string; status: "draft" | "published"; published_at: string };
type StudentProgress = { student_id: string; student_name: string; student_number: string | null; total_modules: number; completed_modules: number; progress_percent: number; pending_assignments: number; submitted_assignments: number; published_grades: number; course_id?: string; course_code?: string; course_title?: string; assignment_id?: string; assignment_title?: string; due_date?: string; submission_id?: number | null; submitted_at?: string | null; response?: string | null; grade?: number | null; feedback?: string | null; grade_status?: "draft" | "published" | null; submission_status?: "not_submitted" | "awaiting_grading" | "draft" | "graded"; is_late?: number };
type AssessmentResultStudent = { student_id: string; student_name: string; student_number: string | null; score: number | null; max_score: number | null; feedback: string | null; result_status: "draft" | "published" | null };
type Metrics = {
  courses: number;
  programmes: number;
  students: number;
  lecturers: number;
  taughtCourses: number;
  submissions: number;
  pendingAssignments: number;
  enrollments: number;
};

const API = "/api";
const roleInfo: Record<
  Role,
  { name: string; title: string; initials: string }
> = {
  student: {
    name: "Amina Nansubuga",
    title: "Postgraduate student",
    initials: "AN",
  },
  lecturer: {
    name: "Dr. James Okello",
    title: "Senior lecturer",
    initials: "JO",
  },
  admin: {
    name: "Grace Atim",
    title: "Academic administrator",
    initials: "GA",
  },
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(
      result.error ?? `The learning service returned ${response.status}.`,
    );
  }
  return response.json() as Promise<T>;
}

function App() {
  const [role, setRole] = useState<Role>("student");
  const [sessionReady, setSessionReady] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [page, setPage] = useState<Page>("overview");
  const [courses, setCourses] = useState<Course[]>([]);
  const [catalogueCourses, setCatalogueCourses] = useState<Course[]>([]);
  const [enrolled, setEnrolled] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [lectures, setLectures] = useState<StudentLecture[]>([]);
  const [materials, setMaterials] = useState<StudentMaterial[]>([]);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [gradeResults, setGradeResults] = useState<GradeResult[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [lecturerDashboard, setLecturerDashboard] = useState<LecturerDashboardData | null>(null);
  const [lecturerProfile, setLecturerProfile] = useState<LecturerProfile | null>(null);
  const [lecturerMaterials, setLecturerMaterials] = useState<LecturerMaterial[]>([]);
  const [lecturerLectures, setLecturerLectures] = useState<LecturerLecture[]>([]);
  const [lecturerAssignments, setLecturerAssignments] = useState<LecturerAssignment[]>([]);
  const [lecturerAssessments, setLecturerAssessments] = useState<LecturerAssessment[]>([]);
  const [lecturerAnnouncements, setLecturerAnnouncements] = useState<LecturerAnnouncement[]>([]);
  const [studentRoster, setStudentRoster] = useState<StudentProgress[]>([]);
  const [progressCourseId, setProgressCourseId] = useState("");
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(
    null,
  );
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null);
  const [selectedAssessment, setSelectedAssessment] =
    useState<Assessment | null>(null);
  const [submission, setSubmission] = useState<Assignment | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [loadingSubmission, setLoadingSubmission] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState("");
  const person = roleInfo[role];
  const displayName =
    role === "student" && studentProfile
      ? studentProfile.full_name
      : person.name;
  const displayInitials = displayName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function refresh() {
    setLoading(true);
    try {
      const [
        allCourses,
        currentEnrollments,
        allAssignments,
        lecturerSubmissions,
        allProgrammes,
        dashboard,
      ] = await Promise.all([
        getJson<Course[]>("/courses"),
        role === "student"
          ? getJson<Course[]>("/enrollments")
          : Promise.resolve([] as Course[]),
        getJson<Assignment[]>("/assignments"),
        role === "lecturer"
          ? getJson<Submission[]>("/submissions")
          : Promise.resolve([] as Submission[]),
        getJson<Programme[]>("/programmes"),
        getJson<Metrics>(`/dashboard/${role}`),
      ]);
      setCourses(allCourses);
      setEnrolled(currentEnrollments);
      setAssignments(allAssignments);
      setSubmissions(lecturerSubmissions);
      setProgrammes(allProgrammes);
      setMetrics(dashboard);
      if (role === "student") {
        const [profile, courseCatalogue, studentMaterials, studentLectures, studentTimetable, studentAssessments, studentGrades, studentAnnouncements] = await Promise.all([
          getJson<StudentProfile>("/student/profile"),
          getJson<Course[]>("/course-catalogue"),
          getJson<StudentMaterial[]>("/student/materials"),
          getJson<StudentLecture[]>("/student/lectures"),
          getJson<Timetable>(`/student/timetable?weekStart=${getWeekStart()}`),
          getJson<Assessment[]>("/student/assessments"),
          getJson<GradeResult[]>("/student/grades"),
          getJson<Announcement[]>("/student/announcements"),
        ]);
        setStudentProfile(profile);
        setCatalogueCourses(courseCatalogue);
        setMaterials(studentMaterials);
        setLectures(studentLectures);
        setTimetable(studentTimetable);
        setAssessments(studentAssessments);
        setGradeResults(studentGrades);
        setAnnouncements(studentAnnouncements);
      } else if (role === "lecturer") {
        const [dashboardData, lecturerProfileData, materialsData, lecturesData, assignmentsData, assessmentsData, announcementsData] = await Promise.all([
          getJson<LecturerDashboardData>("/lecturer/dashboard"),
          getJson<LecturerProfile>("/lecturer/profile"),
          getJson<LecturerMaterial[]>("/lecturer/materials"),
          getJson<LecturerLecture[]>("/lecturer/lectures"),
          getJson<LecturerAssignment[]>("/lecturer/assignments"),
          getJson<LecturerAssessment[]>("/lecturer/assessments"),
          getJson<LecturerAnnouncement[]>("/lecturer/announcements"),
        ]);
        setLecturerDashboard(dashboardData);
        setLecturerProfile(lecturerProfileData);
        setLecturerMaterials(materialsData);
        setLecturerLectures(lecturesData);
        setLecturerAssignments(assignmentsData);
        setLecturerAssessments(assessmentsData);
        setLecturerAnnouncements(announcementsData);
        setStudentProfile(null);
        setCatalogueCourses([]);
        setMaterials([]);
        setLectures([]);
        setTimetable(null);
        setAssessments([]);
        setGradeResults([]);
        setAnnouncements([]);
      } else {
        setLecturerDashboard(null);
        setLecturerProfile(null);
        setLecturerMaterials([]);
        setLecturerLectures([]);
        setLecturerAssignments([]);
        setLecturerAssessments([]);
        setLecturerAnnouncements([]);
        setStudentRoster([]);
        setStudentProfile(null);
        setCatalogueCourses([]);
        setMaterials([]);
        setLectures([]);
        setTimetable(null);
        setAssessments([]);
        setGradeResults([]);
        setAnnouncements([]);
      }
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not connect to the learning service.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function establishSession() {
      try {
        let sessionInfo = await getJson<SessionInfo>("/session");
        if (!sessionInfo.user && sessionInfo.demoMode) {
          const response = await fetch(`${API}/demo/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "student" }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          sessionInfo = result as SessionInfo;
        }
        if (!sessionInfo.user) {
          throw new Error("Sign-in is not configured for this deployment.");
        }
        if (active) {
          setDemoMode(sessionInfo.demoMode);
          setRole(sessionInfo.user.role);
          setSessionReady(true);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not establish a session.",
          );
          setLoading(false);
        }
      }
    }
    void establishSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    void refresh();
  }, [role, sessionReady]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function openCourse(courseId: string) {
    setLoadingCourse(true);
    setSelectedCourse(null);
    try {
      setSelectedCourse(await getJson<CourseDetail>(`/courses/${courseId}`));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load course.",
      );
    } finally {
      setLoadingCourse(false);
    }
  }

  async function toggleModuleProgress(moduleId: string, completed: boolean) {
    setBusy(true);
    try {
      const response = await fetch(`${API}/student/modules/${moduleId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (selectedCourse) {
        setSelectedCourse(
          await getJson<CourseDetail>(`/courses/${selectedCourse.id}`),
        );
      }
      await refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update module progress.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function openSubmission(submissionId: number) {
    setLoadingSubmission(true);
    setSelectedSubmission(null);
    try {
      setSelectedSubmission(
        await getJson<Submission>(
          `/submissions/${submissionId}`,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load submission.",
      );
    } finally {
      setLoadingSubmission(false);
    }
  }

  async function enroll(course: Course) {
    setBusy(true);
    try {
      const response = await fetch(`${API}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
      setNotice(`Enrolled in ${course.code}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not enrol in this course.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitAssignment() {
    if (!submission) return;
    setBusy(true);
    try {
      const response = await fetch(`${API}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: submission.id,
          response: submissionText,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSubmission(null);
      setSubmissionText("");
      await refresh();
      setNotice("Your assignment response has been submitted.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not submit assignment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function switchRole(nextRole: Role) {
    if (!demoMode) return;
    setBusy(true);
    try {
      const response = await fetch(`${API}/demo/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setRole(result.user.role as Role);
      setPage("overview");
      setSelectedSubmission(null);
      setNotice(`Demo role changed to ${result.user.role}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not switch demo role.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveGrade(
    item: Submission,
    score: number,
    feedback: string,
    status: "draft" | "published",
  ) {
    setBusy(true);
    try {
      const response = await fetch(`${API}/grades/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, feedback, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
      setSelectedSubmission(await getJson<Submission>(`/submissions/${item.id}`));
      setNotice(status === "published" ? "Grade published to the student." : "Draft grade saved.");
    } catch (requestError) {
      throw new Error(
        requestError instanceof Error
          ? requestError.message
          : "Could not save grade.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveLecturerRecord(
    path: string,
    method: "POST" | "PUT",
    body: unknown,
    successMessage: string,
  ) {
    setBusy(true);
    try {
      const response = await fetch(`${API}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(result?.error ?? "Could not save this record.");
      await refresh();
      setNotice(successMessage);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save this record.");
      throw requestError;
    } finally {
      setBusy(false);
    }
  }

  async function deleteLecturerMaterial(materialId: string) {
    setBusy(true);
    try {
      const response = await fetch(`${API}/lecturer/materials/${materialId}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Could not remove material.");
      }
      await refresh();
      setNotice("Material removed.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not remove material.");
    } finally {
      setBusy(false);
    }
  }

  async function openCourseProgress(courseId: string) {
    setProgressCourseId(courseId);
    setLoadingRoster(true);
    setPage("progress");
    try {
      setStudentRoster(await getJson<StudentProgress[]>(`/lecturer/courses/${courseId}/students`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load student progress.");
    } finally {
      setLoadingRoster(false);
    }
  }

  async function saveAssessmentResult(
    assessmentId: string,
    studentId: string,
    score: number,
    maxScore: number,
    feedback: string,
    status: "draft" | "published",
  ) {
    await saveLecturerRecord(
      `/lecturer/assessments/${assessmentId}/results/${studentId}`,
      "POST",
      { score, maxScore, feedback, status },
      status === "published" ? "Assessment result published." : "Assessment result saved as draft.",
    );
  }

  const dueSoon = assignments
    .filter((assignment) => !assignment.submitted_at)
    .slice(0, 3);
  const nav =
    role === "student"
      ? [
          { id: "overview" as Page, label: "Dashboard", icon: LayoutDashboard },
          { id: "courses" as Page, label: "My courses", icon: BookOpen },
          { id: "catalogue" as Page, label: "Course catalogue", icon: LibraryBig },
          { id: "materials" as Page, label: "Course materials", icon: FileText },
          { id: "lectures" as Page, label: "Lectures", icon: GraduationCap },
          { id: "timetable" as Page, label: "Timetable", icon: CalendarDays },
          { id: "assessments" as Page, label: "Exams & assessments", icon: ClipboardCheck },
          { id: "assignments" as Page, label: "Assignments", icon: ClipboardCheck },
          { id: "grades" as Page, label: "Grades & feedback", icon: Check },
          { id: "announcements" as Page, label: "Announcements", icon: Bell },
          { id: "profile" as Page, label: "Student profile", icon: Users },
        ]
      : role === "lecturer"
        ? [
            { id: "overview" as Page, label: "Dashboard", icon: LayoutDashboard },
            { id: "courses" as Page, label: "My Courses", icon: BookOpen },
            { id: "materials" as Page, label: "Course Materials", icon: FileText },
            { id: "lectures" as Page, label: "Lectures", icon: GraduationCap },
            { id: "assignments" as Page, label: "Assignments", icon: ClipboardCheck },
            { id: "submissions" as Page, label: "Student Submissions", icon: Users },
            { id: "assessments" as Page, label: "Exams & Assessments", icon: CalendarDays },
            { id: "grades" as Page, label: "Grades & Feedback", icon: Check },
            { id: "progress" as Page, label: "Student Progress", icon: Users },
            { id: "announcements" as Page, label: "Announcements", icon: Bell },
            { id: "profile" as Page, label: "Profile", icon: Users },
          ]
      : [
          { id: "overview" as Page, label: "Overview", icon: LayoutDashboard },
          { id: "courses" as Page, label: "Courses", icon: BookOpen },
          { id: "assignments" as Page, label: "Assignments", icon: ClipboardCheck },
        ];

  function navigate(nextPage: Page) {
    setPage(nextPage);
    setMobileOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark">
            <GraduationCap size={23} strokeWidth={1.8} />
          </div>
          <div>
            <strong>
              GLI <span>Learning</span>
            </strong>
            <small>GREAT LAKES INSTITUTE</small>
          </div>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="campus-select">
          <span className="campus-dot" /> Digital campus
        </div>
        <div className="nav-caption">LEARNING SPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => navigate(id)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "assignments" && dueSoon.length > 0 && (
                <span className="nav-count">{dueSoon.length}</span>
              )}
            </button>
          ))}
        </nav>
        {role !== "student" && (
          <>
            <div className="nav-caption management-caption">INSTITUTION</div>
            <button
              className={`nav-item ${page === "programmes" ? "active" : ""}`}
              onClick={() => navigate("programmes")}
            >
              <GraduationCap size={18} strokeWidth={1.8} />
              <span>Academic programmes</span>
            </button>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="help-box">
            <div className="help-icon">
              <CircleHelp size={17} />
            </div>
            <strong>Learning support</strong>
            <span>
              Support contact details are not configured for this demo.
            </span>
          </div>
          <div className="sidebar-user">
            <div className="avatar avatar-small">{displayInitials}</div>
            <div className="sidebar-user-copy">
              <strong>{displayName}</strong>
              <span>{person.title}</span>
            </div>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>Digital campus</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{pageLabel(page)}</strong>
          </div>
          <label className="top-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                if (event.target.value) setPage("courses");
              }}
              placeholder="Search courses..."
              aria-label="Search courses"
            />
          </label>
          <div className="top-actions">
            <span className="demo-chip">
              <span /> Demo workspace
            </span>
            <button
              className="icon-button notification-button"
              aria-label="Notifications unavailable"
              title="Notifications are not configured"
              disabled
            >
              <Bell size={19} />
            </button>
            <div className="top-divider" />
            <div className="avatar">{displayInitials}</div>
            <div className="top-user">
              <strong>{displayName}</strong>
              <span>{person.title}</span>
            </div>
            <label className="role-switch">
              <span className="sr-only">Preview role</span>
              <select
                value={role}
                onChange={(event) => void switchRole(event.target.value as Role)}
                aria-label="Preview dashboard role"
                disabled={!demoMode || busy}
              >
                <option value="student">Student</option>
                <option value="lecturer">Lecturer</option>
                <option value="admin">Admin</option>
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </header>

        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button className="text-action" onClick={() => void refresh()}>
              Retry
            </button>
            <button
              className="icon-button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="page-content">
          {loading ? (
            <div className="loading-state" role="status">
              Loading academic records…
            </div>
          ) : (
            <>
              {page === "overview" &&
                (role === "student" ? (
                  <StudentDashboard
                    profile={studentProfile}
                    courses={enrolled}
                    assignments={assignments}
                    lectures={lectures}
                    assessments={assessments}
                    grades={gradeResults}
                    announcements={announcements}
                    navigate={navigate}
                    openCourse={openCourse}
                  />
                ) : role === "lecturer" ? (
                  <LecturerDashboard
                    lecturerName={displayName}
                    dashboard={lecturerDashboard}
                    courses={courses}
                    assignments={lecturerAssignments}
                    assessments={lecturerAssessments}
                    lectures={lecturerLectures}
                    onNavigate={navigate}
                    onOpenCourse={openCourse}
                  />
                ) : (
                  <Overview
                    role={role}
                    person={person}
                    metrics={metrics}
                    enrolled={enrolled}
                    courses={courses}
                    assignments={assignments}
                    programmes={programmes}
                    submissions={submissions}
                    openCourse={openCourse}
                    openSubmission={openSubmission}
                    navigate={navigate}
                  />
                ))}
              {page === "courses" && (
                <CourseListing
                  role={role}
                  courses={role === "student" ? enrolled : courses}
                  allCourses={role === "student" ? enrolled : courses}
                  search={search}
                  busy={busy}
                  openCourse={openCourse}
                  enroll={enroll}
                />
              )}
              {page === "catalogue" && role === "student" && (
                <CourseListing
                  role="student"
                  courses={enrolled}
                  allCourses={catalogueCourses}
                  search={search}
                  busy={busy}
                  openCourse={openCourse}
                  enroll={enroll}
                  catalogueMode
                />
              )}
              {page === "materials" && role === "student" && (
                <CourseMaterials materials={materials} />
              )}
              {page === "materials" && role === "lecturer" && (
                <LecturerMaterialsPage
                  courses={courses}
                  materials={lecturerMaterials}
                  busy={busy}
                  onSave={(material, id) => saveLecturerRecord(
                    id ? `/lecturer/materials/${id}` : "/lecturer/materials",
                    id ? "PUT" : "POST", material, id ? "Material updated." : "Material saved.",
                  )}
                  onDelete={deleteLecturerMaterial}
                />
              )}
              {page === "lectures" && role === "student" && (
                <LecturesPage lectures={lectures} />
              )}
              {page === "lectures" && role === "lecturer" && (
                <LecturerLecturesPage
                  courses={courses}
                  lectures={lecturerLectures}
                  busy={busy}
                  onSave={(lecture, id) => saveLecturerRecord(
                    id ? `/lecturer/lectures/${id}` : "/lecturer/lectures",
                    id ? "PUT" : "POST", lecture, id ? "Lecture updated." : "Lecture created.",
                  )}
                />
              )}
              {page === "timetable" && role === "student" && (
                <TimetablePage timetable={timetable} />
              )}
              {page === "assessments" && role === "student" && (
                <AssessmentsPage
                  assessments={assessments}
                  onOpen={setSelectedAssessment}
                />
              )}
              {page === "assignments" && role === "lecturer" && (
                <LecturerAssignmentsPage
                  courses={courses}
                  assignments={lecturerAssignments}
                  busy={busy}
                  onSave={(assignment, id) => saveLecturerRecord(
                    id ? `/lecturer/assignments/${id}` : "/lecturer/assignments",
                    id ? "PUT" : "POST", assignment, id ? "Assignment updated." : "Assignment created.",
                  )}
                />
              )}
              {page === "assignments" && role !== "lecturer" && (
                <AssignmentPage
                  role={role}
                  assignments={assignments}
                  onSubmit={(item) => {
                    setSubmission(item);
                    setSubmissionText(item.response ?? "");
                  }}
                />
              )}
              {page === "grades" && role === "student" && (
                <GradesPage grades={gradeResults} />
              )}
              {page === "announcements" && role === "student" && (
                <AnnouncementsPage announcements={announcements} />
              )}
              {page === "profile" && role === "student" && (
                <StudentProfilePage
                  profile={studentProfile}
                  courses={enrolled}
                />
              )}
              {page === "profile" && role === "lecturer" && (
                <LecturerProfilePage
                  profile={lecturerProfile}
                  courses={courses}
                  dashboard={lecturerDashboard}
                />
              )}
              {page === "submissions" && role === "lecturer" && (
                <LecturerSubmissionsPage
                  courses={courses}
                  assignments={lecturerAssignments}
                  submissions={submissions}
                  onOpen={openSubmission}
                  roster={studentRoster}
                  loadingRoster={loadingRoster}
                  onLoadRoster={async (courseId) => {
                    setProgressCourseId(courseId);
                    setLoadingRoster(true);
                    try {
                      setStudentRoster(await getJson<StudentProgress[]>(`/lecturer/courses/${courseId}/students`));
                    } catch (requestError) {
                      setError(requestError instanceof Error ? requestError.message : "Could not load submissions.");
                    } finally {
                      setLoadingRoster(false);
                    }
                  }}
                />
              )}
              {page === "assessments" && role === "lecturer" && (
                <LecturerAssessmentsPage
                  courses={courses}
                  assessments={lecturerAssessments}
                  busy={busy}
                  onSave={(assessment, id) => saveLecturerRecord(
                    id ? `/lecturer/assessments/${id}` : "/lecturer/assessments",
                    id ? "PUT" : "POST", assessment, id ? "Assessment updated." : "Assessment created.",
                  )}
                  onSaveResult={saveAssessmentResult}
                />
              )}
              {page === "grades" && role === "lecturer" && (
                <LecturerGradesPage submissions={submissions} onOpen={openSubmission} />
              )}
              {page === "progress" && role === "lecturer" && (
                <LecturerProgressPage
                  courses={courses}
                  courseId={progressCourseId}
                  students={studentRoster}
                  loading={loadingRoster}
                  onSelect={openCourseProgress}
                />
              )}
              {page === "announcements" && role === "lecturer" && (
                <LecturerAnnouncementsPage
                  courses={courses}
                  announcements={lecturerAnnouncements}
                  busy={busy}
                  onSave={(announcement, id) => saveLecturerRecord(
                    id ? `/lecturer/announcements/${id}` : "/lecturer/announcements",
                    id ? "PUT" : "POST", announcement, id ? "Announcement updated." : "Announcement saved.",
                  )}
                />
              )}
              {page === "programmes" && (
                <ProgrammePage
                  programmes={programmes}
                  courses={courses}
                  openCourse={openCourse}
                />
              )}
            </>
          )}
        </div>
        <footer className="page-footer">
          <span>© 2026 Great Lakes Institute of Professional Learning</span>
          <span>
            <ShieldCheck size={14} /> Learning with purpose
          </span>
        </footer>
      </main>

      {selectedCourse && (
        <CourseModal
          course={selectedCourse}
          enrolled={role === "student" && enrolled.some(({ id }) => id === selectedCourse.id)}
          canEnroll={role === "student"}
          busy={busy}
          close={() => setSelectedCourse(null)}
          onEnroll={() => enroll(selectedCourse)}
          onToggleProgress={toggleModuleProgress}
        />
      )}
      {selectedAssessment && (
        <AssessmentDetail
          assessment={selectedAssessment}
          close={() => setSelectedAssessment(null)}
        />
      )}
      {loadingCourse && (
        <div className="modal-backdrop">
          <div className="dialog loading-dialog" role="status">
            Loading course details…
          </div>
        </div>
      )}
      {selectedSubmission && (
        <SubmissionReview
          submission={selectedSubmission}
          close={() => setSelectedSubmission(null)}
          busy={busy}
          onSave={(score, feedback, status) =>
            saveGrade(selectedSubmission, score, feedback, status)
          }
        />
      )}
      {loadingSubmission && (
        <div className="modal-backdrop">
          <div className="dialog loading-dialog" role="status">
            Loading submission…
          </div>
        </div>
      )}
      {submission && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSubmission(null);
          }}
        >
          <section
            className="dialog submission-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submission-title"
          >
            <div className="dialog-top">
              <div>
                <span className="eyebrow">
                  {submission.course_code} · {submission.points} points
                </span>
                <h2 id="submission-title">Submit assignment</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setSubmission(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>
            <p className="dialog-subtitle">
              {submission.title} · Due {formatDate(submission.due_date)} · {submission.points} points
            </p>
            <div className="assignment-instructions">
              <strong>Instructions</strong>
              <p>{submission.instructions || "No assignment instructions have been provided."}</p>
            </div>
            <label className="field-label" htmlFor="submission-response">
              Your response
            </label>
            <textarea
              id="submission-response"
              value={submissionText}
              onChange={(event) => setSubmissionText(event.target.value)}
              placeholder="Write your response here. You can revise it until the due date."
              rows={8}
              maxLength={10000}
            />
            <div className="form-hint">
              <span>Minimum 10 characters</span>
              <span>{submissionText.length}/10,000</span>
            </div>
            <div className="dialog-actions">
              <button
                className="button-secondary"
                onClick={() => setSubmission(null)}
              >
                Cancel
              </button>
              <button
                className="button-primary"
                disabled={busy || submissionText.trim().length < 10}
                onClick={() => void submitAssignment()}
              >
                {busy ? "Submitting…" : "Submit response"}{" "}
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function pageLabel(page: Page) {
  return {
    overview: "Overview",
    courses: "My learning",
    catalogue: "Course catalogue",
    materials: "Course materials",
    lectures: "Lectures",
    timetable: "Timetable",
    assessments: "Exams & assessments",
    assignments: "Assignments",
    grades: "Grades & feedback",
    progress: "Student progress",
    announcements: "Announcements",
    profile: "Student profile",
    programmes: "Programmes",
    submissions: "Submissions",
  }[page];
}

function LecturerDashboard({
  lecturerName,
  dashboard,
  courses,
  assignments,
  assessments,
  lectures,
  onNavigate,
  onOpenCourse,
}: {
  lecturerName: string;
  dashboard: LecturerDashboardData | null;
  courses: Course[];
  assignments: LecturerAssignment[];
  assessments: LecturerAssessment[];
  lectures: LecturerLecture[];
  onNavigate: (page: Page) => void;
  onOpenCourse: (id: string) => void;
}) {
  const metrics = dashboard?.metrics;
  const upcoming = [
    ...lectures.filter((item) => item.status === "published" && item.starts_at > new Date().toISOString()).map((item) => ({ id: item.id, title: item.title, course: item.course_code, at: item.starts_at, type: "Lecture" })),
    ...assessments.filter((item) => item.display_status === "scheduled").map((item) => ({ id: item.id, title: item.title, course: item.course_code, at: item.starts_at, type: "Assessment" })),
    ...assignments.filter((item) => ["open", "published"].includes(item.status) && item.due_date >= new Date().toISOString().slice(0, 10)).map((item) => ({ id: item.id, title: item.title, course: item.course_code, at: `${item.due_date}T23:59:00`, type: "Assignment" })),
  ].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 5);
  return (
    <>
      <PageIntro eyebrow="FACILITATOR WORKSPACE" title={`Welcome, ${lecturerName}`} copy="Your assigned courses, upcoming teaching, and student work." />
      <section className="metric-row staff-metrics lecturer-dashboard-metrics">
        <Metric label="Assigned courses" value={metrics?.courses ?? 0} note="Courses linked to your account" icon={BookOpen} tone="blue" />
        <Metric label="Enrolled students" value={metrics?.enrolledStudents ?? 0} note="Across your courses" icon={Users} tone="blue" />
        <Metric label="Awaiting grading" value={metrics?.awaitingGrading ?? 0} note="Submissions needing review" icon={ClipboardCheck} tone="blue" />
        <Metric label="Upcoming activities" value={(metrics?.upcomingLectures ?? 0) + (metrics?.upcomingAssessments ?? 0)} note="Lectures and assessments" icon={CalendarDays} tone="blue" />
        <Metric label="Module completions" value={`${metrics?.completedModules ?? 0}/${metrics?.totalModules ?? 0}`} note="Recorded across your courses" icon={Check} tone="blue" />
      </section>
      <div className="dashboard-grid lecturer-dashboard-grid">
        <section className="content-panel">
          <PanelHeading eyebrow="YOUR TEACHING" title="My Courses" action="All courses" onAction={() => onNavigate("courses")} />
          {courses.length === 0 ? <EmptyState text="No courses are assigned to your lecturer account." /> : courses.map((course) => <div className="lecturer-course-summary" key={course.id}><button className="lecturer-course-open" onClick={() => onOpenCourse(course.id)}><span><strong>{course.code} · {course.title}</strong><small>{course.enrolled_count} enrolled · {course.module_count} modules</small></span><ArrowRight size={16} /></button><button className="text-action" onClick={() => onNavigate("progress")}>Student progress</button></div>)}
        </section>
        <section className="content-panel">
          <PanelHeading eyebrow="STUDENT WORK" title="Recent submissions" action="Review submissions" onAction={() => onNavigate("submissions")} />
          {!dashboard?.recentSubmissions.length ? <EmptyState text="No submissions have been received for your courses." /> : dashboard.recentSubmissions.map((item) => <button className="lecturer-activity-row" key={item.id} onClick={() => onNavigate("submissions")}><span><strong>{item.assignment_title}</strong><small>{item.student_name} · {item.course_code}</small></span><i className={`status-pill ${item.grade_status === "published" ? "status-done" : item.grade_status === "draft" ? "status-review" : "status-open"}`}>{item.grade_status === "published" ? "Graded" : item.grade_status === "draft" ? "Draft" : "Awaiting grading"}</i></button>)}
        </section>
        <section className="content-panel">
          <PanelHeading eyebrow="TEACHING SCHEDULE" title="Upcoming activities" action="Lectures" onAction={() => onNavigate("lectures")} />
          {upcoming.length === 0 ? <EmptyState text="No upcoming lectures or assessments are scheduled." /> : upcoming.map((item) => <AgendaRow key={`${item.type}-${item.id}`} date={item.at.slice(0, 10)} type={`${item.type} · ${item.course}`} title={item.title} detail={formatDateTime(item.at)} />)}
        </section>
        <section className="content-panel">
          <PanelHeading eyebrow="PUBLISHED UPDATES" title="Course announcements" action="Manage announcements" onAction={() => onNavigate("announcements")} />
          {!dashboard?.recentAnnouncements.length ? <EmptyState text="No published course announcements." /> : dashboard.recentAnnouncements.map((item) => <div className="dashboard-grade-row" key={item.id}><span><strong>{item.title}</strong><small>{item.course_code} · {formatDate(item.published_at.slice(0, 10))}</small></span></div>)}
        </section>
      </div>
    </>
  );
}

function StudentDashboard({
  profile,
  courses,
  assignments,
  lectures,
  assessments,
  grades,
  announcements,
  navigate,
  openCourse,
}: {
  profile: StudentProfile | null;
  courses: Course[];
  assignments: Assignment[];
  lectures: StudentLecture[];
  assessments: Assessment[];
  grades: GradeResult[];
  announcements: Announcement[];
  navigate: (page: Page) => void;
  openCourse: (id: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const dueAssignments = assignments.filter(
    (item) => item.submission_status === "not_submitted" && item.due_date >= today,
  );
  const upcomingLectures = lectures.filter((item) => item.starts_at >= new Date().toISOString());
  const upcomingAssessments = assessments.filter((item) => item.availability === "upcoming" || item.availability === "available");
  const completedModules = courses.reduce((total, course) => total + (course.completed_modules ?? 0), 0);
  const totalModules = courses.reduce((total, course) => total + course.module_count, 0);
  return (
    <>
      <section className="student-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow-line" /> STUDENT LEARNING PORTAL</span>
          <h1>Welcome, {profile?.full_name ?? "Student"}</h1>
          <p>{profile?.programmes[0]?.name ?? "Programme not recorded"}{profile?.academic_terms[0] ? ` · ${profile.academic_terms[0]}` : ""}</p>
        </div>
        <button className="button-secondary" onClick={() => navigate("profile")}><Users size={15} /> My profile <ArrowRight size={14} /></button>
      </section>
      <section className="metric-row student-metrics">
        <Metric label="Enrolled courses" value={courses.length} note="Current enrolments" icon={BookOpen} tone="blue" />
        <Metric label="Due assignments" value={dueAssignments.length} note="Not yet submitted" icon={ClipboardCheck} tone="blue" />
        <Metric label="Upcoming assessments" value={upcomingAssessments.length} note="Scheduled" icon={CalendarDays} tone="blue" />
        <Metric label="Modules completed" value={`${completedModules}/${totalModules}`} note="Recorded course progress" icon={Check} tone="blue" />
      </section>
      <div className="dashboard-grid student-dashboard-grid">
        <section className="content-panel learning-panel">
          <PanelHeading eyebrow="CURRENT ENROLMENTS" title="My courses" action="All courses" onAction={() => navigate("courses")} />
          {courses.length === 0 ? <EmptyState text="You are not enrolled in any courses yet." /> : (
            <div className="student-course-list">
              {courses.slice(0, 4).map((course) => (
                <button className="student-course-row" key={course.id} onClick={() => openCourse(course.id)}>
                  <span className="student-course-main"><strong>{course.code} · {course.title}</strong><small>{course.programme_name} · {course.module_count} modules · {course.lecturer}</small></span>
                  <span className="student-progress-text">{course.progress_percent ?? 0}%</span><ArrowRight size={16} />
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="content-panel">
          <PanelHeading eyebrow="NEXT ON YOUR SCHEDULE" title="Coming up" action="Timetable" onAction={() => navigate("timetable")} />
          <div className="student-agenda-list">
            {dueAssignments.slice(0, 2).map((item) => <AgendaRow key={`assignment-${item.id}`} date={item.due_date} type="Assignment" title={item.title} detail={`${item.course_code} · ${item.points} points`} />)}
            {upcomingLectures.slice(0, 2).map((item) => <AgendaRow key={`lecture-${item.id}`} date={item.starts_at.slice(0, 10)} type="Lecture" title={item.title} detail={`${item.course_code} · ${formatDateTime(item.starts_at)}`} />)}
            {upcomingAssessments.slice(0, 2).map((item) => <AgendaRow key={`assessment-${item.id}`} date={item.starts_at.slice(0, 10)} type="Assessment" title={item.title} detail={`${item.course_code} · ${assessmentTypeLabel(item.assessment_type)}`} />)}
            {dueAssignments.length + upcomingLectures.length + upcomingAssessments.length === 0 && <EmptyState text="No upcoming academic activities are scheduled." />}
          </div>
        </section>
        <section className="content-panel">
          <PanelHeading eyebrow="RELEASED RESULTS" title="Recent grades" action="Grades & feedback" onAction={() => navigate("grades")} />
          {grades.length === 0 ? <EmptyState text="Published grades and feedback will appear here." /> : grades.slice(0, 3).map((grade) => <div className="dashboard-grade-row" key={grade.id}><span><strong>{grade.assessment}</strong><small>{grade.course_code} · {grade.feedback || "No written feedback"}</small></span><b>{grade.score}/{grade.max_score}</b></div>)}
        </section>
        <section className="content-panel">
          <PanelHeading eyebrow="LATEST UPDATES" title="Announcements" action="All announcements" onAction={() => navigate("announcements")} />
          {announcements.length === 0 ? <EmptyState text="There are no published announcements for your courses." /> : announcements.slice(0, 3).map((item) => <div className="dashboard-grade-row" key={item.id}><span><strong>{item.title}</strong><small>{item.course_code ?? "University"} · {formatDate(item.published_at.slice(0, 10))}</small></span></div>)}
        </section>
      </div>
    </>
  );
}

function AgendaRow({ date, type, title, detail }: { date: string; type: string; title: string; detail: string }) {
  return <div className="student-agenda-row"><span className="agenda-date"><strong>{new Date(`${date}T12:00:00`).getDate()}</strong><small>{new Date(`${date}T12:00:00`).toLocaleString("en", { month: "short" }).toUpperCase()}</small></span><span className="student-agenda-copy"><small>{type}</small><strong>{title}</strong><span>{detail}</span></span></div>;
}

function CourseMaterials({ materials }: { materials: StudentMaterial[] }) {
  return <>
    <PageIntro eyebrow="ENROLLED COURSE RESOURCES" title="Course materials" copy="Resources are grouped by enrolled course and module." />
    {materials.length === 0 ? <div className="content-panel"><EmptyState text="No learning materials are available for your enrolled courses yet." /></div> : <div className="content-panel material-list">{materials.map((material) => {
      const resourceUrl = safeResourceUrl(material.resource_url);
      return <div className="material-item" key={material.id}><span className="assignment-file"><FileText size={17} /></span><span className="material-copy"><strong>{material.title}</strong><small>{material.course_code} · {material.course_title} · {material.module_title}</small><small>{material.kind}{material.duration ? ` · ${material.duration}` : ""}{material.file_name ? ` · ${material.file_name}` : ""}</small></span>{resourceUrl ? <a className="button-row-action material-link" href={resourceUrl} target="_blank" rel="noreferrer">Open resource <ArrowRight size={14} /></a> : <span className="unavailable-resource">File not attached</span>}</div>;
    })}</div>}
  </>;
}

function LecturesPage({ lectures }: { lectures: StudentLecture[] }) {
  return <>
    <PageIntro eyebrow="TEACHING SCHEDULE" title="Lectures" copy="Lecture times and resources published for your enrolled courses." />
    {lectures.length === 0 ? <div className="content-panel"><EmptyState text="No lectures have been scheduled or published for your courses." /></div> : <div className="content-panel student-record-list">{lectures.map((lecture) => <article className="lecture-record" key={lecture.id}><div className="record-topline"><span className="course-code">{lecture.course_code} · {lecture.course_title}</span><span className="record-date">{formatDateTime(lecture.starts_at)} – {formatClock(lecture.ends_at)}</span></div><h2>{lecture.title}</h2><p>{lecture.description || "No lecture description provided."}</p><div className="record-meta"><span>Facilitator: {lecture.facilitator || "Not recorded"}</span><span>Location: {lecture.location || "Not recorded"}</span></div><div className="record-links">{lecture.meeting_url && safeResourceUrl(lecture.meeting_url) ? <a href={safeResourceUrl(lecture.meeting_url) ?? undefined} target="_blank" rel="noreferrer">Join online session <ArrowRight size={14} /></a> : <span>No online meeting link</span>}{lecture.recording_url && safeResourceUrl(lecture.recording_url) ? <a href={safeResourceUrl(lecture.recording_url) ?? undefined} target="_blank" rel="noreferrer">Open recording <ArrowRight size={14} /></a> : <span>No recording available</span>}</div></article>)}</div>}
  </>;
}

function TimetablePage({ timetable }: { timetable: Timetable | null }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${timetable?.week_start ?? getWeekStart()}T12:00:00`);
    date.setDate(date.getDate() + index);
    return date;
  });
  return <>
    <PageIntro eyebrow="WEEKLY VIEW" title="Timetable" copy={timetable ? `${formatDate(timetable.week_start)} – ${formatDate(timetable.week_end)}` : "Your weekly academic schedule."} />
    <div className="content-panel timetable-grid">{days.map((day) => {const dayKey = day.toISOString().slice(0, 10); const events = timetable?.events.filter((event) => event.starts_at.slice(0, 10) === dayKey) ?? []; return <section className="timetable-day" key={dayKey}><h2>{day.toLocaleDateString("en", { weekday: "short" })}<span>{day.getDate()}</span></h2>{events.length === 0 ? <p>No activities</p> : events.map((event) => <article className="timetable-event" key={`${event.event_type}-${event.id}`}><small>{formatClock(event.starts_at)} · {event.event_type}</small><strong>{event.title}</strong><span>{event.course_code}</span><span>{event.location || "Location not recorded"}</span>{event.meeting_url && safeResourceUrl(event.meeting_url) && <a href={safeResourceUrl(event.meeting_url) ?? undefined} target="_blank" rel="noreferrer">Meeting link</a>}</article>)}</section>;})}</div>
  </>;
}

function AssessmentsPage({ assessments, onOpen }: { assessments: Assessment[]; onOpen: (assessment: Assessment) => void }) {
  return <>
    <PageIntro eyebrow="EXAMINATIONS AND COURSEWORK" title="Exams & assessments" copy="Assessment schedules and published results for your enrolled courses." />
    <div className="info-banner"><ClipboardCheck size={17} /><span>Online exam-taking is not available in this version. Assessment availability reflects the scheduled start and end times.</span></div>
    <div className="content-panel assessment-list">{assessments.length === 0 ? <EmptyState text="No examinations or assessments have been scheduled for your courses." /> : assessments.map((assessment) => <button className="assessment-record" key={assessment.id} onClick={() => onOpen(assessment)}><span className="assessment-record-main"><small>{assessment.course_code} · {assessmentTypeLabel(assessment.assessment_type)}</small><strong>{assessment.title}</strong><span>{formatDateTime(assessment.starts_at)} · {assessment.duration_minutes ? `${assessment.duration_minutes} minutes` : "Duration not recorded"}</span></span><span className={`status-pill ${assessment.availability === "available" ? "status-review" : assessment.availability === "closed" || assessment.availability === "cancelled" ? "status-done" : "status-open"}`}>{assessment.availability === "available" ? "Available" : assessment.availability === "closed" ? "Closed" : assessment.availability === "cancelled" ? "Cancelled" : "Upcoming"}</span><ArrowRight size={16} /></button>)}</div>
  </>;
}

function AssessmentDetail({ assessment, close }: { assessment: Assessment; close: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) close();}}><section className="dialog review-dialog" role="dialog" aria-modal="true" aria-labelledby="assessment-title"><div className="dialog-top"><div><span className="eyebrow">{assessment.course_code} · {assessmentTypeLabel(assessment.assessment_type)}</span><h2 id="assessment-title">{assessment.title}</h2></div><button className="icon-button" onClick={close} aria-label="Close assessment details"><X size={19} /></button></div><div className="review-meta"><span><strong>Date and time</strong>{formatDateTime(assessment.starts_at)} – {formatClock(assessment.ends_at)}</span><span><strong>Duration</strong>{assessment.duration_minutes ? `${assessment.duration_minutes} minutes` : "Not recorded"}</span><span><strong>Status</strong>{assessment.availability}</span></div><h3 className="review-response-heading">Instructions</h3><div className="review-response">{assessment.instructions || "No instructions have been published."}</div>{assessment.location && <p className="record-meta">Location: {assessment.location}</p>}{assessment.grade !== null && <div className="info-banner"><Check size={16} /><span>Published result: {assessment.grade}/{assessment.max_score}{assessment.feedback ? ` · ${assessment.feedback}` : ""}</span></div>}{assessment.availability === "available" && <div className="info-banner"><ShieldCheck size={16} /><span>This assessment is within its scheduled time. An online attempt is not available in this version; follow the published instructions and location.</span></div>}<div className="dialog-actions"><button className="button-secondary" onClick={close}>Close</button></div></section></div>;
}

function GradesPage({ grades }: { grades: GradeResult[] }) {
  return <><PageIntro eyebrow="PUBLISHED RESULTS" title="Grades & feedback" copy="Only grades and feedback released by your facilitator are shown." /><div className="content-panel grade-list">{grades.length === 0 ? <EmptyState text="Published grades and feedback will appear here when released." /> : <div className="assignment-table"><div className="assignment-table-head"><span>ASSESSMENT</span><span>COURSE</span><span>RESULT</span><span>PUBLISHED</span></div>{grades.map((grade) => <div className="grade-record" key={`${grade.result_type}-${grade.id}`}><span><strong>{grade.assessment}</strong><small>{assessmentTypeLabel(grade.result_type)}</small></span><span>{grade.course_code}<small>{grade.course_title}</small></span><strong>{grade.score}/{grade.max_score}</strong><span>{formatDate(grade.published_at.slice(0, 10))}<small>{grade.feedback || "No written feedback"}</small></span></div>)}</div>}</div></>;
}

function AnnouncementsPage({ announcements }: { announcements: Announcement[] }) {
  return <><PageIntro eyebrow="CAMPUS UPDATES" title="Announcements" copy="University news and updates for your enrolled courses." />{announcements.length === 0 ? <div className="content-panel"><EmptyState text="There are no published university or course announcements." /></div> : <div className="content-panel student-record-list">{announcements.map((item) => <article className="announcement-record" key={item.id}><span className="eyebrow">{item.announcement_type === "course" ? `${item.course_code} · ${item.course_title}` : "UNIVERSITY ANNOUNCEMENT"} · {formatDate(item.published_at.slice(0, 10))}</span><h2>{item.title}</h2><p>{item.body}</p></article>)}</div>}</>;
}

function StudentProfilePage({ profile, courses }: { profile: StudentProfile | null; courses: Course[] }) {
  return <><PageIntro eyebrow="STUDENT RECORD" title="My profile" copy="Profile information currently available in your academic account." /><section className="content-panel profile-panel"><div className="profile-field"><span>Full name</span><strong>{profile?.full_name ?? "Not recorded"}</strong></div><div className="profile-field"><span>Student number</span><strong>{profile?.student_number ?? "Not recorded"}</strong></div><div className="profile-field"><span>Email</span><strong>{profile?.email ?? "Not recorded"}</strong></div><div className="profile-field"><span>Programme</span><strong>{profile?.programmes.map((item) => `${item.name} (${item.award})`).join(", ") || "Not recorded"}</strong></div><div className="profile-field"><span>Academic year / semester</span><strong>{profile?.academic_terms.join(", ") || "Not recorded"}</strong></div><div className="profile-enrolments"><h2>Enrolled courses</h2>{courses.length === 0 ? <EmptyState text="No courses are currently linked to this profile." /> : courses.map((course) => <div key={course.id}><strong>{course.code}</strong><span>{course.title}</span></div>)}</div></section></>;
}

function safeResourceUrl(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.protocol === "https:" || parsed.origin === window.location.origin) return parsed.href;
  } catch {
    return null;
  }
  return null;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
}
function formatClock(value: string) {
  return new Date(value).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
}
function assessmentTypeLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function getWeekStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function Overview({
  role,
  person,
  metrics,
  enrolled,
  courses,
  assignments,
  programmes,
  submissions,
  openCourse,
  openSubmission,
  navigate,
}: {
  role: Role;
  person: (typeof roleInfo)[Role];
  metrics: Metrics | null;
  enrolled: Course[];
  courses: Course[];
  assignments: Assignment[];
  programmes: Programme[];
  submissions: Submission[];
  openCourse: (id: string) => void;
  openSubmission: (id: number) => void;
  navigate: (page: Page) => void;
}) {
  const heading =
    role === "student"
      ? "Your learning, in focus."
      : role === "lecturer"
        ? "Good morning, James."
        : "Academic overview.";
  const greeting =
    role === "student"
      ? "A steady rhythm makes meaningful progress. Here’s where you are this week."
      : role === "lecturer"
        ? "Here is what needs your attention across your teaching this week."
        : "A clear view of learning activity across the institute.";
  const openAssignments = assignments.filter((item) => !item.submitted_at);
  const upcoming = openAssignments[0];
  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> THURSDAY, 05 NOVEMBER 2026
          </div>
          <h1>{heading}</h1>
          <p>{greeting}</p>
        </div>
        <button
          className="button-secondary calendar-button"
          onClick={() => navigate("assignments")}
        >
          <CalendarDays size={16} /> Assessment schedule{" "}
          <ArrowRight size={15} />
        </button>
      </section>
      {role === "student" ? (
        <>
          <section className="student-hero">
            <div className="hero-text">
              <span className="hero-kicker">YOUR TERM AT A GLANCE</span>
              <h2>
                Small steps.
                <br />
                <em>Lasting impact.</em>
              </h2>
              <p>
                You’re building the knowledge to make a difference in your
                community.
              </p>
              <button
                className="hero-button"
                onClick={() => navigate("courses")}
              >
                Continue learning <ArrowRight size={16} />
              </button>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="hero-orbit orbit-one" />
              <div className="hero-orbit orbit-two" />
              <div className="hero-disc">
                <BookOpen size={54} strokeWidth={1.2} />
              </div>
              <div className="hero-note note-top">
                <span>TERM 2</span>
                <strong>2026</strong>
              </div>
              <div className="hero-note note-bottom">
                <span>PROGRAMME</span>
                <strong>Public health</strong>
              </div>
              <div className="hero-dot dot-one" />
              <div className="hero-dot dot-two" />
            </div>
            <div className="hero-index">
              <span>01</span>
              <i />
              <span>03</span>
            </div>
          </section>
          <section className="metric-row">
            <Metric
              label="Enrolled courses"
              value={enrolled.length}
              note="This term"
              icon={BookOpen}
              tone="green"
            />
            <Metric
              label="Open assignments"
              value={openAssignments.length}
              note="Awaiting submission"
              icon={ClipboardCheck}
              tone="coral"
            />
            <Metric
              label="Submitted work"
              value={assignments.filter((item) => item.submitted_at).length}
              note="This term"
              icon={Check}
              tone="blue"
            />
            <Metric
              label="Available modules"
              value={enrolled.reduce(
                (total, course) => total + course.module_count,
                0,
              )}
              note="Across enrolled courses"
              icon={FileText}
              tone="yellow"
            />
          </section>
          <div className="dashboard-grid">
            <section className="content-panel learning-panel">
              <PanelHeading
                eyebrow="YOUR ENROLLED COURSES"
                title="Continue learning"
                action="All my courses"
                onAction={() => navigate("courses")}
              />
              <div className="learning-list">
                {enrolled.slice(0, 3).map((course, index) => (
                  <button
                    className="learning-item"
                    key={course.id}
                    onClick={() => openCourse(course.id)}
                  >
                    <span className={`course-index index-${index + 1}`}>
                      0{index + 1}
                    </span>
                    <span className="learning-copy">
                      <span className="course-code">
                        {course.code} <i /> {course.credits} credits
                      </span>
                      <strong>{course.title}</strong>
                      <span className="staff-item-sub">
                        {course.module_count} learning modules ·{" "}
                        {course.programme_name}
                      </span>
                    </span>
                    <ArrowRight className="row-arrow" size={17} />
                  </button>
                ))}
              </div>
            </section>
            <section className="content-panel due-panel">
              <PanelHeading
                eyebrow="KEEP YOUR MOMENTUM"
                title="Coming up"
                action="View assignments"
                onAction={() => navigate("assignments")}
              />
              <div className="due-list">
                {openAssignments.slice(0, 3).map((assignment) => (
                  <div className="due-item" key={assignment.id}>
                    <div className="due-date">
                      <strong>
                        {new Date(`${assignment.due_date}T12:00:00`).getDate()}
                      </strong>
                      <span>
                        {new Date(`${assignment.due_date}T12:00:00`)
                          .toLocaleString("en", { month: "short" })
                          .toUpperCase()}
                      </span>
                    </div>
                    <div className="due-copy">
                      <strong>{assignment.title}</strong>
                      <span>
                        {assignment.course_code} · {assignment.points} points
                      </span>
                    </div>
                    <span className="due-status">
                      {daysLeft(assignment.due_date)}
                    </span>
                  </div>
                ))}
                {openAssignments.length === 0 && (
                  <EmptyState text="All caught up. Your next assignment will appear here." />
                )}
              </div>
              {upcoming && (
                <div className="next-deadline">
                  <Clock3 size={15} /> Next deadline{" "}
                  <strong>{formatDate(upcoming.due_date)}</strong>
                </div>
              )}
            </section>
          </div>
        </>
      ) : (
        <>
          <section className="staff-banner">
            <div>
              <span className="hero-kicker">
                {role === "lecturer"
                  ? "TEACHING SPACE"
                  : "INSTITUTIONAL SNAPSHOT"}
              </span>
              <h2>
                {role === "lecturer"
                  ? "Make room for better questions."
                  : "Learning is moving forward."}
              </h2>
              <p>
                {role === "lecturer"
                  ? "A thoughtful course experience begins with a clear next step."
                  : "A snapshot of programmes, teaching, and student activity."}
              </p>
            </div>
            <div className="staff-mark">
              <GraduationCap size={62} strokeWidth={1.15} />
            </div>
          </section>
          {role === "admin" && (
            <div className="info-banner">
              <ShieldCheck size={17} />
              <span>
                Aggregate overview only. User, course, and enrolment management screens are not implemented.
              </span>
            </div>
          )}
          <section className="metric-row staff-metrics">
            {role === "lecturer" ? (
              <>
                <Metric
                  label="Courses you teach"
                  value={metrics?.taughtCourses ?? 0}
                  note="Assigned to your profile"
                  icon={BookOpen}
                  tone="green"
                />
                <Metric
                  label="Submissions saved"
                  value={metrics?.submissions ?? 0}
                  note="Grading tools unavailable"
                  icon={ClipboardCheck}
                  tone="coral"
                />
                <Metric
                  label="Enrolled learners"
                  value={metrics?.enrollments ?? 0}
                  note="Active this term"
                  icon={Users}
                  tone="blue"
                />
                <Metric
                  label="Open assessments"
                  value={metrics?.pendingAssignments ?? 0}
                  note="Current term"
                  icon={FileText}
                  tone="yellow"
                />
              </>
            ) : (
              <>
                <Metric
                  label="Programmes"
                  value={metrics?.programmes ?? 0}
                  note="Active catalogue"
                  icon={GraduationCap}
                  tone="green"
                />
                <Metric
                  label="Courses"
                  value={metrics?.courses ?? 0}
                  note="Across programmes"
                  icon={BookOpen}
                  tone="coral"
                />
                <Metric
                  label="Students"
                  value={metrics?.students ?? 0}
                  note="Registered learners"
                  icon={Users}
                  tone="blue"
                />
                <Metric
                  label="Lecturers"
                  value={metrics?.lecturers ?? 0}
                  note="Academic staff"
                  icon={LibraryBig}
                  tone="yellow"
                />
              </>
            )}
          </section>
          <div className="dashboard-grid">
            <section className="content-panel learning-panel">
              <PanelHeading
                eyebrow={
                  role === "lecturer" ? "YOUR TEACHING" : "ACADEMIC CATALOGUE"
                }
                title={role === "lecturer" ? "Course spaces" : "Programmes"}
                action={
                  role === "lecturer" ? "Browse courses" : "View programmes"
                }
                onAction={() =>
                  navigate(role === "lecturer" ? "courses" : "programmes")
                }
              />
              <div className="learning-list">
                {(role === "lecturer"
                  ? courses
                      .filter(
                        (course) => course.lecturer === roleInfo.lecturer.name,
                      )
                      .slice(0, 3)
                  : programmes.slice(0, 3)
                ).map((item, index) => (
                  <button
                    className="learning-item staff-learning-item"
                    key={item.id}
                    onClick={() =>
                      "code" in item
                        ? openCourse(item.id)
                        : navigate("programmes")
                    }
                  >
                    <span className={`course-index index-${index + 1}`}>
                      0{index + 1}
                    </span>
                    <span className="learning-copy">
                      {"code" in item ? (
                        <span className="course-code">
                          {item.code} <i /> {item.credits} credits
                        </span>
                      ) : (
                        <span className="course-code">
                          {item.award} <i /> {item.duration}
                        </span>
                      )}
                      <strong>{"code" in item ? item.title : item.name}</strong>
                      <span className="staff-item-sub">
                        {"code" in item
                          ? item.programme_name
                          : `${item.course_count} courses in programme`}
                      </span>
                    </span>
                    <ArrowRight className="row-arrow" size={17} />
                  </button>
                ))}
              </div>
            </section>
            <section className="content-panel due-panel">
              <PanelHeading
                eyebrow="ACADEMIC ACTIVITY"
                title={
                  role === "lecturer" ? "Recent submissions" : "Quick access"
                }
                action={
                  role === "lecturer" && submissions.length > 0
                    ? "View all"
                    : undefined
                }
                onAction={() => navigate("submissions")}
              />
              <div className="activity-list">
                {role === "lecturer" ? (
                  <>
                    {submissions.slice(0, 2).map((item) => (
                      <button
                        className="submission-shortcut"
                        key={item.id}
                        onClick={() => openSubmission(item.id)}
                      >
                        <Activity
                          icon={FileText}
                          title={item.assignment_title}
                          detail={`${item.student_name} · ${item.course_code}`}
                        />
                      </button>
                    ))}
                    {submissions.length === 0 && (
                      <EmptyState text="No student submissions yet." />
                    )}
                    <Activity
                      icon={CalendarDays}
                      title="Next assessment due"
                      detail={
                        assignments[0]
                          ? `${assignments[0].title} · ${formatDate(assignments[0].due_date)}`
                          : "No upcoming assessments"
                      }
                    />
                  </>
                ) : (
                  <>
                    <Activity
                      icon={Users}
                      title="Student records"
                      detail={`${metrics?.students ?? 0} registered learner`}
                    />
                    <Activity
                      icon={ShieldCheck}
                      title="Academic governance"
                      detail="Programme and course records"
                    />
                    <Activity
                      icon={ClipboardCheck}
                      title="Assessment overview"
                      detail={`${metrics?.pendingAssignments ?? 0} open assessments`}
                    />
                  </>
                )}
              </div>
            </section>
          </div>
        </>
      )}
      <div className="dashboard-footnote">
        <ShieldCheck size={15} />
        <span>Academic records are for authorised learning purposes.</span>
        <span className="footnote-person">
          Welcome back, {person.name.split(" ")[0]}.
        </span>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof BookOpen;
  tone: string;
}) {
  return (
    <div className="metric">
      <div className={`metric-icon ${tone}`}>
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

function PanelHeading({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="panel-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="text-action" onClick={onAction}>
          {action}
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}

function CourseListing({
  role,
  courses,
  allCourses,
  search,
  busy,
  openCourse,
  enroll,
  catalogueMode = false,
}: {
  role: Role;
  courses: Course[];
  allCourses: Course[];
  search: string;
  busy: boolean;
  openCourse: (id: string) => void;
  enroll: (course: Course) => void;
  catalogueMode?: boolean;
}) {
  const isStudent = role === "student";
  const roleCourses = isStudent
    ? allCourses
    : role === "lecturer"
      ? courses.filter((course) => course.lecturer === roleInfo.lecturer.name)
      : courses;
  const list = roleCourses.filter((course) =>
    `${course.title} ${course.code} ${course.programme_name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const enrolledIds = new Set(courses.map((course) => course.id));
  return (
    <>
      <PageIntro
        eyebrow={catalogueMode ? "AVAILABLE COURSES" : isStudent ? "STUDENT LEARNING" : "TEACHING CATALOGUE"}
        title={catalogueMode ? "Course catalogue" : isStudent ? "My courses" : "Course catalogue"}
        copy={
          catalogueMode
            ? "Explore available courses. Enrolment is recorded to your student account."
            : isStudent
              ? "Courses you are enrolled in this term."
              : "Course spaces, teaching teams, and learning structure for the current term."
        }
      />
      <div className="listing-toolbar">
        <span>
          {catalogueMode
            ? `${allCourses.length} available courses`
            : isStudent
              ? `${courses.length} courses enrolled`
              : `${courses.length} courses`}
          <i /> {catalogueMode ? "Course catalogue" : "Term 2 · 2026"}
        </span>
        <span className="catalogue-note">
          <Search size={15} /> Use the search above to filter courses
        </span>
      </div>
      <div className="course-grid">
        {list.map((course, index) => (
          <article className="course-card" key={course.id}>
            <div className={`course-card-art art-${index % 3}`}>
              <span className="art-code">{course.code}</span>
              <div className="course-art-icon">
                {index % 2 ? (
                  <ClipboardCheck size={29} />
                ) : (
                  <BookOpen size={29} />
                )}
              </div>
              <span className="course-credits">{course.credits} CREDITS</span>
            </div>
            <div className="course-card-content">
              <span className="course-card-programme">
                {course.programme_name}
              </span>
              <h2>{course.title}</h2>
              <p>{course.description}</p>
              <div className="course-card-meta">
                <span>
                  <Users size={14} /> {course.enrolled_count} learners
                </span>
                <span>
                  <FileText size={14} /> {course.module_count} modules
                </span>
              </div>
              <div className="course-card-bottom">
                <span className="instructor-avatar">
                  {course.lecturer.split(" ").slice(-1)[0].slice(0, 1)}
                </span>
                <span className="instructor-name">{course.lecturer}</span>
                {isStudent && !enrolledIds.has(course.id) ? (
                  <button
                    className="small-enroll"
                    disabled={busy}
                    onClick={() => enroll(course)}
                  >
                    Enrol <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    className="icon-button course-open"
                    onClick={() => openCourse(course.id)}
                    aria-label={`Open ${course.title}`}
                  >
                    <ArrowRight size={18} />
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {list.length === 0 && (
        <EmptyState
          text={
            search
              ? "No courses match that search."
              : "No courses are available yet."
          }
        />
      )}
    </>
  );
}

function LecturerMaterialsPage({
  courses,
  materials,
  busy,
  onSave,
  onDelete,
}: {
  courses: Course[];
  materials: LecturerMaterial[];
  busy: boolean;
  onSave: (material: Record<string, unknown>, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string>();
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState<CourseDetail["modules"]>([]);
  const [form, setForm] = useState({ courseId: courses[0]?.id ?? "", moduleId: "", title: "", kind: "Reading", description: "", duration: "", resourceUrl: "", fileName: "", mimeType: "", status: "draft" as "draft" | "published" });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!form.courseId) return;
    void getJson<CourseDetail>(`/courses/${form.courseId}`)
      .then((course) => setModules(course.modules))
      .catch((error) => setFormError(error instanceof Error ? error.message : "Could not load course modules."));
  }, [form.courseId]);

  function startCreate() {
    setEditingId(undefined);
    setForm({ courseId: courses[0]?.id ?? "", moduleId: "", title: "", kind: "Reading", description: "", duration: "", resourceUrl: "", fileName: "", mimeType: "", status: "draft" });
    setFormError("");
    setOpen(true);
  }

  function startEdit(material: LecturerMaterial) {
    setEditingId(material.id);
    setForm({ courseId: material.course_id, moduleId: material.module_id, title: material.title, kind: material.kind, description: material.description, duration: material.duration ?? "", resourceUrl: material.resource_url ?? "", fileName: material.file_name ?? "", mimeType: material.mime_type ?? "", status: material.status });
    setFormError("");
    setOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    try {
      await onSave({ ...form, duration: form.duration || null, fileName: form.fileName || null, mimeType: form.mimeType || null, resourceUrl: form.resourceUrl || null }, editingId);
      setOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save material.");
    }
  }

  return <>
    <PageIntro eyebrow="COURSE CONTENT" title="Course Materials" copy="Manage learning resources for courses assigned to your lecturer account. File upload is not configured; add a secure resource link instead." />
    <div className="lecturer-toolbar"><span>{materials.length} materials</span><button className="button-primary" onClick={startCreate}>Add material <ArrowRight size={14} /></button></div>
    {materials.length === 0 ? <div className="content-panel"><EmptyState text="No materials have been added to your assigned courses." /></div> : <div className="content-panel lecturer-record-list">{materials.map((material) => <div className="lecturer-managed-row" key={material.id}><span className="assignment-file"><FileText size={17} /></span><span className="lecturer-managed-main"><strong>{material.title}</strong><small>{material.course_code} · {material.module_title} · {material.kind}</small><small>{material.description || "No description"} {material.resource_url ? `· ${material.resource_url}` : "· File not attached"}</small></span><i className={`status-pill ${material.status === "published" ? "status-done" : "status-review"}`}>{material.status}</i><button className="button-secondary compact-action" onClick={() => startEdit(material)}>Edit</button><button className="button-secondary compact-action" disabled={busy} onClick={() => void onDelete(material.id)}>Remove</button></div>)}</div>}
    {open && <div className="modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) setOpen(false);}}><form className="dialog lecturer-form-dialog" onSubmit={(event) => void submit(event)}><div className="dialog-top"><h2>{editingId ? "Edit material" : "Add course material"}</h2><button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button></div><label className="field-label">Course<select required value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value, moduleId: "" })}>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label><label className="field-label">Module or topic<select required value={form.moduleId} onChange={(event) => setForm({ ...form, moduleId: event.target.value })}><option value="">Select a module</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label><label className="field-label">Title<input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field-label">Resource type<input required maxLength={80} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })} placeholder="PDF, Reading, Lecture notes, External link" /></label><label className="field-label">Description<textarea maxLength={5000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="field-label">Resource URL<input type="url" value={form.resourceUrl} onChange={(event) => setForm({ ...form, resourceUrl: event.target.value })} placeholder="https://…" /></label><div className="form-two-columns"><label className="field-label">File name<input value={form.fileName} onChange={(event) => setForm({ ...form, fileName: event.target.value })} /></label><label className="field-label">Duration / pages<input value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} /></label></div><label className="field-label">Publication<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as "draft" | "published" })}><option value="draft">Draft</option><option value="published">Published</option></select></label>{formError && <p className="field-error" role="alert">{formError}</p>}<div className="dialog-actions"><button className="button-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="button-primary" disabled={busy || !courses.length || !form.moduleId}>{busy ? "Saving…" : "Save material"}</button></div></form></div>}
  </>;
}

function LecturerLecturesPage({
  courses,
  lectures,
  busy,
  onSave,
}: {
  courses: Course[];
  lectures: LecturerLecture[];
  busy: boolean;
  onSave: (lecture: Record<string, unknown>, id?: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string>();
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState<CourseDetail["modules"]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ courseId: courses[0]?.id ?? "", moduleId: "", title: "", startsAt: "", endsAt: "", facilitator: "", description: "", location: "", meetingUrl: "", recordingUrl: "", status: "draft" as LecturerLecture["status"] });

  useEffect(() => {
    if (!form.courseId) return;
    void getJson<CourseDetail>(`/courses/${form.courseId}`).then((course) => setModules(course.modules)).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load course modules."));
  }, [form.courseId]);

  function edit(lecture?: LecturerLecture) {
    setEditingId(lecture?.id);
    setForm({
      courseId: lecture?.course_id ?? courses[0]?.id ?? "",
      moduleId: lecture?.module_id ?? "",
      title: lecture?.title ?? "",
      startsAt: lecture?.starts_at ? toDateTimeLocal(lecture.starts_at) : "",
      endsAt: lecture?.ends_at ? toDateTimeLocal(lecture.ends_at) : "",
      facilitator: lecture?.facilitator ?? "",
      description: lecture?.description ?? "",
      location: lecture?.location ?? "",
      meetingUrl: lecture?.meeting_url ?? "",
      recordingUrl: lecture?.recording_url ?? "",
      status: lecture?.status ?? "draft",
    });
    setError("");
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await onSave({
        ...form,
        moduleId: form.moduleId || null,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        facilitator: form.facilitator || undefined,
        location: form.location || null,
        meetingUrl: form.meetingUrl || null,
        recordingUrl: form.recordingUrl || null,
      }, editingId);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save lecture.");
    }
  }

  return <>
    <PageIntro eyebrow="TEACHING SCHEDULE" title="Lectures" copy="Schedule and publish lectures for courses assigned to your account." />
    <div className="lecturer-toolbar"><span>{lectures.length} lectures</span><button className="button-primary" onClick={() => edit()}>Schedule lecture <ArrowRight size={14} /></button></div>
    {lectures.length === 0 ? <div className="content-panel"><EmptyState text="No lectures have been scheduled for your assigned courses." /></div> : <div className="content-panel lecturer-record-list">{lectures.map((lecture) => <article className="lecturer-managed-row" key={lecture.id}><span className="assignment-file"><CalendarDays size={17} /></span><span className="lecturer-managed-main"><strong>{lecture.title}</strong><small>{lecture.course_code} · {lecture.course_title}{lecture.module_title ? ` · ${lecture.module_title}` : ""}</small><small>{formatDateTime(lecture.starts_at)} – {formatClock(lecture.ends_at)} · {lecture.location || "Location not set"}</small></span><i className={`status-pill ${lecture.status === "published" ? "status-done" : lecture.status === "cancelled" ? "status-open" : "status-review"}`}>{lecture.status}</i><button className="button-secondary compact-action" onClick={() => edit(lecture)}>Edit</button></article>)}</div>}
    {open && <div className="modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) setOpen(false);}}><form className="dialog lecturer-form-dialog" onSubmit={(event) => void submit(event)}><div className="dialog-top"><h2>{editingId ? "Edit lecture" : "Schedule lecture"}</h2><button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button></div><label className="field-label">Course<select required value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value, moduleId: "" })}>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label><label className="field-label">Module or topic<select value={form.moduleId} onChange={(event) => setForm({ ...form, moduleId: event.target.value })}><option value="">No specific module</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label><label className="field-label">Lecture title<input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><div className="form-two-columns"><label className="field-label">Start date and time<input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label><label className="field-label">End date and time<input required type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label></div><label className="field-label">Facilitator<input maxLength={200} value={form.facilitator} onChange={(event) => setForm({ ...form, facilitator: event.target.value })} placeholder="Defaults to your lecturer name" /></label><label className="field-label">Description<textarea rows={3} maxLength={5000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="field-label">Venue<input maxLength={200} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><div className="form-two-columns"><label className="field-label">Online meeting URL<input type="url" value={form.meetingUrl} onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })} /></label><label className="field-label">Recording URL<input type="url" value={form.recordingUrl} onChange={(event) => setForm({ ...form, recordingUrl: event.target.value })} /></label></div><label className="field-label">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LecturerLecture["status"] })}><option value="draft">Draft</option><option value="published">Published</option><option value="cancelled">Cancelled</option></select></label>{error && <p className="field-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="button-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="button-primary" disabled={busy || !courses.length}>{busy ? "Saving…" : "Save lecture"}</button></div></form></div>}
  </>;
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function LecturerAssignmentsPage({
  courses,
  assignments,
  busy,
  onSave,
}: {
  courses: Course[];
  assignments: LecturerAssignment[];
  busy: boolean;
  onSave: (assignment: Record<string, unknown>, id?: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string>();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ courseId: courses[0]?.id ?? "", title: "", dueDate: "", points: "", instructions: "", status: "draft" as "draft" | "published" | "closed" });
  function edit(assignment?: LecturerAssignment) {
    setEditingId(assignment?.id);
    setForm({ courseId: assignment?.course_id ?? courses[0]?.id ?? "", title: assignment?.title ?? "", dueDate: assignment?.due_date ?? "", points: assignment ? String(assignment.points) : "", instructions: assignment?.instructions ?? "", status: assignment?.status === "open" ? "published" : assignment?.status ?? "draft" });
    setError("");
    setOpen(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await onSave({ ...form, points: Number(form.points) }, editingId);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save assignment.");
    }
  }
  return <>
    <PageIntro eyebrow="COURSEWORK MANAGEMENT" title="Assignments" copy="Create and manage assignments only for courses assigned to your lecturer account." />
    <div className="lecturer-toolbar"><span>{assignments.length} assignments</span><button className="button-primary" onClick={() => edit()}>Create assignment <ArrowRight size={14} /></button></div>
    {assignments.length === 0 ? <div className="content-panel"><EmptyState text="No assignments have been created for your courses." /></div> : <div className="content-panel lecturer-record-list">{assignments.map((item) => <article className="lecturer-managed-row assignment-manager-row" key={item.id}><span className="assignment-file"><ClipboardCheck size={17} /></span><span className="lecturer-managed-main"><strong>{item.title}</strong><small>{item.course_code} · Due {formatDate(item.due_date)} · {item.points} marks</small><small>{item.enrolled_count} enrolled · {item.submitted_count} submitted · {item.graded_count} graded · {item.late_count} late</small></span><i className={`status-pill ${item.status === "published" || item.status === "open" ? "status-done" : item.status === "closed" ? "status-open" : "status-review"}`}>{item.status === "open" ? "Published" : item.status}</i><button className="button-secondary compact-action" onClick={() => edit(item)}>Edit</button></article>)}</div>}
    {open && <div className="modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) setOpen(false);}}><form className="dialog lecturer-form-dialog" onSubmit={(event) => void submit(event)}><div className="dialog-top"><h2>{editingId ? "Edit assignment" : "Create assignment"}</h2><button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button></div><label className="field-label">Assigned course<select required value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })}>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label><label className="field-label">Assignment title<input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field-label">Instructions<textarea required rows={5} maxLength={10000} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label><div className="form-two-columns"><label className="field-label">Due date<input required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label><label className="field-label">Maximum marks<input required type="number" min="1" max="10000" step="1" value={form.points} onChange={(event) => setForm({ ...form, points: event.target.value })} /></label></div><label className="field-label">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as typeof form.status })}><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select></label>{error && <p className="field-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="button-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="button-primary" disabled={busy || !courses.length}>{busy ? "Saving…" : "Save assignment"}</button></div></form></div>}
  </>;
}

function LecturerSubmissionsPage({
  courses,
  assignments,
  submissions,
  onOpen,
  roster,
  loadingRoster,
  onLoadRoster,
}: {
  courses: Course[];
  assignments: LecturerAssignment[];
  submissions: Submission[];
  onOpen: (id: number) => void;
  roster: StudentProgress[];
  loadingRoster: boolean;
  onLoadRoster: (courseId: string) => Promise<void>;
}) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [assignmentId, setAssignmentId] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (courseId) void onLoadRoster(courseId);
  }, [courseId]);
  const courseAssignments = assignments.filter((item) => item.course_id === courseId);
  const filteredRoster = roster.filter((item) =>
    (!assignmentId || item.assignment_id === assignmentId) &&
    `${item.student_name} ${item.student_number ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const submitted = filteredRoster.filter((item) => item.submission_id);
  const notSubmitted = filteredRoster.filter((item) => !item.submission_id);
  const late = submitted.filter((item) => item.is_late);
  const graded = submitted.filter((item) => item.submission_status === "graded");
  const awaiting = submitted.filter((item) => item.submission_status === "awaiting_grading" || item.submission_status === "draft");
  const filteredSubmissions = submissions.filter((item) =>
    (!courseId || item.course_id === courseId) &&
    (!assignmentId || item.assignment_id === assignmentId) &&
    `${item.student_name} ${item.student_id}`.toLowerCase().includes(search.toLowerCase()),
  );
  return <>
    <PageIntro eyebrow="ASSESSMENT WORKFLOW" title="Student Submissions" copy="Filter enrolled students by course or assignment, identify missing and late work, and open submissions to grade." />
    <div className="submission-filters"><label>Course<select value={courseId} onChange={(event) => {setCourseId(event.target.value); setAssignmentId("");}}><option value="">Select a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label><label>Assignment<select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}><option value="">All assignments</option>{courseAssignments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Search student<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or student number" /></label></div>
    <section className="metric-row submission-metrics"><Metric label="Enrolled students" value={filteredRoster.length} note="Selected course/assignment" icon={Users} tone="blue" /><Metric label="Submitted" value={submitted.length} note="Recorded submissions" icon={Check} tone="blue" /><Metric label="Not submitted" value={notSubmitted.length} note="From current enrolments" icon={Clock3} tone="blue" /><Metric label="Late submissions" value={late.length} note="After assignment due date" icon={CalendarDays} tone="blue" /><Metric label="Graded" value={graded.length} note="Published" icon={Check} tone="blue" /><Metric label="Awaiting grading" value={awaiting.length} note="Not published" icon={ClipboardCheck} tone="blue" /></section>
    <section className="content-panel submission-panel"><PanelHeading eyebrow="STUDENT WORK" title={loadingRoster ? "Loading course roster…" : `${filteredSubmissions.length} submitted items`} />{!courseId ? <EmptyState text="Select an assigned course to view its enrolled student roster." /> : filteredSubmissions.length === 0 ? <EmptyState text="No submissions match these filters." /> : <div className="submission-list">{filteredSubmissions.map((item) => <button className="submission-row" key={item.id} onClick={() => onOpen(item.id)}><span className="assignment-file"><FileText size={17} /></span><span className="submission-row-main"><strong>{item.assignment_title}</strong><small>{item.student_name} · {item.course_code} · {item.course_title}</small></span><i className={`status-pill ${item.grade_status === "published" ? "status-done" : item.grade_status === "draft" ? "status-review" : "status-open"}`}>{item.grade_status === "published" ? "Graded" : item.grade_status === "draft" ? "Draft" : "Awaiting grading"}</i><span className="submission-row-date">{formatDateTime(item.submitted_at)}</span><ArrowRight size={17} /></button>)}</div>}</section>
    {courseId && <section className="content-panel roster-panel"><PanelHeading eyebrow="ENROLLED ROSTER" title={`${notSubmitted.length} not submitted · ${late.length} late`} />{loadingRoster ? <div className="loading-state">Loading enrolled students…</div> : filteredRoster.length === 0 ? <EmptyState text="No enrolled students match this search." /> : <div className="roster-list">{filteredRoster.map((item) => <div className="roster-row" key={`${item.assignment_id}-${item.student_id}`}><span><strong>{item.student_name}</strong><small>{item.student_number || "Student number not recorded"} · {item.assignment_title}</small></span>{item.submission_id ? <i className={`status-pill ${item.submission_status === "graded" ? "status-done" : item.is_late ? "status-open" : "status-review"}`}>{item.is_late ? "Late" : item.submission_status === "graded" ? "Graded" : item.submission_status === "draft" ? "Draft grade" : "Awaiting grading"}</i> : <i className="status-pill status-open">Not submitted</i>}</div>)}</div>}</section>}
  </>;
}

function LecturerAssessmentsPage({
  courses,
  assessments,
  busy,
  onSave,
  onSaveResult,
}: {
  courses: Course[];
  assessments: LecturerAssessment[];
  busy: boolean;
  onSave: (assessment: Record<string, unknown>, id?: string) => Promise<void>;
  onSaveResult: (assessmentId: string, studentId: string, score: number, maxScore: number, feedback: string, status: "draft" | "published") => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [resultAssessment, setResultAssessment] = useState<LecturerAssessment | null>(null);
  const [resultStudents, setResultStudents] = useState<AssessmentResultStudent[]>([]);
  const [formError, setFormError] = useState("");
  const [loadingResults, setLoadingResults] = useState(false);
  const [modules, setModules] = useState<CourseDetail["modules"]>([]);
  const [form, setForm] = useState({ courseId: courses[0]?.id ?? "", moduleId: "", title: "", assessmentType: "examination", instructions: "", startsAt: "", endsAt: "", durationMinutes: "", maxScore: "", location: "", status: "draft" as LecturerAssessment["status"] });
  useEffect(() => {
    if (!form.courseId) return;
    void getJson<CourseDetail>(`/courses/${form.courseId}`).then((course) => setModules(course.modules)).catch((error) => setFormError(error instanceof Error ? error.message : "Could not load course modules."));
  }, [form.courseId]);
  function edit(assessment?: LecturerAssessment) {
    setEditingId(assessment?.id);
    setFormOpen(true);
    setForm({ courseId: assessment?.course_id ?? courses[0]?.id ?? "", moduleId: assessment?.module_id ?? "", title: assessment?.title ?? "", assessmentType: assessment?.assessment_type ?? "examination", instructions: assessment?.instructions ?? "", startsAt: assessment?.starts_at ? toDateTimeLocal(assessment.starts_at) : "", endsAt: assessment?.ends_at ? toDateTimeLocal(assessment.ends_at) : "", durationMinutes: assessment?.duration_minutes ? String(assessment.duration_minutes) : "", maxScore: assessment?.max_score ? String(assessment.max_score) : "", location: assessment?.location ?? "", status: assessment?.status ?? "draft" });
    setFormError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await onSave({
        ...form,
        moduleId: form.moduleId || null,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
        maxScore: form.maxScore ? Number(form.maxScore) : null,
        location: form.location || null,
      }, editingId);
      setEditingId(undefined);
      setFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save assessment.");
    }
  }
  async function openResults(assessment: LecturerAssessment) {
    setLoadingResults(true);
    setResultAssessment(assessment);
    try {
      setResultStudents(await getJson<AssessmentResultStudent[]>(`/lecturer/assessments/${assessment.id}/results`));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not load assessment results.");
    } finally {
      setLoadingResults(false);
    }
  }
  return <>
    <PageIntro eyebrow="EXAMINATIONS AND COURSEWORK" title="Exams & Assessments" copy="Schedule assessments for your assigned courses. This workspace manages schedules and results; it does not run online exam attempts." />
    <div className="lecturer-toolbar"><span>{assessments.length} assessments</span><button className="button-primary" onClick={() => edit()}>Create assessment <ArrowRight size={14} /></button></div>
    {assessments.length === 0 ? <div className="content-panel"><EmptyState text="No assessments have been scheduled for your courses." /></div> : <div className="content-panel lecturer-record-list">{assessments.map((assessment) => <article className="lecturer-managed-row" key={assessment.id}><span className="assignment-file"><ClipboardCheck size={17} /></span><span className="lecturer-managed-main"><strong>{assessment.title}</strong><small>{assessment.course_code} · {assessmentTypeLabel(assessment.assessment_type)} · {formatDateTime(assessment.starts_at)}</small><small>{assessment.duration_minutes ? `${assessment.duration_minutes} minutes` : "Duration not recorded"} · {assessment.published_results} published results</small></span><i className={`status-pill ${assessment.display_status === "available" ? "status-review" : assessment.display_status === "closed" || assessment.display_status === "cancelled" ? "status-done" : "status-open"}`}>{assessment.display_status}</i><button className="button-secondary compact-action" onClick={() => edit(assessment)}>Edit</button><button className="button-secondary compact-action" onClick={() => void openResults(assessment)}>Results</button></article>)}</div>}
    {formOpen && <div className="modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) {setEditingId(undefined); setFormOpen(false);}}}><form className="dialog lecturer-form-dialog" onSubmit={(event) => void submit(event)}><div className="dialog-top"><h2>{editingId ? "Edit assessment" : "Create assessment"}</h2><button className="icon-button" type="button" onClick={() => {setEditingId(undefined); setFormOpen(false);}} aria-label="Close"><X size={18} /></button></div><label className="field-label">Course<select required value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value, moduleId: "" })}>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label><label className="field-label">Module or topic<select value={form.moduleId} onChange={(event) => setForm({ ...form, moduleId: event.target.value })}><option value="">No specific module</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label><label className="field-label">Title<input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field-label">Assessment type<select value={form.assessmentType} onChange={(event) => setForm({ ...form, assessmentType: event.target.value })}><option value="examination">Examination</option><option value="quiz">Quiz</option><option value="coursework">Coursework</option><option value="test">Test</option><option value="practical">Practical</option></select></label><label className="field-label">Instructions<textarea rows={3} maxLength={10000} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label><div className="form-two-columns"><label className="field-label">Starts<input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label><label className="field-label">Ends<input required type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label></div><div className="form-two-columns"><label className="field-label">Duration (minutes)<input type="number" min="1" max="1440" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })} /></label><label className="field-label">Maximum marks<input type="number" min="1" step="0.5" value={form.maxScore} onChange={(event) => setForm({ ...form, maxScore: event.target.value })} /></label></div><label className="field-label">Venue<input maxLength={200} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label className="field-label">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LecturerAssessment["status"] })}><option value="draft">Draft</option><option value="published">Publish schedule</option><option value="cancelled">Cancelled</option></select></label>{formError && <p className="field-error" role="alert">{formError}</p>}<div className="dialog-actions"><button type="button" className="button-secondary" onClick={() => {setEditingId(undefined); setFormOpen(false);}}>Cancel</button><button className="button-primary" disabled={busy || !courses.length}>{busy ? "Saving…" : "Save assessment"}</button></div></form></div>}
    {resultAssessment && <div className="modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) setResultAssessment(null);}}><section className="dialog lecturer-form-dialog"><div className="dialog-top"><div><span className="eyebrow">{resultAssessment.course_code} · {resultAssessment.max_score ?? "Maximum marks not set"} marks</span><h2>{resultAssessment.title} results</h2></div><button className="icon-button" onClick={() => setResultAssessment(null)} aria-label="Close"><X size={18} /></button></div>{loadingResults ? <div className="loading-state">Loading enrolled students…</div> : resultStudents.length === 0 ? <EmptyState text="No students are enrolled in this course." /> : resultStudents.map((student) => <AssessmentResultRow key={student.student_id} assessment={resultAssessment} student={student} onSave={onSaveResult} />)}</section></div>}
  </>;
}

function AssessmentResultRow({ assessment, student, onSave }: { assessment: LecturerAssessment; student: AssessmentResultStudent; onSave: (assessmentId: string, studentId: string, score: number, maxScore: number, feedback: string, status: "draft" | "published") => Promise<void> }) {
  const [score, setScore] = useState(student.score === null ? "" : String(student.score));
  const [feedback, setFeedback] = useState(student.feedback ?? "");
  const [status, setStatus] = useState<"draft" | "published">(student.result_status ?? "draft");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 0 || !assessment.max_score || numericScore > assessment.max_score) {
      setError(`Enter a score from 0 to ${assessment.max_score ?? "the assessment maximum"}.`);
      return;
    }
    try {
      await onSave(assessment.id, student.student_id, numericScore, assessment.max_score, feedback, status);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save result.");
    }
  }
  return <form className="assessment-result-row" onSubmit={(event) => void submit(event)}><span className="assessment-result-student"><strong>{student.student_name}</strong><small>{student.student_number || "Student number not recorded"}</small></span><label className="field-label">Score<input required type="number" min="0" max={assessment.max_score ?? undefined} step="0.5" value={score} onChange={(event) => setScore(event.target.value)} /></label><label className="field-label">Feedback<input maxLength={5000} value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label><select aria-label={`Grade status for ${student.student_name}`} value={status} onChange={(event) => setStatus(event.target.value as "draft" | "published")}><option value="draft">Draft</option><option value="published">Published</option></select><button className="button-secondary compact-action">Save</button>{error && <small className="field-error">{error}</small>}</form>;
}

function LecturerAnnouncementsPage({
  courses,
  announcements,
  busy,
  onSave,
}: {
  courses: Course[];
  announcements: LecturerAnnouncement[];
  busy: boolean;
  onSave: (announcement: Record<string, unknown>, id?: string) => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ courseId: courses[0]?.id ?? "", title: "", body: "", status: "draft" as "draft" | "published" });
  function edit(item?: LecturerAnnouncement) {
    setEditingId(item?.id);
    setForm({ courseId: item?.course_id ?? courses[0]?.id ?? "", title: item?.title ?? "", body: item?.body ?? "", status: item?.status ?? "draft" });
    setFormError("");
    setFormOpen(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await onSave(form, editingId);
      setFormOpen(false);
      setEditingId(undefined);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save announcement.");
    }
  }
  return <>
    <PageIntro eyebrow="COURSE COMMUNICATION" title="Announcements" copy="Publish updates to students enrolled in courses assigned to your account." />
    <div className="lecturer-toolbar"><span>{announcements.length} announcements</span><button className="button-primary" onClick={() => edit()}>Create announcement <ArrowRight size={14} /></button></div>
    {announcements.length === 0 ? <div className="content-panel"><EmptyState text="No announcements have been created for your assigned courses." /></div> : <div className="content-panel lecturer-record-list">{announcements.map((item) => <article className="announcement-record" key={item.id}><span className="eyebrow">{item.course_code} · {item.status} · {formatDate(item.published_at.slice(0, 10))}</span><h2>{item.title}</h2><p>{item.body}</p><button className="button-secondary compact-action" onClick={() => edit(item)}>Edit</button></article>)}</div>}
    {formOpen && <div className="modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) setFormOpen(false);}}><form className="dialog lecturer-form-dialog" onSubmit={(event) => void submit(event)}><div className="dialog-top"><h2>{editingId ? "Edit announcement" : "Create announcement"}</h2><button className="icon-button" type="button" onClick={() => setFormOpen(false)} aria-label="Close"><X size={18} /></button></div><label className="field-label">Course<select required value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })}>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label><label className="field-label">Title<input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field-label">Message<textarea required maxLength={10000} rows={6} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label><label className="field-label">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as typeof form.status })}><option value="draft">Draft</option><option value="published">Publish</option></select></label>{formError && <p className="field-error" role="alert">{formError}</p>}<div className="dialog-actions"><button className="button-secondary" type="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="button-primary" disabled={busy || !courses.length}>{busy ? "Saving…" : "Save announcement"}</button></div></form></div>}
  </>;
}

function LecturerProgressPage({
  courses,
  courseId,
  students,
  loading,
  onSelect,
}: {
  courses: Course[];
  courseId: string;
  students: StudentProgress[];
  loading: boolean;
  onSelect: (courseId: string) => void;
}) {
  const course = courses.find((item) => item.id === courseId);
  return <>
    <PageIntro eyebrow="LEARNER MONITORING" title="Student Progress" copy="Review enrollment, module completion, assignment submission, and published grades for one assigned course." />
    <div className="progress-course-select"><label className="field-label">Assigned course<select value={courseId} onChange={(event) => onSelect(event.target.value)}><option value="">Select a course</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select></label></div>
    {courseId && <section className="content-panel progress-panel"><PanelHeading eyebrow={course?.code ?? "COURSE"} title={course?.title ?? "Course students"} />{loading ? <div className="loading-state">Loading enrolled students…</div> : students.length === 0 ? <EmptyState text="No students are enrolled in this course." /> : <div className="progress-table"><div className="progress-table-head"><span>STUDENT</span><span>MODULE PROGRESS</span><span>ASSIGNMENTS</span><span>PUBLISHED GRADES</span></div>{students.map((student) => <div className="progress-row" key={student.student_id}><span><strong>{student.student_name}</strong><small>{student.student_number || "Student number not recorded"}</small></span><span>{student.completed_modules}/{student.total_modules} modules <small>{student.progress_percent}%</small></span><span>{student.submitted_assignments} submitted <small>{student.pending_assignments} pending</small></span><span>{student.published_grades}</span></div>)}</div>}</section>}
  </>;
}

function LecturerProfilePage({ profile, courses, dashboard }: { profile: LecturerProfile | null; courses: Course[]; dashboard: LecturerDashboardData | null }) {
  return <><PageIntro eyebrow="STAFF RECORD" title="Lecturer Profile" copy="Your current lecturer account and assigned teaching load." /><section className="content-panel profile-panel"><div className="profile-field"><span>Full name</span><strong>{profile?.full_name ?? "Not recorded"}</strong></div><div className="profile-field"><span>Email</span><strong>{profile?.email ?? "Not recorded"}</strong></div><div className="profile-field"><span>Assigned courses</span><strong>{dashboard?.metrics.courses ?? courses.length}</strong></div><div className="profile-enrolments"><h2>Teaching assignments</h2>{courses.length === 0 ? <EmptyState text="No courses are assigned to this lecturer account." /> : courses.map((course) => <div key={course.id}><strong>{course.code}</strong><span>{course.title}</span></div>)}</div></section></>;
}

function LecturerGradesPage({ submissions, onOpen }: { submissions: Submission[]; onOpen: (id: number) => void }) {
  return <><PageIntro eyebrow="ASSESSMENT RESULTS" title="Grades & Feedback" copy="Review draft and published assignment grades for submissions in your assigned courses." /><div className="content-panel submission-panel">{submissions.length === 0 ? <EmptyState text="No submitted work is available for grading." /> : <div className="submission-list">{submissions.map((item) => <button className="submission-row" key={item.id} onClick={() => onOpen(item.id)}><span className="submission-row-main"><strong>{item.assignment_title}</strong><small>{item.student_name} · {item.course_code} · {item.grade ?? "No grade"}/{item.points}</small></span><i className={`status-pill ${item.grade_status === "published" ? "status-done" : item.grade_status === "draft" ? "status-review" : "status-open"}`}>{item.grade_status === "published" ? "Published" : item.grade_status === "draft" ? "Draft" : "Awaiting grading"}</i><ArrowRight size={17} /></button>)}</div>}</div></>;
}

function SubmissionReview({
  submission,
  close,
  busy,
  onSave,
}: {
  submission: Submission;
  close: () => void;
  busy: boolean;
  onSave: (
    score: number,
    feedback: string,
    status: "draft" | "published",
  ) => Promise<void>;
}) {
  const [score, setScore] = useState(submission.grade?.toString() ?? "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [gradeError, setGradeError] = useState("");
  const published = submission.grade_status === "published";

  async function save(status: "draft" | "published") {
    const numericScore = Number(score);
    if (score.trim() === "" || !Number.isFinite(numericScore)) {
      setGradeError("Enter a numeric grade before saving.");
      return;
    }
    if (numericScore < 0 || numericScore > submission.points) {
      setGradeError(`Grade must be between 0 and ${submission.points}.`);
      return;
    }
    setGradeError("");
    try {
      await onSave(numericScore, feedback, status);
    } catch (saveError) {
      setGradeError(
        saveError instanceof Error ? saveError.message : "Could not save grade.",
      );
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="dialog review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
      >
        <div className="dialog-top">
          <div>
            <span className="eyebrow">
              {submission.course_code} · {submission.points} points · {published ? "Graded" : submission.grade_status === "draft" ? "Draft grade" : "Awaiting grading"}
            </span>
            <h2 id="review-title">{submission.assignment_title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close submission review"
          >
            <X size={19} />
          </button>
        </div>
        <div className="review-meta">
          <span>
            <strong>Student</strong>
            {submission.student_name}
          </span>
          <span>
            <strong>Course</strong>
            {submission.course_title}
          </span>
          <span>
            <strong>Submitted</strong>
            {new Date(submission.submitted_at).toLocaleString()}
          </span>
        </div>
        <h3 className="review-response-heading">Student response</h3>
        <div className="review-response">{submission.response}</div>
        <div className="grading-fields">
          <label className="field-label" htmlFor="submission-grade">
            Grade <span>out of {submission.points}</span>
          </label>
          <input
            id="submission-grade"
            type="number"
            min="0"
            max={submission.points}
            step="0.5"
            value={score}
            onChange={(event) => setScore(event.target.value)}
            aria-invalid={Boolean(gradeError)}
          />
          <label className="field-label" htmlFor="submission-feedback">
            Feedback for student
          </label>
          <textarea
            id="submission-feedback"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            maxLength={5000}
            rows={4}
            placeholder="Write constructive feedback (up to 5,000 characters)."
          />
          <div className="form-hint">
            <span
              className={gradeError ? "field-error" : undefined}
              role={gradeError ? "alert" : undefined}
            >
              {gradeError || "Save as draft to keep feedback private."}
            </span>
            <span>{feedback.length}/5,000</span>
          </div>
        </div>
        <div className="dialog-actions">
          <button className="button-secondary" onClick={close}>
            Close review
          </button>
          {!published && (
            <button
              className="button-secondary"
              disabled={busy}
              onClick={() => void save("draft")}
            >
              Save draft
            </button>
          )}
          <button
            className="button-primary"
            disabled={busy}
            onClick={() => void save("published")}
          >
            {busy
              ? "Saving…"
              : published
                ? "Update published grade"
                : "Publish to student"}
          </button>
        </div>
      </section>
    </div>
  );
}

function AssignmentPage({
  role,
  assignments,
  onSubmit,
}: {
  role: Role;
  assignments: Assignment[];
  onSubmit: (assignment: Assignment) => void;
}) {
  const open =
    role === "student"
      ? assignments.filter((item) => !item.submitted_at)
      : assignments;
  const complete =
    role === "student"
      ? assignments.filter((item) => item.submitted_at)
      : [];
  return (
    <>
      <PageIntro
        eyebrow={role === "student" ? "YOUR COURSEWORK" : "ASSESSMENT SPACE"}
        title={role === "student" ? "Assignments" : "Assessment overview"}
        copy={
          role === "student"
            ? "Keep track of what is due and submit your written work from here."
            : "Review the current assessment schedule across course spaces."
        }
      />
      {role !== "student" && (
        <div className="info-banner">
          <ShieldCheck size={17} />
          <span>
            Read submitted work from the Submissions page. Grade entry and
            lecturer feedback are available there.
          </span>
        </div>
      )}
      <div className="assignment-summary">
        <div>
          <strong>{open.length}</strong>
          <span>{role === "student" ? "To submit" : "Scheduled"}</span>
        </div>
        <div>
          <strong>{complete.length}</strong>
          <span>{role === "student" ? "Submitted" : "Student submissions"}</span>
        </div>
        <div>
          <strong>{assignments.length}</strong>
          <span>Total this term</span>
        </div>
      </div>
      <section className="content-panel assignment-panel">
        <PanelHeading eyebrow="TERM 2 · 2026" title="Assessment schedule" />
        <div className="assignment-table">
          <div className="assignment-table-head">
            <span>ASSESSMENT</span>
            <span>COURSE</span>
            <span>DUE DATE</span>
            <span>STATUS</span>
            <span />
          </div>
          {assignments.map((item) => (
            <div className="assignment-row" key={item.id}>
              <div className="assignment-title">
                <span className="assignment-file">
                  <FileText size={17} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.points} points</small>
                  {role === "student" && item.submission_status === "graded" && (
                    <small className="student-grade-result">
                      Grade: {item.grade}/{item.points}
                      {item.feedback ? ` · ${item.feedback}` : ""}
                    </small>
                  )}
                </span>
              </div>
              <span className="assignment-course">
                {item.course_code}
                <small>{item.course_title}</small>
              </span>
              <span className="assignment-due">
                {formatDate(item.due_date)}
                <small>{daysLeft(item.due_date)}</small>
              </span>
              <span>
                <i
                  className={`status-pill ${item.submission_status === "graded" ? "status-done" : item.submission_status === "awaiting_grading" ? "status-review" : "status-open"}`}
                >
                  {role !== "student"
                    ? "Scheduled"
                    : item.submission_status === "graded"
                      ? "Graded"
                      : item.submission_status === "awaiting_grading"
                        ? "Awaiting grading"
                        : "Not submitted"}
                </i>
              </span>
              {role === "student" ? (
                <button
                  className="button-row-action"
                  disabled={item.submitted_at ? !item.can_edit_submission : !item.can_submit}
                  onClick={() => onSubmit(item)}
                >
                  {!item.submitted_at && !item.can_submit
                    ? "Closed"
                    : item.submitted_at && !item.can_edit_submission
                      ? "Submission locked"
                      : item.submitted_at
                        ? "Edit submission"
                        : "Submit"}
                  {(item.can_submit || item.can_edit_submission) && <ArrowRight size={14} />}
                </button>
              ) : (
                <span className="staff-item-sub">Scheduled</span>
              )}
            </div>
          ))}
          {assignments.length === 0 && (
            <EmptyState text="No assessments are scheduled yet." />
          )}
        </div>
      </section>
      <div className="assignment-guidance">
        <Clock3 size={16} />
        <span>
          Submitted work can be updated by submitting again before the due date.
        </span>
      </div>
    </>
  );
}

function ProgrammePage({
  programmes,
  courses,
  openCourse,
}: {
  programmes: Programme[];
  courses: Course[];
  openCourse: (id: string) => void;
}) {
  return (
    <>
      <PageIntro
        eyebrow="ACADEMIC STRUCTURE"
        title="Programmes"
        copy="Professional learning pathways, their awards, and the courses that bring them to life."
      />
      <div className="programme-grid">
        {programmes.map((programme, index) => (
          <article className="programme-card" key={programme.id}>
            <div className={`programme-band band-${index % 2}`}>
              <span className="hero-kicker">
                {programme.award.toUpperCase()}
              </span>
              <GraduationCap size={32} strokeWidth={1.4} />
              <span className="programme-duration">{programme.duration}</span>
            </div>
            <div className="programme-body">
              <h2>{programme.name}</h2>
              <div className="programme-meta">
                <span>{programme.course_count} courses</span>
                <i />
                {programme.duration}
                <i />
                Professional learning
              </div>
              <div className="programme-course-list">
                {courses
                  .filter((course) => course.programme_name === programme.name)
                  .map((course) => (
                    <button
                      key={course.id}
                      onClick={() => openCourse(course.id)}
                    >
                      <span>
                        <small>{course.code}</small>
                        <strong>{course.title}</strong>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  ))}
              </div>
            </div>
          </article>
        ))}
      </div>
      {programmes.length === 0 && (
        <EmptyState text="No programmes are available yet." />
      )}
    </>
  );
}

function CourseModal({
  course,
  enrolled,
  canEnroll,
  busy,
  close,
  onEnroll,
  onToggleProgress,
}: {
  course: CourseDetail;
  enrolled: boolean;
  canEnroll: boolean;
  busy: boolean;
  close: () => void;
  onEnroll: () => void;
  onToggleProgress: (moduleId: string, completed: boolean) => void;
}) {
  const grouped = course.modules.reduce<
    {
      id: string;
      title: string;
      items: NonNullable<CourseDetail["modules"][number]>[];
    }[]
  >((groups, item) => {
    let group = groups.find(({ id }) => id === item.id);
    if (!group) {
      group = { id: item.id, title: item.title, items: [] };
      groups.push(group);
    }
    group.items.push(item);
    return groups;
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="dialog course-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-title"
      >
        <div className="dialog-course-banner">
          <div className="dialog-top">
            <span className="hero-kicker">
              {course.code} · {course.credits} CREDITS
            </span>
            <button
              className="icon-button dialog-close"
              onClick={close}
              aria-label="Close course"
            >
              <X size={19} />
            </button>
          </div>
          <h2 id="course-title">{course.title}</h2>
          <p>{course.programme_name}</p>
        </div>
        <div className="dialog-course-body">
          <div className="course-facts">
            <span>
              <Users size={15} /> {course.lecturer}
            </span>
            <span>
              <CalendarDays size={15} /> {course.term}
            </span>
            <span>
              <FileText size={15} /> {course.module_count} modules
            </span>
            {enrolled && (
              <span>
                <Check size={15} /> {course.completed_modules ?? 0}/{course.module_count} modules complete
              </span>
            )}
          </div>
          <p className="course-description">{course.description}</p>
          <h3>Course content</h3>
          <div className="module-list">
            {grouped.map((module, index) => (
              <div className="module-item" key={module.id}>
                <span className="module-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <strong>{module.title}</strong>
                  {enrolled && (
                    <label className="module-progress-control">
                      <input
                        type="checkbox"
                        checked={Boolean(module.items[0]?.completed_at)}
                        disabled={busy}
                        onChange={(event) =>
                          onToggleProgress(module.id, event.target.checked)
                        }
                      />
                      Module completed
                    </label>
                  )}
                  {module.items
                    .filter(({ material_id }) => material_id)
                    .map((item) => {
                      const resourceUrl = safeResourceUrl(item.resource_url ?? null);
                      return (
                        <div className="material-row" key={item.material_id}>
                          <FileText size={14} />
                          <span>{item.material_title}</span>
                          <small>{item.material_kind} · {item.material_duration}</small>
                          {resourceUrl ? (
                            <a href={resourceUrl} target="_blank" rel="noreferrer">Open</a>
                          ) : (
                            <small>File not attached</small>
                          )}
                        </div>
                      );
                    })}
                </div>
                <ChevronDown size={16} />
              </div>
            ))}
          </div>
          <div className="dialog-actions">
            {enrolled ? (
              <span className="enrolled-confirm">
                <Check size={16} /> You’re enrolled
              </span>
            ) : canEnroll ? (
              <span className="course-dialog-hint">
                Enrolment is saved to your learning record.
              </span>
            ) : (
              <span className="course-dialog-hint">Assigned course details</span>
            )}
            {canEnroll && (
              <button
                className="button-primary"
                disabled={enrolled || busy}
                onClick={onEnroll}
              >
                {enrolled ? "Enrolled" : busy ? "Enrolling…" : "Enrol in course"}{" "}
                {!enrolled && <ArrowRight size={16} />}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function PageIntro({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <section className="page-intro">
      <span className="eyebrow">
        <span className="eyebrow-line" />
        {eyebrow}
      </span>
      <h1>{title}</h1>
      <p>{copy}</p>
    </section>
  );
}

function Activity({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof FileText;
  title: string;
  detail: string;
}) {
  return (
    <div className="activity-item">
      <span className="activity-icon">
        <Icon size={16} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <BookOpen size={22} />
      <span>{text}</span>
    </div>
  );
}
function daysLeft(date: string) {
  const remaining = Math.ceil(
    (new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86400000,
  );
  if (remaining < 0) return "Past due";
  if (remaining === 0) return "Due today";
  if (remaining === 1) return "Due tomorrow";
  return `In ${remaining} days`;
}
function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default App;
