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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function importGcsFileToRagCorpus({ gcsUri, displayName }) {
  const ragCorpusName = getRequiredEnv("RAG_CORPUS_NAME");
  const { projectId, location, ragCorpusId } = parseRagCorpusName(ragCorpusName);

  const parent = `projects/${projectId}/locations/${location}/ragCorpora/${ragCorpusId}`;

  // Keep v1 because this is the version you actually proved working locally.
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
  console.log("RAG gcsUri:", gcsUri);
  console.log("RAG displayName:", displayName);

  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { rawText };
    }

    console.error("RAG import response debug:", {
      attempt,
      status: response.status,
      statusText: response.statusText,
      url,
      parent,
      gcsUri,
      body,
      data,
    });

    if (response.ok) {
      return {
        operationName: data.name,
        ragFileName: data?.response?.ragFile?.name || null,
        done: Boolean(data.done),
        raw: data,
        displayName,
        gcsUri,
        parent,
        url,
      };
    }

    const message =
      data?.error?.message ||
      rawText ||
      "Vertex AI ragFiles.import request failed.";

    lastError = new Error(message);

    // Retry only transient server-side failures.
    if (response.status >= 500 && attempt < 3) {
      await sleep(attempt * 2000);
      continue;
    }

    throw lastError;
  }

  throw lastError || new Error("Unknown RAG import failure.");
}