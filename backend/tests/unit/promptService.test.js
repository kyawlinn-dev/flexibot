// ============================================================
// __tests__/unit/promptService.test.js
//
// TESTING TYPE: Unit Testing
// Tests the prompt-building functions that feed into Gemini AI.
// Pure functions — no external dependencies.
// ============================================================

import {
  buildSystemPrompt,
  buildFallbackPrompt,
} from "../../src/services/promptService.js";

// ── Shared mock data ────────────────────────────────────────
const mockStudent = {
  student_id: "6501234567",
  full_name: "Somsak Jaidee",
  faculty: "Information Technology",
};

// ============================================================
// buildSystemPrompt
// ============================================================
describe("buildSystemPrompt — Unit Tests", () => {
  test("returns a non-empty string", () => {
    const result = buildSystemPrompt("What is the library schedule?");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("contains the user question", () => {
    const question = "What are the library opening hours?";
    const result = buildSystemPrompt(question);
    expect(result).toContain(question);
  });

  test("contains 'RSU AI Assistant' identity", () => {
    const result = buildSystemPrompt("Hello");
    expect(result).toContain("RSU AI Assistant");
  });

  test("includes student context when provided", () => {
    const result = buildSystemPrompt(
      "What are my grades?",
      mockStudent
    );
    expect(result).toContain(mockStudent.student_id);
    expect(result).toContain(mockStudent.full_name);
  });

  test("does NOT include student context section when null", () => {
    const result = buildSystemPrompt("General question", null);
    // Should not contain "Student Context:" block
    expect(result).not.toContain("Student Context:");
  });

  test("includes conversation summary when provided", () => {
    const summary = "User was asking about exam dates earlier.";
    const result = buildSystemPrompt("Any updates?", null, summary);
    expect(result).toContain(summary);
  });

  test("does NOT include conversation summary section when null", () => {
    const result = buildSystemPrompt("Hi", null, null);
    expect(result).not.toContain("Conversation Summary:");
  });

  test("includes memory items when provided", () => {
    const memory = [
      { content: "User prefers Thai language responses" },
      { content: "User is in Faculty of Engineering" },
    ];
    const result = buildSystemPrompt("Tell me about the IT lab", null, null, memory);
    expect(result).toContain("User prefers Thai language responses");
    expect(result).toContain("User is in Faculty of Engineering");
  });

  test("does NOT include memory block when array is empty", () => {
    const result = buildSystemPrompt("Hi", null, null, []);
    expect(result).not.toContain("User long-term memory:");
  });

  test("includes RAG-only rule (should not use outside knowledge)", () => {
    const result = buildSystemPrompt("What is the fee?");
    expect(result).toContain("ONLY answer using the retrieved university documents");
  });

  test("includes privacy/security rules", () => {
    const result = buildSystemPrompt("Tell me other students' grades");
    expect(result).toContain("Never access or guess student grades");
  });
});

// ============================================================
// buildFallbackPrompt
// ============================================================
describe("buildFallbackPrompt — Unit Tests", () => {
  test("returns a non-empty string", () => {
    const result = buildFallbackPrompt("What is Docker?");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("contains the user question", () => {
    const question = "Explain how Docker containers work.";
    const result = buildFallbackPrompt(question);
    expect(result).toContain(question);
  });

  test("contains 'RSU AI Assistant' identity", () => {
    const result = buildFallbackPrompt("Hello");
    expect(result).toContain("RSU AI Assistant");
  });

  test("explicitly allows general knowledge answers", () => {
    const result = buildFallbackPrompt("What is Python?");
    expect(result).toContain("general knowledge");
  });

  test("instructs NOT to say 'I don't have that information' (already handled upstream)", () => {
    const result = buildFallbackPrompt("Anything");
    expect(result).toContain("NEVER say");
    expect(result).toContain("I don't have that information in the university documents");
  });

  test("includes student context when provided", () => {
    const result = buildFallbackPrompt("Help me study", mockStudent);
    expect(result).toContain(mockStudent.student_id);
  });

  test("includes memory items when provided", () => {
    const memory = [{ content: "Prefers English responses" }];
    const result = buildFallbackPrompt("Hi", null, null, memory);
    expect(result).toContain("Prefers English responses");
  });

  test("does NOT include memory block when array is empty", () => {
    const result = buildFallbackPrompt("Hi", null, null, []);
    expect(result).not.toContain("User long-term memory:");
  });

  test("system prompt and fallback prompt are DIFFERENT strings", () => {
    const question = "What is machine learning?";
    const system = buildSystemPrompt(question);
    const fallback = buildFallbackPrompt(question);
    // They serve different purposes; content should differ
    expect(system).not.toBe(fallback);
  });
});