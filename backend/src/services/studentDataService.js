// src/services/studentDataService.js

import { supabaseAdmin } from "../lib/supabase.js";

// ─── Semester helpers ──────────────────────────────────────────────────────────

/**
 * Returns the current RSU semester and academic year.
 *   Semester 1 : June – October
 *   Semester 2 : November – March
 *   Semester 3 : April – May  (summer)
 */
export function getCurrentSemester() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const thaiYear = now.getFullYear() + 543; // พ.ศ.

  // RSU academic calendar:
  //   Semester 1 : August – December  → academic year = current Thai year
  //   Semester 2 : January – May      → academic year = previous Thai year
  //   Summer (3) : June – July        → academic year = previous Thai year
  if (month >= 8) {
    return { semester: 1, academicYear: thaiYear };
  }
  if (month <= 5) {
    return { semester: 2, academicYear: thaiYear - 1 };
  }
  // June–July
  return { semester: 3, academicYear: thaiYear - 1 };
}

/**
 * Returns the semester that comes just before { sem, year }.
 */
function previousSemester(sem, year) {
  if (sem === 1) return { semester: 3, academicYear: year - 1 };
  return { semester: sem - 1, academicYear: year };
}

// ─── Grades ────────────────────────────────────────────────────────────────────

export async function getGrades({ studentId, semester, academicYear } = {}) {
  let sem = semester;
  let year = academicYear;

  if (!sem || !year) {
    // Grades are from the previous semester (term just ended)
    const current = getCurrentSemester();
    ({ semester: sem, academicYear: year } = previousSemester(
      current.semester,
      current.academicYear
    ));
  }

  const { data, error } = await supabaseAdmin
    .from("student_grades")
    .select("course_code, course_name, grade, credits")
    .eq("student_id", studentId)
    .eq("semester", sem)
    .eq("academic_year", year)
    .order("course_code");

  if (error) {
    console.error("studentDataService.getGrades error:", error.message);
    throw error;
  }

  return { grades: data ?? [], semester: sem, academicYear: year };
}

// ─── Schedule ──────────────────────────────────────────────────────────────────

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export async function getSchedule({ studentId, semester, academicYear } = {}) {
  let sem = semester;
  let year = academicYear;

  if (!sem || !year) {
    ({ semester: sem, academicYear: year } = getCurrentSemester());
  }

  const { data, error } = await supabaseAdmin
    .from("course_schedules")
    .select("course_code, course_name, section, type, room, day_of_week, time_start, time_end")
    .eq("student_id", studentId)
    .eq("semester", sem)
    .eq("academic_year", year);

  if (error) {
    console.error("studentDataService.getSchedule error:", error.message);
    throw error;
  }

  const courses = (data ?? []).sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week);
    if (dayDiff !== 0) return dayDiff;
    return (a.time_start ?? "").localeCompare(b.time_start ?? "");
  });

  return { courses, semester: sem, academicYear: year };
}

// ─── Exam Schedule ─────────────────────────────────────────────────────────────

export async function getExamSchedule({
  studentId,
  semester,
  academicYear,
  examType = "final",
} = {}) {
  let sem = semester;
  let year = academicYear;

  if (!sem || !year) {
    ({ semester: sem, academicYear: year } = getCurrentSemester());
  }

  const { data, error } = await supabaseAdmin
    .from("exam_schedules")
    .select("course_code, course_name, exam_type, exam_date, time_start, time_end, room, building")
    .eq("student_id", studentId)
    .eq("semester", sem)
    .eq("academic_year", year)
    .eq("exam_type", examType)
    .order("exam_date")
    .order("time_start");

  if (error) {
    console.error("studentDataService.getExamSchedule error:", error.message);
    throw error;
  }

  return { exams: data ?? [], semester: sem, academicYear: year, examType };
}