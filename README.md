# RSU AI Assistant

Telegram AI assistant for Rangsit University.

## Current Status & Recent Updates
I have successfully updated the backend to handle image and image+caption messages via the Gemini Multimodal API.

### Changes:
- **src/services/telegramService.js**: Added functions to fetch the image path and download the picture data.
- **src/services/aiService.js**: Added an `askAIWithImage` function for Gemini's multimodal API.
- **src/handlers/imageHandler.js**: Updated the logic to pass images seamlessly to the AI and respond in Telegram.

## Features
- ✅ Telegram bot
- ✅ AI question answering (Text)
- ✅ Image understanding (Multimodal)
- ✅ Vertex AI integration (Gemini 2.5 Flash)

## Tech Stack
- **Node.js**
- **Express**
- **Telegram Bot API**
- **Google Vertex AI**

## How to Test Image Support
1. Make sure your server is running (e.g. `npm run dev` or whichever command you use).
2. Send an image to your Telegram bot.
3. Send another image with a text caption (like "What is this?").

Please give it a shot in Telegram and let me know if it responds to images correctly!