import express from "express";
import multer from "multer";
import { uploadBufferToGCS } from "../services/gcsService.js";
import { importGcsFileToRagCorpus } from "../services/ragImportService.js";

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

router.post("/documents/upload", upload.single("file"), async (req, res) => {
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

    console.log("=== ADMIN UPLOAD RECEIVED ===");
    console.log("title:", title);
    console.log("description:", description || "");
    console.log("filename:", file.originalname);
    console.log("mimetype:", file.mimetype);
    console.log("size:", file.size);

    const safeFileName = sanitizeFileName(file.originalname);
    const timestamp = Date.now();
    const destination = `admin-uploads/${timestamp}-${safeFileName}`;

    const gcsResult = await uploadBufferToGCS({
      buffer: file.buffer,
      destination,
      mimetype: file.mimetype,
    });

    console.log("uploaded to GCS:", gcsResult.gcsUri);

    const importResult = await importGcsFileToRagCorpus({
      gcsUri: gcsResult.gcsUri,
      displayName: title,
    });

    console.log("RAG import started:", importResult.operationName);
    console.log("RAG parent:", importResult.parent);

    return res.status(200).json({
      success: true,
      message: "File uploaded to GCS and RAG import started.",
      document: {
        id: timestamp.toString(),
        title,
        description: description || "",
        filename: file.originalname,
        status: "processing",
        gcsUri: gcsResult.gcsUri,
        ragOperationName: importResult.operationName,
      },
    });
  } catch (error) {
    console.error("admin upload error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Upload failed on backend.",
    });
  }
});

export default router;