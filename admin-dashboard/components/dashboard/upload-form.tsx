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
  rag_error?: string;
  document?: {
    id?: string;
    title?: string;
    filename?: string;
    status?: string;
    gcs_uri?: string;
    rag_operation_name?: string;
    error_message?: string;
  };
};

const SUPPORTED_FILE_RULES = {
  ".pdf": { label: "PDF", maxBytes: 50 * 1024 * 1024 },
  ".docx": { label: "DOCX", maxBytes: 50 * 1024 * 1024 },
  ".pptx": { label: "PPTX", maxBytes: 10 * 1024 * 1024 },
  ".html": { label: "HTML", maxBytes: 10 * 1024 * 1024 },
  ".htm": { label: "HTML", maxBytes: 10 * 1024 * 1024 },
  ".json": { label: "JSON", maxBytes: 10 * 1024 * 1024 },
  ".jsonl": { label: "JSONL", maxBytes: 10 * 1024 * 1024 },
  ".ndjson": { label: "NDJSON", maxBytes: 10 * 1024 * 1024 },
  ".md": { label: "Markdown", maxBytes: 10 * 1024 * 1024 },
  ".txt": { label: "Text", maxBytes: 10 * 1024 * 1024 },
} as const;

const FILE_INPUT_ACCEPT =
  ".pdf,.docx,.pptx,.html,.htm,.json,.jsonl,.ndjson,.md,.txt";

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}

function formatMb(bytes: number): string {
  return `${bytes / 1024 / 1024} MB`;
}

function validateUploadFile(file: File | null): string | null {
  if (!file) {
    return "Please choose a file to upload.";
  }

  const ext = getFileExtension(file.name);
  const rule = SUPPORTED_FILE_RULES[ext as keyof typeof SUPPORTED_FILE_RULES];

  if (!rule) {
    return "Unsupported file type. Allowed: PDF, DOCX, PPTX, HTML, JSON, JSONL, NDJSON, Markdown, TXT. Use .docx instead of .doc.";
  }

  if (file.size > rule.maxBytes) {
    return `${rule.label} exceeds the allowed size limit of ${formatMb(
      rule.maxBytes
    )}.`;
  }

  return null;
}

export default function UploadForm() {
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);

  function clearFileInput() {
    const fileInput = document.getElementById("file") as HTMLInputElement | null;
    if (fileInput) {
      fileInput.value = "";
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] ?? null;

    setResult(null);

    const validationError = validateUploadFile(selectedFile);

    if (validationError) {
      setFile(null);
      setError(validationError);
      clearFileInput();
      return;
    }

    setFile(selectedFile);
    setError("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setResult(null);

    if (!title.trim()) {
      setError("Document title is required.");
      return;
    }

    const validationError = validateUploadFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("description", description);

    try {
      setLoading(true);

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

      if (!data.success) {
        setError(data.rag_error || data.message || "RAG import failed.");
        return;
      }

      setTitle("");
      setDescription("");
      setFile(null);
      clearFileInput();
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
              accept={FILE_INPUT_ACCEPT}
              required
            />
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                Supported: PDF, DOCX, PPTX, HTML, JSON, JSONL, NDJSON, Markdown, TXT
              </p>
              <p>PDF and DOCX: up to 50 MB</p>
              <p>PPTX, HTML, JSON, JSONL, NDJSON, Markdown, TXT: up to 10 MB</p>
            </div>
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

                  {result.document?.gcs_uri ? (
                    <p className="break-all text-sm text-muted-foreground">
                      GCS URI: {result.document.gcs_uri}
                    </p>
                  ) : null}

                  {result.document?.rag_operation_name ? (
                    <p className="break-all text-sm text-muted-foreground">
                      RAG Operation: {result.document.rag_operation_name}
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