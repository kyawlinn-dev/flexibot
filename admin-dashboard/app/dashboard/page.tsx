import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, Database } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">

      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Dashboard Overview
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage documents, monitor ingestion, and control your RAG knowledge system.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        
        {/* Total Documents */}
        <Card className="shadow-sm hover:shadow-md transition">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Total Documents
            </CardTitle>
            <FileText className="w-5 h-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-gray-500">
              Documents in knowledge base
            </p>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className="shadow-sm hover:shadow-md transition">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Pending Ingestion
            </CardTitle>
            <Clock className="w-5 h-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-gray-500">
              Files waiting for processing
            </p>
          </CardContent>
        </Card>

        {/* Status */}
        <Card className="shadow-sm hover:shadow-md transition">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Corpus Status
            </CardTitle>
            <Database className="w-5 h-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">Ready</p>
            <p className="text-sm text-gray-500">
              System is connected and operational
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Section */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">System Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            This shows how your data flows through the system:
          </p>

          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700">
              Admin Upload
            </span>
            →
            <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700">
              Express API
            </span>
            →
            <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700">
              Google Cloud Storage
            </span>
            →
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">
              RAG Corpus
            </span>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}