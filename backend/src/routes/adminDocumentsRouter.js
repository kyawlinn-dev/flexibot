import express from "express";
import multer from "multer";
import path from "path";
import { uploadBufferToGCS } from "../services/gcsService.js";
import { importGcsFileToRagCorpus } from "../services/ragImportService.js";
import {
  createDocumentRecord,
  updateDocumentRecord,
  listDocumentRecords,
} from "../services/documentService.js";
import { deleteKnowledgeDocument } from "../services/documentDeleteService.js";

const router = express.Router();

const SUPPORTED_FILE_RULES = {
  ".pdf": {
    label: "PDF",
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: ["application/pdf"],
  },
  ".docx": {
    label: "DOCX",
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
      "application/octet-stream",
    ],
  },
  ".pptx": {
    label: "PPTX",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
      "application/octet-stream",
    ],
  },
  ".html": {
    label: "HTML",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["text/html", "application/octet-stream"],
  },
  ".htm": {
    label: "HTML",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["text/html", "application/octet-stream"],
  },
  ".json": {
    label: "JSON",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["application/json", "text/plain", "application/octet-stream"],
  },
  ".jsonl": {
    label: "JSONL",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["application/json", "text/plain", "application/octet-stream"],
  },
  ".ndjson": {
    label: "NDJSON",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: [
      "application/json",
      "application/x-ndjson",
      "text/plain",
      "application/octet-stream",
    ],
  },
  ".md": {
    label: "Markdown",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["text/markdown", "text/plain", "application/octet-stream"],
  },
  ".txt": {
    label: "Text",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["text/plain", "application/octet-stream"],
  },
};

const GLOBAL_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: GLOBAL_MAX_UPLOAD_BYTES,
  },
});

function sanitizeFileName(name) {
  return name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}

function getExtension(filename = "") {
  return path.extname(filename).toLowerCase();
}

function getSupportedUploadSummary() {
  return Object.entries(SUPPORTED_FILE_RULES)
    .map(([ext, rule]) => `${ext} (${rule.maxBytes / 1024 / 1024} MB max)`)
    .join(", ");
}

function validateUploadedFile(file) {
  if (!file) {
    return "No file uploaded.";
  }

  const ext = getExtension(file.originalname);
  const rule = SUPPORTED_FILE_RULES[ext];

  if (!rule) {
    return [
      `Unsupported file type: ${ext || "(no extension)"}.`,
      "Supported types are:",
      getSupportedUploadSummary(),
      "Note: .doc is not supported. Use .docx instead.",
    ].join(" ");
  }

  if (file.size > rule.maxBytes) {
    return `${rule.label} exceeds the allowed size limit of ${
      rule.maxBytes / 1024 / 1024
    } MB.`;
  }

  if (
    file.mimetype &&
    rule.mimeTypes.length > 0 &&
    !rule.mimeTypes.includes(file.mimetype)
  ) {
    return `File MIME type "${file.mimetype}" does not match expected type for ${rule.label}.`;
  }

  return null;
}

router.get("/documents", async (_req, res) => {
  try {
    const documents = await listDocumentRecords();

    return res.status(200).json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error("list documents error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch documents.",
    });
  }
});

router.post("/documents/upload", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File is too large. Maximum upload size is 50 MB.",
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    return next(err);
  });
});

router.post("/documents/upload", async (req, res) => {
  let documentRecord = null;

  try {
    const { title, description } = req.body;
    const file = req.file;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Document title is required.",
      });
    }

    const validationError = validateUploadedFile(file);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    documentRecord = await createDocumentRecord({
      title: title.trim(),
      description: description || "",
      filename: file.originalname,
      uploadedBy: "admin",
    });

    const safeFileName = sanitizeFileName(file.originalname);
    const timestamp = Date.now();
    const destination = `admin-uploads/${timestamp}-${safeFileName}`;

    const gcsResult = await uploadBufferToGCS({
      buffer: file.buffer,
      destination,
      mimetype: file.mimetype || "application/octet-stream",
    });

    documentRecord = await updateDocumentRecord(documentRecord.id, {
      gcs_uri: gcsResult.gcsUri,
      status: "uploaded_to_gcs",
      error_message: null,
    });

    const importResult = await importGcsFileToRagCorpus({
      gcsUri: gcsResult.gcsUri,
      displayName: title.trim(),
    });

    documentRecord = await updateDocumentRecord(documentRecord.id, {
      rag_operation_name: importResult.operationName,
      rag_file_name: importResult.ragFileName || null,
      status: "importing",
      error_message: null,
    });

    return res.status(200).json({
      success: true,
      message: "File uploaded to GCS and RAG import started.",
      document: documentRecord,
    });
  } catch (error) {
    console.error("admin upload error:", error);

    if (documentRecord?.id) {
      try {
        documentRecord = await updateDocumentRecord(documentRecord.id, {
          status: "failed",
          error_message: error.message || "Unknown upload error",
        });
      } catch (updateError) {
        console.error("failed to update document error state:", updateError);
      }
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Upload failed on backend.",
      document: documentRecord,
    });
  }
});

router.delete("/documents/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await deleteKnowledgeDocument(id);

    return res.json({
      success: true,
      message: "Knowledge deleted successfully",
    });
  } catch (error) {
    console.error("delete knowledge error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;