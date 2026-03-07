import dotenv from "dotenv";
import { VertexAI } from "@google-cloud/vertexai";

dotenv.config();

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION
});

const model = vertexAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});

export async function askAI(prompt) {
  try {

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    });

    return result.response.candidates[0].content.parts[0].text;

  } catch (error) {
    console.error("AI Error:", error);
    return "Sorry, I couldn't process that request.";
  }
}

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
                mimeType: mimeType
              }
            },
            { text: prompt }
          ]
        }
      ]
    });

    return result.response.candidates[0].content.parts[0].text;

  } catch (error) {
    console.error("AI Image Error:", error);
    return "Sorry, I couldn't process that image.";
  }
}