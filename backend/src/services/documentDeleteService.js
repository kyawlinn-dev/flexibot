import { getDocumentRecordById, updateDocumentRecord, deleteDocumentRecord } from "./documentService.js";
import { deleteFileFromGCS } from "./gcsDeleteService.js";
import { deleteRagFile } from "./ragDeleteService.js";
import { clearAllConversations } from "./conversationStore.js";

export async function deleteKnowledgeDocument(documentId) {

  const doc = await getDocumentRecordById(documentId);

  if (!doc) {
    throw new Error("Document not found");
  }

  await updateDocumentRecord(documentId, {
    status: "deleting",
  });

  try {

    // 1️⃣ Delete from RAG corpus
    if (doc.rag_file_name) {
      await deleteRagFile(doc.rag_file_name);
      console.log(`Deleted from RAG corpus: ${doc.rag_file_name}`);
    } else {
      console.warn(`Document ${documentId} has no rag_file_name — skipping RAG deletion`);
    }

    // 2️⃣ Delete from GCS
    // Bug fix B1: was doc.source_path (always undefined), correct field is doc.gcs_uri
    if (doc.gcs_uri) {
      await deleteFileFromGCS(doc.gcs_uri);
      console.log(`Deleted from GCS: ${doc.gcs_uri}`);
    } else {
      console.warn(`Document ${documentId} has no gcs_uri — skipping GCS deletion`);
    }

    // 3️⃣ Hard-delete the Supabase row
    await deleteDocumentRecord(documentId);
    console.log(`Deleted document record from database: ${documentId}`);

    // 4️⃣ Clear all conversation history — conversations that referenced
    // this document are stale and could confuse future answers
    await clearAllConversations();

  } catch (error) {

    // If external cleanup failed, mark the row so the admin can see it
    await updateDocumentRecord(documentId, {
      status: "delete_failed",
      error_message: error.message,
    });

    throw error;
  }

}