import {
  listImportingDocuments,
  updateDocumentRecord,
} from "../services/documentService.js";
import { getRagOperationStatus, findRagFileByGcsUri } from "../services/ragOperationService.js";

let isRunning = false;

export async function runRagStatusWorker() {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const documents = await listImportingDocuments();

    if (!documents.length) {
      return;
    }

    for (const doc of documents) {
      try {
        if (!doc.rag_operation_name) {
          await updateDocumentRecord(doc.id, {
            status: "failed",
            error_message: "Missing rag_operation_name",
          });
          continue;
        }

        const operation = await getRagOperationStatus(doc.rag_operation_name);

        if (!operation.done) {
          continue;
        }

        if (operation.error) {
          await updateDocumentRecord(doc.id, {
            status: "failed",
            error_message: operation.error.message || "RAG import failed",
          });
          continue;
        }

        // The importRagFiles LRO response does not include the individual
        // rag_file_name. We resolve it by listing the corpus and matching
        // on the gcs_uri we stored at upload time.
        let ragFileName = null;

        if (doc.gcs_uri) {
          ragFileName = await findRagFileByGcsUri(doc.gcs_uri);

          if (ragFileName) {
            console.log(`  rag_file_name resolved: ${ragFileName}`);
          } else {
            console.warn(`  Could not resolve rag_file_name for gcs_uri: ${doc.gcs_uri}`);
          }
        }

        await updateDocumentRecord(doc.id, {
          status: "imported",
          error_message: null,
          ...(ragFileName ? { rag_file_name: ragFileName } : {}),
        });

        console.log(`Document imported successfully: ${doc.id} (${doc.title})`);

      } catch (error) {
        console.error(`Worker error for document ${doc.id}:`, error);

        await updateDocumentRecord(doc.id, {
          status: "failed",
          error_message: error.message || "Unknown worker error",
        });
      }
    }
  } catch (error) {
    console.error("RAG status worker failed:", error);
  } finally {
    isRunning = false;
  }
}

export function startRagStatusWorker() {
  const intervalMs = 30000;

  console.log(`RAG status worker started (every ${intervalMs / 1000}s)`);

  runRagStatusWorker();

  setInterval(() => {
    runRagStatusWorker();
  }, intervalMs);
}