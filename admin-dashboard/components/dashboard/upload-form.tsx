"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type UploadResult = {
  success?: boolean;
  message?: string;
  document?: {
    id?: string;
    title?: string;
    filename?: string;
    status?: string;
    gcsUri?: string;
    ragOperationName?: string;
  };
};

export default function UploadForm() {
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setResult(null);

    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("description", description);

    try {
      setLoading(true);

      // Get the current session token to authenticate the backend request.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Your session has expired. Please log in again.");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/documents/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const data: UploadResult = await response.json();

      if (!response.ok) {
        setError(data.message || "Upload failed.");
        return;
      }

      setResult(data);
      setTitle("");
      setDescription("");
      setFile(null);

      const fileInput = document.getElementById("file") as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch {
      setError("Could not connect to backend upload service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Knowledge File</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Document Title</Label>
            <Input
              id="title"
              placeholder="e.g. Student Handbook 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Short note about this document"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt"
              required
            />
            <p className="text-sm text-muted-foreground">
              Supported types: PDF, DOC, DOCX, TXT
            </p>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {result?.message ? (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p>{result.message}</p>

                  {result.document?.gcsUri ? (
                    <p className="break-all text-sm text-muted-foreground">
                      GCS URI: {result.document.gcsUri}
                    </p>
                  ) : null}

                  {result.document?.ragOperationName ? (
                    <p className="break-all text-sm text-muted-foreground">
                      RAG Operation: {result.document.ragOperationName}
                    </p>
                  ) : null}

                  {result.document?.status ? (
                    <p className="text-sm text-muted-foreground">
                      Status: {result.document.status}
                    </p>
                  ) : null}
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={loading}>
            {loading ? "Uploading..." : "Upload File"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}