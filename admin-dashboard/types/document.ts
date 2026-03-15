export type DocumentStatus = "Uploaded" | "Ingesting" | "Ready" | "Failed";

export type DocumentItem = {
  id: number;
  name: string;
  source: string;
  status: DocumentStatus;
  updatedAt: string;
  description?: string;
};      