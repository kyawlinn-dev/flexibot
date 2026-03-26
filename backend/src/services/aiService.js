// ============================================================
// aiService.js — RSU AI Assistant
// Handles all Gemini + Vertex AI RAG calls.
//
// Pipeline (for text & image):
//   1. Retrieve relevant context from Vertex AI RAG corpus
//   2. Ground: System Prompt + RAG Context + User Question → Gemini
//   3. Return grounded answer
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

export const model = vertexAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

// ============================================================
// STAGE 1 — Image Analysis (Multimodal)
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
// ============================================================

export async function askRAG(
  question,
  studentContext = null,
  history = [],
  conversationSummary = null,
  memoryItems = []
) {
  const startTime = Date.now();
  const corpusId = process.env.RAG_CORPUS_NAME;

  logInfo("RAG Pipeline Start", {
    question,
    corpusId,
    historyLength: history.length,
    memoryCount: memoryItems.length,
    hasSummary: !!conversationSummary,
  });

  try {
    const systemInstruction = buildSystemPrompt(
      question,
      studentContext,
      conversationSummary,
      memoryItems
    );

    // History contains previous turns only.
    // Current user question is appended below.
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
              similarityTopK: 5,
              vectorDistanceThreshold: 0.5,
            },
          },
        },
      ],
    });

    const candidate = result.response.candidates[0];
    const responseText = candidate.content.parts[0].text;
    const latency = Date.now() - startTime;

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
// ============================================================

export async function askRAGWithImage(
  caption,
  mimeType,
  base64Data,
  history = []
) {
  logInfo("Image+RAG Pipeline Start", {
    caption,
    historyLength: history.length,
  });

  const imageDescription = await askAIWithImage(
    "Describe this image clearly and in detail. Focus on any text, diagrams, forms, or UI elements visible.",
    mimeType,
    base64Data
  );

  logInfo("Image description generated", { imageDescription });

  const enrichedQuery = caption
    ? `[Image Context]\n${imageDescription}\n\n[Student Question]\n${caption}`
    : `[Image Context]\n${imageDescription}\n\n[Task]\nWhat relevant university or IT information can you provide based on this image?`;

  return await askRAG(enrichedQuery, null, history, null, []);
}