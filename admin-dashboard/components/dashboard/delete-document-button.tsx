"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DeleteDocumentButtonProps = {
  documentId: string;
};

export default function DeleteDocumentButton({
  documentId,
}: DeleteDocumentButtonProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this knowledge document?"
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      // Get the current session token to authenticate the backend request.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Your session has expired. Please log in again.");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/documents/${documentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to delete document.");
        return;
      }

      window.location.reload();
    } catch {
      alert("Something went wrong while deleting the document.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}