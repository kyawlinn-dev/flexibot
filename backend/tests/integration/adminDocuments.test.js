// ============================================================
// __tests__/integration/adminDocuments.test.js
//
// TESTING TYPE: Integration Testing
// Tests how the Express routes, auth middleware, and document
// service work together — without a real database or cloud.
//
// External services (Supabase, GCS, Vertex AI RAG) are mocked
// so the tests focus on the interaction between components:
//   HTTP layer → authMiddleware → route handler → service layer
// ============================================================

import { jest } from "@jest/globals";
import request from "supertest";

// ── Mock all external cloud/DB modules ──────────────────────

// Mock Supabase (used by authMiddleware and documentService)
jest.unstable_mockModule("../../src/lib/supabase.js", () => ({
  supabaseAdmin: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

// Mock Google Cloud Storage
jest.unstable_mockModule("../../src/services/gcsService.js", () => ({
  uploadBufferToGCS: jest.fn(),
}));

// Mock Vertex AI RAG import
jest.unstable_mockModule("../../src/services/ragImportService.js", () => ({
  importGcsFileToRagCorpus: jest.fn(),
}));

// Mock document CRUD services
jest.unstable_mockModule("../../src/services/documentService.js", () => ({
  createDocumentRecord: jest.fn(),
  updateDocumentRecord: jest.fn(),
  listDocumentRecords: jest.fn(),
}));

// Mock document delete pipeline
jest.unstable_mockModule("../../src/services/documentDeleteService.js", () => ({
  deleteKnowledgeDocument: jest.fn(),
}));

// ── Dynamic imports AFTER mocks ──────────────────────────────
const { supabaseAdmin } = await import("../../src/lib/supabase.js");
const { listDocumentRecords } = await import("../../src/services/documentService.js");
const { deleteKnowledgeDocument } = await import(
  "../../src/services/documentDeleteService.js"
);
const { uploadBufferToGCS } = await import("../../src/services/gcsService.js");
const { importGcsFileToRagCorpus } = await import(
  "../../src/services/ragImportService.js"
);
const { createDocumentRecord, updateDocumentRecord } = await import(
  "../../src/services/documentService.js"
);

// Build a minimal Express app that mirrors the real server.js setup:
//   app.use("/api/admin", authMiddleware, adminDocumentsRouter)
// This ensures auth middleware and route paths are tested together.
import express from "express";
const { authMiddleware } = await import("../../src/middleware/authMiddleware.js");
const { default: adminDocumentsRouter } = await import(
  "../../src/routes/adminDocumentsRouter.js"
);

const app = express();
app.use(express.json());
app.use("/api/admin", authMiddleware, adminDocumentsRouter);

// ── Helper ───────────────────────────────────────────────────
const VALID_TOKEN = "valid.jwt.token";
const FAKE_USER = { id: "admin-uuid-1", email: "admin@rsu.ac.th" };

function mockValidAuth() {
  supabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user: FAKE_USER },
    error: null,
  });
}

function mockInvalidAuth() {
  supabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: "Invalid token" },
  });
}

// ============================================================
// Auth Middleware — Integration with route
// ============================================================
describe("GET /api/admin/documents — Auth Middleware Integration", () => {
  afterEach(() => jest.clearAllMocks());

  test("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).get("/api/admin/documents");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("returns 401 when Bearer token is invalid or expired", async () => {
    mockInvalidAuth();

    const res = await request(app)
      .get("/api/admin/documents")
      .set("Authorization", "Bearer expired.token");

    expect(res.status).toBe(401);
  });

  test("proceeds past auth and returns 200 with document list on valid token", async () => {
    mockValidAuth();
    listDocumentRecords.mockResolvedValue([
      { id: "doc-1", filename: "lecture1.pdf", status: "ready" },
      { id: "doc-2", filename: "handbook.docx", status: "ready" },
    ]);

    const res = await request(app)
      .get("/api/admin/documents")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.documents).toHaveLength(2);
  });

  test("attaches verified user to request before passing to route handler", async () => {
    mockValidAuth();
    listDocumentRecords.mockResolvedValue([]);

    // If auth middleware works correctly, the route handler receives req.user
    // and responds 200 (not 401)
    const res = await request(app)
      .get("/api/admin/documents")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    // Middleware called getUser with our token
    expect(supabaseAdmin.auth.getUser).toHaveBeenCalledWith(VALID_TOKEN);
  });
});

// ============================================================
// DELETE /api/admin/documents/:id — Integration
// ============================================================
describe("DELETE /api/admin/documents/:id — Integration Tests", () => {
  afterEach(() => jest.clearAllMocks());

  test("returns 401 without a valid token", async () => {
    const res = await request(app).delete("/api/admin/documents/doc-1");
    expect(res.status).toBe(401);
  });

  test("returns 200 and success message when deletion completes", async () => {
    mockValidAuth();
    deleteKnowledgeDocument.mockResolvedValue({ success: true });

    const res = await request(app)
      .delete("/api/admin/documents/doc-1")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(deleteKnowledgeDocument).toHaveBeenCalledWith("doc-1");
  });

  test("calls deleteKnowledgeDocument with the correct document ID from URL", async () => {
    mockValidAuth();
    deleteKnowledgeDocument.mockResolvedValue({ success: true });

    await request(app)
      .delete("/api/admin/documents/abc-123")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(deleteKnowledgeDocument).toHaveBeenCalledWith("abc-123");
  });

  test("returns 500 when the delete service throws an error", async () => {
    mockValidAuth();
    deleteKnowledgeDocument.mockRejectedValue(new Error("GCS connection failed"));

    const res = await request(app)
      .delete("/api/admin/documents/doc-1")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(500);
  });
});

// ============================================================
// POST /api/admin/documents/upload — Integration
// ============================================================
describe("POST /api/admin/documents/upload — Integration Tests", () => {
  afterEach(() => jest.clearAllMocks());

  test("returns 401 when Authorization header is missing", async () => {
    const res = await request(app)
      .post("/api/admin/documents/upload")
      .attach("file", Buffer.from("fake content"), "test.pdf");

    expect(res.status).toBe(401);
  });

  test("returns 400 when no file is attached", async () => {
    mockValidAuth();

    const res = await request(app)
      .post("/api/admin/documents/upload")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .field("title", "Test Document"); // title required but no file

    expect(res.status).toBe(400);
  });

  test("returns 400 for unsupported file type (e.g. .exe)", async () => {
    mockValidAuth();

    const res = await request(app)
      .post("/api/admin/documents/upload")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .field("title", "Test Document")
      .attach("file", Buffer.from("fake binary"), "malware.exe");

    expect(res.status).toBe(400);
  });

  test("accepts a valid PDF and calls GCS upload + RAG import", async () => {
    mockValidAuth();

    uploadBufferToGCS.mockResolvedValue({ gcsUri: "gs://bucket/test.pdf" });
    createDocumentRecord.mockResolvedValue({ id: "new-doc-id" });
    importGcsFileToRagCorpus.mockResolvedValue({
      operationName: "op-123",
      ragFileName: "rag-file-123",
    });
    updateDocumentRecord.mockResolvedValue({ id: "new-doc-id", status: "importing" });

    const res = await request(app)
      .post("/api/admin/documents/upload")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .field("title", "Lecture Notes")
      .attach("file", Buffer.from("%PDF-fake"), "lecture.pdf");

    // Upload pipeline should have been triggered
    expect(uploadBufferToGCS).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});