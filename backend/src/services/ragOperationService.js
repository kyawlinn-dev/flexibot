import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

function parseOperationName(operationName) {
  const match = operationName.match(
    /^projects\/([^/]+)\/locations\/([^/]+)\/.*\/operations\/([^/]+)$/
  );

  if (!match) {
    throw new Error(
      "Operation name must include projects/{project}/locations/{location}/.../operations/{operationId}"
    );
  }

  return {
    projectId: match[1],
    location: match[2],
    operationId: match[3],
  };
}

export async function getRagOperationStatus(operationName) {
  if (!operationName) {
    throw new Error("operationName is required.");
  }

  const { location } = parseOperationName(operationName);

  const baseUrl = `https://${location}-aiplatform.googleapis.com`;
  const url = `${baseUrl}/v1/${operationName}`;

  const client = await auth.getClient();
  const accessTokenResponse = await client.getAccessToken();
  const accessToken =
    typeof accessTokenResponse === "string"
      ? accessTokenResponse
      : accessTokenResponse?.token;

  if (!accessToken) {
    throw new Error("Failed to get Google access token.");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message || "Failed to fetch RAG operation status.";
    throw new Error(message);
  }

  return {
    done: Boolean(data.done),
    error: data.error || null,
    response: data.response || null,
    metadata: data.metadata || null,
    raw: data,
  };
}
export async function findRagFileByGcsUri(gcsUri) {
  const ragCorpusName = process.env.RAG_CORPUS_NAME;

  if (!ragCorpusName) {
    throw new Error("RAG_CORPUS_NAME is not set.");
  }

  // Extract location directly from the corpus resource name
  // format: projects/{project}/locations/{location}/ragCorpora/{id}
  const locationMatch = ragCorpusName.match(/^projects\/[^/]+\/locations\/([^/]+)/);
  if (!locationMatch) {
    throw new Error("Could not parse location from RAG_CORPUS_NAME.");
  }
  const location = locationMatch[1];

  const baseUrl = `https://${location}-aiplatform.googleapis.com`;
  const url = `${baseUrl}/v1/${ragCorpusName}/ragFiles?pageSize=200`;

  const client = await auth.getClient();
  const accessTokenResponse = await client.getAccessToken();
  const accessToken =
    typeof accessTokenResponse === "string"
      ? accessTokenResponse
      : accessTokenResponse?.token;

  if (!accessToken) {
    throw new Error("Failed to get Google access token.");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || "Failed to list RAG files.";
    throw new Error(message);
  }

  const ragFiles = data.ragFiles || [];

  // Vertex AI ragFiles list response uses gcsSource.uris[0] for the GCS URI
  const match = ragFiles.find((f) => f.gcsSource?.uris?.[0] === gcsUri);

  return match?.name || null;
}