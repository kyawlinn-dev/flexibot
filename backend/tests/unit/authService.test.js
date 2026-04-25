// ============================================================
// __tests__/unit/authService.test.js
//
// TESTING TYPE: Unit Testing (with Mocks)
// Tests verifyStudentCredentials() by mocking the Supabase
// database and bcrypt — isolating the business logic only.
// ============================================================

import { jest } from "@jest/globals";

// ── Mock external modules before importing authService ──────
//
// We mock these so tests run without a real database or
// hashed-password computation. This is the "test double"
// technique for unit testing.

// Mock Supabase client used inside authService
jest.unstable_mockModule("../../src/lib/supabase.js", () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

// Mock bcryptjs so we control password comparison results
jest.unstable_mockModule("bcryptjs", () => ({
  default: {
    compare: jest.fn(),
    hash: jest.fn(),
  },
}));

// Mock sessionService (not under test here)
jest.unstable_mockModule("../../src/services/sessionService.js", () => ({
  clearLoginState: jest.fn(),
  updateSession: jest.fn(),
}));

// ── Dynamic import AFTER mocks are registered ───────────────
const { verifyStudentCredentials, findStudentByStudentId } =
  await import("../../src/services/authService.js");

const { supabaseAdmin } = await import("../../src/lib/supabase.js");
const bcrypt = (await import("bcryptjs")).default;

// ── Helper: set up Supabase mock chain ──────────────────────
function mockSupabaseQuery(returnValue) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(returnValue),
  };
  supabaseAdmin.from.mockReturnValue(chain);
  return chain;
}

// ============================================================
// findStudentByStudentId
// ============================================================
describe("findStudentByStudentId — Unit Tests", () => {
  afterEach(() => jest.clearAllMocks());

  test("returns student data when student exists", async () => {
    const fakeStudent = {
      student_id: "6501234567",
      full_name: "Somsak Jaidee",
      status: "active",
    };
    mockSupabaseQuery({ data: fakeStudent, error: null });

    const result = await findStudentByStudentId("6501234567");
    expect(result).toEqual(fakeStudent);
  });

  test("returns null when student does not exist", async () => {
    mockSupabaseQuery({ data: null, error: null });

    const result = await findStudentByStudentId("0000000000");
    expect(result).toBeNull();
  });

  test("throws when Supabase returns an error", async () => {
    mockSupabaseQuery({ data: null, error: { message: "DB connection failed" } });

    await expect(findStudentByStudentId("6501234567")).rejects.toMatchObject({
      message: "DB connection failed",
    });
  });
});

// ============================================================
// verifyStudentCredentials
// ============================================================
describe("verifyStudentCredentials — Unit Tests", () => {
  afterEach(() => jest.clearAllMocks());

  test("returns ok:false with 'not found' reason when student does not exist", async () => {
    mockSupabaseQuery({ data: null, error: null });

    const result = await verifyStudentCredentials("9999999999", "anypassword");

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });

  test("returns ok:false with 'incorrect password' reason on wrong password", async () => {
    const fakeStudent = {
      student_id: "6501234567",
      full_name: "Somsak Jaidee",
      status: "active",
      password_hash: "$2b$FAKE_HASH",
    };
    mockSupabaseQuery({ data: fakeStudent, error: null });
    bcrypt.compare.mockResolvedValue(false); // wrong password

    const result = await verifyStudentCredentials("6501234567", "wrongpass");

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/incorrect password/i);
  });

  test("returns ok:false when account is inactive (even with correct password)", async () => {
    const fakeStudent = {
      student_id: "6501234567",
      full_name: "Somsak Jaidee",
      status: "inactive",           // <-- account disabled
      password_hash: "$2b$FAKE_HASH",
    };
    mockSupabaseQuery({ data: fakeStudent, error: null });
    bcrypt.compare.mockResolvedValue(true); // password is correct

    const result = await verifyStudentCredentials("6501234567", "correctpass");

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not active/i);
  });

  test("returns ok:true and student object on successful login", async () => {
    const fakeStudent = {
      student_id: "6501234567",
      full_name: "Somsak Jaidee",
      status: "active",
      password_hash: "$2b$FAKE_HASH",
    };
    mockSupabaseQuery({ data: fakeStudent, error: null });
    bcrypt.compare.mockResolvedValue(true); // correct password

    const result = await verifyStudentCredentials("6501234567", "correctpass");

    expect(result.ok).toBe(true);
    expect(result.student).toEqual(fakeStudent);
  });

  test("bcrypt.compare is called with the raw password and stored hash", async () => {
    const fakeStudent = {
      student_id: "6501234567",
      full_name: "Somsak Jaidee",
      status: "active",
      password_hash: "$2b$STORED_HASH",
    };
    mockSupabaseQuery({ data: fakeStudent, error: null });
    bcrypt.compare.mockResolvedValue(true);

    await verifyStudentCredentials("6501234567", "mypassword123");

    expect(bcrypt.compare).toHaveBeenCalledWith("mypassword123", "$2b$STORED_HASH");
  });
});