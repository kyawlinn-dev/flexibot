import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

export async function deleteRagFile(ragFileName) {
  if (!ragFileName) {
    throw new Error("ragFileName is required");
  }

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  const accessToken =
    typeof tokenResponse === "string"
      ? tokenResponse
      : tokenResponse?.token;

  // ragFileName format: projects/{project}/locations/{location}/ragCorpora/{id}/ragFiles/{fileId}
  // Must use the regional endpoint — the global endpoint rejects regional resources
  const locationMatch = ragFileName.match(/^projects\/[^/]+\/locations\/([^/]+)/);
  if (!locationMatch) {
    throw new Error(`Could not parse location from ragFileName: ${ragFileName}`);
  }
  const location = locationMatch[1];

  const url = `https://${location}-aiplatform.googleapis.com/v1/${ragFileName}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data?.error?.message || "Failed to delete RAG file");
  }

  return true;
}