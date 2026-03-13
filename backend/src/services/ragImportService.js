import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

function parseRagCorpusName(ragCorpusName) {
  const match = ragCorpusName.match(
    /^projects\/([^/]+)\/locations\/([^/]+)\/ragCorpora\/([^/]+)$/
  );

  if (!match) {
    throw new Error(
      "RAG_CORPUS_NAME must be in the format: projects/{project}/locations/{location}/ragCorpora/{ragCorpusId}"
    );
  }

  return {
    projectId: match[1],
    location: match[2],
    ragCorpusId: match[3],
  };
}

export async function importGcsFileToRagCorpus({ gcsUri, displayName }) {
  const ragCorpusName = getRequiredEnv("RAG_CORPUS_NAME");
  const { projectId, location, ragCorpusId } = parseRagCorpusName(ragCorpusName);

  const parent = `projects/${projectId}/locations/${location}/ragCorpora/${ragCorpusId}`;
  const baseUrl = `https://${location}-aiplatform.googleapis.com`;
  const url = `${baseUrl}/v1/${parent}/ragFiles:import`;

  const client = await auth.getClient();
  const accessTokenResponse = await client.getAccessToken();
  const accessToken =
    typeof accessTokenResponse === "string"
      ? accessTokenResponse
      : accessTokenResponse?.token;

  if (!accessToken) {
    throw new Error("Failed to get Google access token.");
  }

  const maxEmbeddingRequestsPerMin = Number(
    process.env.RAG_EMBEDDING_QPM || "1000"
  );

  const body = {
    importRagFilesConfig: {
      gcsSource: {
        uris: [gcsUri],
      },
      maxEmbeddingRequestsPerMin,
    },
  };

  console.log("RAG import URL:", url);
  console.log("RAG parent:", parent);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message || "Vertex AI ragFiles.import request failed.";
    throw new Error(message);
  }

  return {
    operationName: data.name,
    done: Boolean(data.done),
    raw: data,
    displayName,
    gcsUri,
    parent,
    url,
  };
}