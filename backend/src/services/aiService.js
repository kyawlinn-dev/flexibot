// ============================================================
// aiService.js — RSU AI Assistant
// Handles all Gemini + Vertex AI RAG calls.
//
// Pipeline (for text & image):
//   1. Retrieve relevant context from Vertex AI RAG corpus
//   2. Ground: System Prompt + RAG Context + User Question → Gemini
//   3. Return grounded answer with optional source citations
// ============================================================

import dotenv from "dotenv";
import { VertexAI } from "@google-cloud/vertexai";
import { buildSystemPrompt } from "./promptService.js";
import { logInfo, logError } from "../utils/logger.js";

dotenv.config();

// --- Vertex AI Client ---
const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION,
});

const model = vertexAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});


// ============================================================
// STAGE 1 — Image Analysis (Multimodal)
// Describe the image using Gemini Vision.
// This description is passed into askRAG as an enriched query.
// ============================================================

export async function askAIWithImage(prompt, mimeType, base64Data) {
  try {

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    return result.response.candidates[0].content.parts[0].text;

  } catch (error) {
    logError("Image Analysis Error", { error: error.message });
    return "Could not analyze the image.";
  }
}


// ============================================================
// STAGE 2 — RAG + Grounding
// Full pipeline:
//   1. Retrieves context from Vertex AI RAG corpus
//   2. Sends: System Prompt + RAG context + question to Gemini
//   3. Returns grounded answer + source citations
//
// @param {string} question        - The user's question (or enriched image query)
// @param {object} studentContext  - Optional future university system data
// ============================================================

export async function askRAG(question, studentContext = null, history = []) {
  const startTime = Date.now();
  const corpusId = process.env.RAG_CORPUS_NAME;

  logInfo("RAG Pipeline Start", { question, corpusId, historyLength: history.length });

  try {

    const systemInstruction = buildSystemPrompt(question, studentContext);

    // M2 fix: prepend conversation history so Gemini has context for
    // follow-up questions. History is [{role, parts}] in Gemini format.
    const contents = [
      ...history,
      {
        role: "user",
        parts: [{ text: question }],
      },
    ];

    const result = await model.generateContent({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents,
      tools: [
        {
          retrieval: {
            vertexRagStore: {
              ragResources: [{ ragCorpus: corpusId }],
              similarityTopK: 5,            // Retrieve top 5 most relevant chunks
              vectorDistanceThreshold: 0.5, // Filter chunks below 0.5 cosine similarity
            },
          },
        },
      ],
    });

    const candidate = result.response.candidates[0];
    let responseText = candidate.content.parts[0].text;
    const latency = Date.now() - startTime;

    // --- Extract Grounding Metadata (for logging only — not shown to user) ---
    const groundingMetadata = candidate.groundingMetadata || {};
    const groundingChunks = groundingMetadata.groundingChunks || [];
    const hasGrounding = groundingChunks.length > 0;

    const groundingSources = groundingChunks.map((chunk) => {
      const web = chunk.web || {};
      const retrieved = chunk.retrievedContext || {};
      return web.uri || retrieved.uri || web.title || retrieved.title || "unknown";
    });

    logInfo("RAG Pipeline Complete", {
      latency,
      usedRAG: hasGrounding,
      groundingSources,
    });

    return responseText;

  } catch (error) {
    logError("RAG Pipeline Error", {
      error: error.message,
      stack: error.stack,
    });

    return "Sorry, I couldn't retrieve university information right now. Please try again.";
  }
}


// ============================================================
// COMBINED: Image + Caption → RAG
// Used by imageHandler for image and image+caption messages.
//
// Step 1: Describe the image with Gemini Vision
// Step 2: Merge description + caption into an enriched RAG query
// Step 3: Run the full RAG pipeline with the enriched query
// ============================================================

export async function askRAGWithImage(caption, mimeType, base64Data, history = []) {
  logInfo("Image+RAG Pipeline Start", { caption, historyLength: history.length });

  // Step 1: Describe the image
  const imageDescription = await askAIWithImage(
    "Describe this image clearly and in detail. Focus on any text, diagrams, forms, or UI elements visible.",
    mimeType,
    base64Data
  );

  logInfo("Image description generated", { imageDescription });

  // Step 2: Build enriched RAG query
  const enrichedQuery = caption
    ? `[Image Context]\n${imageDescription}\n\n[Student Question]\n${caption}`
    : `[Image Context]\n${imageDescription}\n\n[Task]\nWhat relevant university or IT information can you provide based on this image?`;

  // Step 3: Run full RAG pipeline with conversation history
  return await askRAG(enrichedQuery, null, history);
}