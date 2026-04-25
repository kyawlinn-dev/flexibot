// ============================================================
// __tests__/unit/cardFormatter.test.js
//
// TESTING TYPE: Unit Testing
// Tests each formatter function in isolation.
// No external dependencies (Supabase, Redis, AI) needed.
// ============================================================

import {
  formatGradesCard,
  formatScheduleCard,
  formatExamCard,
  formatMainMenu,
  MAIN_MENU_KEYBOARD,
} from "../../src/formatters/cardFormatter.js";

// ── Shared mock data ────────────────────────────────────────
const mockStudent = {
  student_id: "6501234567",
  full_name: "Somsak Jaidee",
  faculty: "Information Technology",
};

const semesterInfo = { semester: 1, academicYear: "2025" };

// ============================================================
// formatGradesCard
// ============================================================
describe("formatGradesCard — Unit Tests", () => {
  test("includes student ID and name in the output", () => {
    const result = formatGradesCard(mockStudent, {
      ...semesterInfo,
      grades: [
        { course_code: "ICT301", course_name: "Information Systems", grade: "A", credits: 3 },
      ],
    });

    expect(result).toContain(mockStudent.student_id);
    expect(result).toContain(mockStudent.full_name);
  });

  test("shows grade and course code for each grade entry", () => {
    const result = formatGradesCard(mockStudent, {
      ...semesterInfo,
      grades: [
        { course_code: "ICT301", course_name: "Info Systems", grade: "A", credits: 3 },
        { course_code: "ICT302", course_name: "Networks", grade: "B+", credits: 3 },
      ],
    });

    expect(result).toContain("ICT301");
    expect(result).toContain("ICT302");
    expect(result).toContain("A");
    expect(result).toContain("B+");
  });

  test("shows Thai/English no-data message when grades array is empty", () => {
    const result = formatGradesCard(mockStudent, {
      ...semesterInfo,
      grades: [],
    });

    expect(result).toContain("No grades found");
  });

  test("handles a grade of null gracefully (shows dash)", () => {
    const result = formatGradesCard(mockStudent, {
      ...semesterInfo,
      grades: [{ course_code: "ICT303", course_name: "AI", grade: null, credits: 3 }],
    });

    // null grade should render as "—"
    expect(result).toContain("—");
  });

  test("includes semester and academic year in the header", () => {
    const result = formatGradesCard(mockStudent, {
      grades: [],
      semester: 2,
      academicYear: "2024",
    });

    expect(result).toContain("Semester 2");
    expect(result).toContain("2024");
  });
});

// ============================================================
// formatScheduleCard
// ============================================================
describe("formatScheduleCard — Unit Tests", () => {
  test("includes CLASS SCHEDULE header", () => {
    const result = formatScheduleCard(mockStudent, {
      ...semesterInfo,
      courses: [],
    });

    expect(result).toContain("CLASS SCHEDULE");
  });

  test("renders course code, name and room for each course", () => {
    const result = formatScheduleCard(mockStudent, {
      ...semesterInfo,
      courses: [
        {
          course_code: "ICT301",
          course_name: "Information Systems",
          type: "lec",
          section: "1",
          room: "IT-301",
          day_of_week: "Mon",
          time_start: "09:00:00",
          time_end: "12:00:00",
        },
      ],
    });

    expect(result).toContain("ICT301");
    expect(result).toContain("IT-301");
    expect(result).toContain("09:00");  // seconds stripped
    expect(result).toContain("12:00");
  });

  test("strips seconds from time strings (HH:MM:SS → HH:MM)", () => {
    const result = formatScheduleCard(mockStudent, {
      ...semesterInfo,
      courses: [
        {
          course_code: "ICT301",
          course_name: "Test",
          type: "lec",
          section: "1",
          room: "A1",
          day_of_week: "Tue",
          time_start: "13:30:00",
          time_end: "16:30:00",
        },
      ],
    });

    expect(result).toContain("13:30");
    expect(result).not.toContain("13:30:00"); // seconds must be stripped
  });

  test("shows no-data message for empty course list", () => {
    const result = formatScheduleCard(mockStudent, {
      ...semesterInfo,
      courses: [],
    });

    expect(result).toContain("No schedule found");
  });

  test("labels lecture type as 'Lec' and lab as 'Lab'", () => {
    const makeCourse = (type) => ({
      course_code: "ICT301",
      course_name: "Test",
      type,
      section: "1",
      room: "B2",
      day_of_week: "Wed",
      time_start: "08:00:00",
      time_end: "11:00:00",
    });

    const lecResult = formatScheduleCard(mockStudent, {
      ...semesterInfo,
      courses: [makeCourse("lec")],
    });
    const labResult = formatScheduleCard(mockStudent, {
      ...semesterInfo,
      courses: [makeCourse("lab")],
    });

    expect(lecResult).toContain("Lec");
    expect(labResult).toContain("Lab");
  });
});

// ============================================================
// formatExamCard
// ============================================================
describe("formatExamCard — Unit Tests", () => {
  test("shows MIDTERM in header for midterm exam type", () => {
    const result = formatExamCard(mockStudent, {
      ...semesterInfo,
      examType: "midterm",
      exams: [],
    });

    expect(result).toContain("MIDTERM");
  });

  test("shows FINAL in header for final exam type", () => {
    const result = formatExamCard(mockStudent, {
      ...semesterInfo,
      examType: "final",
      exams: [],
    });

    expect(result).toContain("FINAL");
  });

  test("renders course code, date and room for each exam", () => {
    const result = formatExamCard(mockStudent, {
      ...semesterInfo,
      examType: "midterm",
      exams: [
        {
          course_code: "ICT301",
          course_name: "Information Systems",
          exam_date: "2025-10-15",
          time_start: "09:00:00",
          time_end: "12:00:00",
          room: "201",
          building: "IT Building",
        },
      ],
    });

    expect(result).toContain("ICT301");
    expect(result).toContain("201");
    expect(result).toContain("IT Building");
  });

  test("shows no-data message for empty exam list", () => {
    const result = formatExamCard(mockStudent, {
      ...semesterInfo,
      examType: "final",
      exams: [],
    });

    expect(result).toContain("No exam schedule found");
  });

  test("handles missing room gracefully (shows dash)", () => {
    const result = formatExamCard(mockStudent, {
      ...semesterInfo,
      examType: "midterm",
      exams: [
        {
          course_code: "ICT301",
          course_name: "Test",
          exam_date: "2025-10-15",
          time_start: "09:00:00",
          time_end: "12:00:00",
          room: null,
          building: null,
        },
      ],
    });

    expect(result).toContain("Room: —");
  });
});

// ============================================================
// formatMainMenu
// ============================================================
describe("formatMainMenu — Unit Tests", () => {
  test("greets the student by name", () => {
    const result = formatMainMenu(mockStudent);
    expect(result).toContain("Somsak Jaidee");
  });

  test("shows student ID and faculty", () => {
    const result = formatMainMenu(mockStudent);
    expect(result).toContain("6501234567");
    expect(result).toContain("Information Technology");
  });

  test("falls back to 'RSU' when faculty is missing", () => {
    const result = formatMainMenu({ ...mockStudent, faculty: null });
    expect(result).toContain("RSU");
  });
});

// ============================================================
// MAIN_MENU_KEYBOARD
// ============================================================
describe("MAIN_MENU_KEYBOARD — Unit Tests", () => {
  test("is a valid Telegram inline keyboard object", () => {
    expect(MAIN_MENU_KEYBOARD).toHaveProperty("inline_keyboard");
    expect(Array.isArray(MAIN_MENU_KEYBOARD.inline_keyboard)).toBe(true);
  });

  test("every button has text and callback_data", () => {
    const allButtons = MAIN_MENU_KEYBOARD.inline_keyboard.flat();
    allButtons.forEach((btn) => {
      expect(btn).toHaveProperty("text");
      expect(btn).toHaveProperty("callback_data");
      expect(typeof btn.text).toBe("string");
      expect(typeof btn.callback_data).toBe("string");
    });
  });

  test("contains Schedule, Grades, Midterm Exam and Final Exam buttons", () => {
    const labels = MAIN_MENU_KEYBOARD.inline_keyboard
      .flat()
      .map((b) => b.text);

    expect(labels.some((l) => l.includes("Schedule"))).toBe(true);
    expect(labels.some((l) => l.includes("Grades"))).toBe(true);
    expect(labels.some((l) => l.includes("Midterm"))).toBe(true);
    expect(labels.some((l) => l.includes("Final"))).toBe(true);
  });
});