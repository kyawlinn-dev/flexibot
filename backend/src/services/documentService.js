import { supabaseAdmin } from "../lib/supabase.js";

export async function createDocumentRecord({
  title,
  description,
  filename,
  uploadedBy,
}) {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .insert({
      title,
      description,
      filename,
      uploaded_by: uploadedBy || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create document record: ${error.message}`);
  }

  return data;
}

export async function updateDocumentRecord(id, updates) {
  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("documents")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update document record: ${error.message}`);
  }

  return data;
}

export async function listDocumentRecords() {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("*")
    // Exclude rows left behind by the old soft-delete bug, and any
    // in-progress deletions that have not finished yet
    .not('status', 'in', '(deleted,deleting)')
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list documents: ${error.message}`);
  }

  return data;
}

export async function listImportingDocuments() {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("status", "importing")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list importing documents: ${error.message}`);
  }

  return data;
}

export async function markDocumentImported(id) {
  return await updateDocumentRecord(id, {
    status: "imported",
    error_message: null,
  });
}

export async function getDocumentRecordById(id) {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`Failed to get document: ${error.message}`);
  }

  return data;
}

export async function deleteDocumentRecord(id) {
  const { error } = await supabaseAdmin
    .from("documents")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }

  return true;
}