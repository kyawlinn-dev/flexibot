import { createClient } from "@/lib/supabase/server";
import DeleteDocumentButton from "@/components/dashboard/delete-document-button";

function formatStatus(status: string) {
  switch (status) {
    case "uploaded_to_gcs":
      return "Uploaded";
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  let documents: any[] = [];

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/documents`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      documents = data.documents ?? [];
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Documents</h2>
        <p className="text-sm text-gray-500">
          View uploaded files and ingestion status
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">

          <table className="w-full text-sm table-fixed">

            {/* Header */}
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="p-3 text-left w-[220px]">Title</th>
                <th className="p-3 text-left w-[220px]">Filename</th>
                <th className="p-3 text-left w-[120px]">Status</th>
                <th className="p-3 text-left w-[180px]">Created</th>
                <th className="p-3 text-left">GCS URI</th>
                <th className="p-3 text-left w-[100px]">Actions</th>
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    No documents uploaded yet.
                  </td>
                </tr>
              ) : (
                documents.map((doc: any) => (
                  <tr
                    key={doc.id}
                    className="border-t hover:bg-gray-50 transition"
                  >
                    {/* Title (wrap) */}
                    <td className="p-3 align-top font-medium break-words">
                      {doc.title}
                    </td>

                    {/* Filename */}
                    <td className="p-3 align-top truncate text-gray-600">
                      {doc.filename}
                    </td>

                    {/* Status */}
                    <td className="p-3 align-top">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          doc.status === "ready"
                            ? "bg-green-100 text-green-700"
                            : doc.status === "importing"
                            ? "bg-yellow-100 text-yellow-700"
                            : doc.status === "uploaded_to_gcs"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {formatStatus(doc.status)}
                      </span>
                    </td>

                    {/* Created */}
                    <td className="p-3 align-top text-gray-500">
                      {new Date(doc.created_at).toLocaleString()}
                    </td>

                    {/* GCS URI */}
                    <td className="p-3 align-top truncate">
                      {doc.gcs_uri ? (
                        <a
                          href={doc.gcs_uri}
                          target="_blank"
                          className="text-blue-600 hover:underline"
                        >
                          View File
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 align-top">
                      {/* IMPORTANT: if crash happens, comment this */}
                      <DeleteDocumentButton documentId={doc.id} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>

          </table>
        </div>
      </div>
    </div>
  );
}