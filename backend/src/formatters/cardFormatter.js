// src/formatters/cardFormatter.js
// Formats student data into clean Telegram HTML message cards.

const DIVIDER = "━━━━━━━━━━━━━━━━━━━━";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(timeStr) {
  if (!timeStr) return "—";
  // Supabase returns "HH:MM:SS" — strip seconds
  return timeStr.slice(0, 5);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function semesterLabel(semester, academicYear) {
  return `Semester ${semester} / ${academicYear}`;
}

function typeLabel(type) {
  return type === "lab" ? "Lab" : "Lec";
}

// ─── Grades Card ───────────────────────────────────────────────────────────────

export function formatGradesCard(student, { grades, semester, academicYear }) {
  const header =
    `🎓 <b>GRADES</b>\n` +
    `${DIVIDER}\n` +
    `<b>${student.student_id}</b>\n` +
    `${student.full_name}\n` +
    `<i>${semesterLabel(semester, academicYear)}</i>\n` +
    `${DIVIDER}`;

  if (!grades.length) {
    return `${header}\n\n<i>ไม่พบข้อมูล (No grades found)</i>`;
  }

  const rows = grades.map((g) => {
    const grade = g.grade ?? "—";
    const credits = g.credits != null ? `${g.credits} cr` : "";
    return (
      `<b>${g.course_code}</b>  <b>${grade}</b>\n` +
      `<i>${g.course_name}${credits ? `  ·  ${credits}` : ""}</i>`
    );
  });

  const footer =
    `\n${DIVIDER}\n` +
    `<i>For other semesters visit webportal.rsu.ac.th</i>`;

  return `${header}\n\n${rows.join("\n\n")}${footer}`;
}

// ─── Schedule Card ─────────────────────────────────────────────────────────────

export function formatScheduleCard(student, { courses, semester, academicYear }) {
  const header =
    `📅 <b>CLASS SCHEDULE</b>\n` +
    `${DIVIDER}\n` +
    `<b>${student.student_id}</b>\n` +
    `${student.full_name}\n` +
    `<i>${semesterLabel(semester, academicYear)}</i>\n` +
    `${DIVIDER}`;

  if (!courses.length) {
    return `${header}\n\n<i>ไม่พบข้อมูล (No schedule found)</i>`;
  }

  const rows = courses.map((c) => {
    const room = c.room ? `Rm: ${c.room}` : "Room: —";
    const section = c.section ? `Sec: ${c.section}` : "";
    const meta = [typeLabel(c.type), section, room].filter(Boolean).join("  ·  ");
    const time = `${c.day_of_week ?? "—"}  ${formatTime(c.time_start)}–${formatTime(c.time_end)}`;

    return (
      `<b>${c.course_code}</b>\n` +
      `<i>${c.course_name}</i>\n` +
      `${meta}\n` +
      `🕐 ${time}`
    );
  });

  const footer =
    `\n${DIVIDER}\n` +
    `<i>For other semesters visit webportal.rsu.ac.th</i>`;

  return `${header}\n\n${rows.join("\n\n")}${footer}`;
}

// ─── Exam Card ─────────────────────────────────────────────────────────────────

export function formatExamCard(student, { exams, semester, academicYear, examType }) {
  const typeLabel = examType === "midterm" ? "Midterm" : "Final";

  const header =
    `📝 <b>EXAM SCHEDULE — ${typeLabel.toUpperCase()}</b>\n` +
    `${DIVIDER}\n` +
    `<b>${student.student_id}</b>\n` +
    `${student.full_name}\n` +
    `<i>${semesterLabel(semester, academicYear)}  ·  ${typeLabel}</i>\n` +
    `${DIVIDER}`;

  if (!exams.length) {
    return `${header}\n\n<i>ไม่พบข้อมูล (No exam schedule found)</i>`;
  }

  const rows = exams.map((e) => {
    const room = e.room
      ? `📍 ${e.building ? e.building + " " : ""}Room ${e.room}`
      : "📍 Room: —";
    const dateTime = `📅 ${formatDate(e.exam_date)}  ${formatTime(e.time_start)}–${formatTime(e.time_end)}`;

    return (
      `<b>${e.course_code}</b>\n` +
      `<i>${e.course_name}</i>\n` +
      `${dateTime}\n` +
      `${room}`
    );
  });

  const footer =
    `\n${DIVIDER}\n` +
    `<i>For other semesters visit webportal.rsu.ac.th</i>`;

  return `${header}\n\n${rows.join("\n\n")}${footer}`;
}

// ─── Main Menu Card ────────────────────────────────────────────────────────────

export function formatMainMenu(student) {
  return (
    `👋 <b>Welcome, ${student.full_name}!</b>\n\n` +
    `<b>${student.student_id}</b>  ·  ${student.faculty ?? "RSU"}\n\n` +
    `What would you like to check?`
  );
}

export const MAIN_MENU_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "📅 Schedule",    callback_data: "menu_schedule" },
      { text: "🎓 Grades",      callback_data: "menu_grades"   },
    ],
    [
      { text: "📝 Midterm Exam", callback_data: "menu_exam_midterm" },
      { text: "📝 Final Exam",   callback_data: "menu_exam_final"   },
    ],
    [
      { text: "🎫 Submit Ticket", callback_data: "menu_ticket" },
      { text: "👤 My Info",       callback_data: "me"          },
    ],
  ],
};