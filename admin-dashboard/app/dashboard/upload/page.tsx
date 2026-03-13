import UploadForm from "@/components/dashboard/upload-form";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Upload Data</h2>
        <p className="text-sm text-muted-foreground">
          Upload a document to Google Cloud Storage and import it into your Vertex AI RAG corpus.
        </p>
      </div>

      <UploadForm />
    </div>
  );
}