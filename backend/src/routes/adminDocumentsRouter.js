import express from "express";
import multer from "multer";
import { uploadBufferToGCS } from "../services/gcsService.js";
import { importGcsFileToRagCorpus } from "../services/ragImportService.js";
import {
  createDocumentRecord,
  updateDocumentRecord,
  listDocumentRecords,
} from "../services/documentService.js";
import { deleteKnowledgeDocument } from "../services/documentDeleteService.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

function sanitizeFileName(name) {
  return name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
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

router.post("/documents/upload", upload.single("file"), async (req, res) => {
  let documentRecord = null;

  try {
    const { title, description } = req.body;
    const file = req.file;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Document title is required.",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded.",
      });
    }

    documentRecord = await createDocumentRecord({
      title,
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
      mimetype: file.mimetype,
    });

    documentRecord = await updateDocumentRecord(documentRecord.id, {
      gcs_uri: gcsResult.gcsUri,
      status: "uploaded_to_gcs",
    });

    const importResult = await importGcsFileToRagCorpus({
        gcsUri: gcsResult.gcsUri,
        displayName: title,
    });

    documentRecord = await updateDocumentRecord(documentRecord.id, {
        rag_operation_name: importResult.operationName,
        rag_file_name: importResult.ragFileName || null,
        status: "importing",
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
        await updateDocumentRecord(documentRecord.id, {
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