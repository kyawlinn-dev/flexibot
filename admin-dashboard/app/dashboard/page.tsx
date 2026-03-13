import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        <p className="text-sm text-muted-foreground">
          Welcome to the admin panel. This dashboard will manage document upload,
          storage, and RAG corpus ingestion.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">
              Documents uploaded into the knowledge base
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Ingestion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">
              Files waiting for processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Corpus Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">Ready</p>
            <p className="text-sm text-muted-foreground">
              Vertex AI RAG integration will be connected next
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Next Build Step</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The next step is building the Upload Data page and connecting it to
            your backend pipeline:
          </p>

          <div className="mt-4 rounded-lg border bg-background p-4 text-sm">
            Admin Upload → Express API → Google Cloud Storage → RAG Corpus
          </div>
        </CardContent>
      </Card>
    </div>
  );
}