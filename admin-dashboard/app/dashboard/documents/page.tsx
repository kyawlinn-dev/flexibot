import { createClient } from "@/lib/supabase/server";
import DeleteDocumentButton from "@/components/dashboard/delete-document-button";

async function getDocuments(accessToken: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/documents`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch documents.");
  }

  return res.json();
}

function getStatusClass(status: string) {
  switch (status) {
    case "ready":
      return "text-green-600";
    case "importing":
      return "text-amber-600";
    case "uploaded_to_gcs":
      return "text-blue-600";
    case "failed":
      return "text-red-600";
    default:
      return "text-zinc-600";
  }
}

function formatStatus(status: string) {
  switch (status) {
    case "uploaded_to_gcs":
      return "Uploaded to GCS";
    case "importing":
      return "Importing";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const data = await getDocuments(session?.access_token ?? "");
  const documents = data.documents ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Documents</h2>
        <p className="text-sm text-muted-foreground">
          View uploaded files and ingestion status.
        </p>
      </div>

      <div className="rounded-lg border bg-background">
        <div className="grid grid-cols-6 border-b px-4 py-3 text-sm font-medium">
          <div>Title</div>
          <div>Filename</div>
          <div>Status</div>
          <div>Created</div>
          <div>GCS URI</div>
          <div>Actions</div>
        </div>

        {documents.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No documents uploaded yet.
          </div>
        ) : (
          documents.map((doc: any) => (
            <div
              key={doc.id}
              className="grid grid-cols-6 border-b px-4 py-3 text-sm last:border-b-0"
            >
              <div>{doc.title}</div>
              <div>{doc.filename}</div>
              <div>{new Date(doc.created_at).toLocaleString()}</div>
              <div className={getStatusClass(doc.status)}>{formatStatus(doc.status)}</div>
              <div className="truncate">{doc.gcs_uri || "-"}</div>
              <div><DeleteDocumentButton documentId={doc.id} /></div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}