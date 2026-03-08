import dotenv from "dotenv";
import { VertexAI } from "@google-cloud/vertexai";
import { logInfo, logError, logDebug } from "../utils/logger.js";

dotenv.config();

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION
});

const model = vertexAI.getGenerativeModel({
  model: "gemini-2.5-flash" // Standardizing on a reliable version
});

// NORMAL GEMINI
export async function askAI(prompt) {
  const startTime = Date.now();
  logDebug("AI Request Start", { prompt });

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const responseText = result.response.candidates[0].content.parts[0].text;
    const latency = Date.now() - startTime;

    logInfo("AI Response Received", { latency, wordCount: responseText.split(' ').length });
    return responseText;

  } catch (error) {
    logError("AI Error", { error: error.message, stack: error.stack });
    return "Sorry, I couldn't process that request.";
  }
}

// IMAGE + TEXT
export async function askAIWithImage(prompt, mimeType, base64Data) {
  const startTime = Date.now();
  logDebug("Multimodal AI Request Start", { prompt, mimeType });

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: prompt }
          ]
        }
      ]
    });

    const responseText = result.response.candidates[0].content.parts[0].text;
    const latency = Date.now() - startTime;

    logInfo("Multimodal AI Response Received", { latency });
    return responseText;

  } catch (error) {
    logError("AI Image Error", { error: error.message });
    return "Sorry, I couldn't process that image.";
  }
}

// RAG ENGINE
export async function askRAG(question) {
  const startTime = Date.now();
  const corpusId = process.env.RAG_CORPUS_ID;

  logInfo("RAG Request Start", { question, corpusId });

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: question }] }],
      tools: [{
        retrieval: {
          vertexRagStore: {
            ragResources: [{ ragCorpus: corpusId }]
          }
        }
      }]
    });

    const candidate = result.response.candidates[0];
    let responseText = candidate.content.parts[0].text;
    const latency = Date.now() - startTime;

    // Extract grounding metadata if available (shows if RAG was used)
    const groundingMetadata = candidate.groundingMetadata || {};
    const hasGroundingLinks = groundingMetadata.groundingChunks?.length > 0;

    let groundingSources = [];
    if (hasGroundingLinks) {
      responseText += "\n\n**Sources:**\n";
      groundingSources = groundingMetadata.groundingChunks.map((chunk, index) => {
        const web = chunk.web || {};
        const retrievedContext = chunk.retrievedContext || {};

        // Handle different chunk formats from Vertex AI
        const uri = web.uri || retrievedContext.uri || chunk.uri || "";
        const title = web.title || retrievedContext.title || chunk.title || `Document ${index + 1}`;

        if (uri) {
          responseText += `[${index + 1}] ${title} - ${uri}\n`;
        } else {
          responseText += `[${index + 1}] ${title}\n`;
        }

        return uri || title;
      });
    }

    logInfo("RAG Response Received", {
      latency,
      usedRAG: hasGroundingLinks,
      groundingSources
    });

    //logDebug("Full RAG Metadata", { groundingMetadata });

    return responseText;

  } catch (error) {
    logError("RAG Error", { error: error.message, stack: error.stack });
    return "Sorry, I couldn't retrieve the university information right now.";
  }
}