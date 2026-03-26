import { getRecentMessages } from "./messageService.js";
import { getLatestSummary } from "./summaryService.js";
import { getRelevantMemory } from "./memoryService.js";

export async function buildAIContext({ sessionId, telegramUserId }) {
  const [history, latestSummary, memoryItems] = await Promise.all([
    getRecentMessages(sessionId, 6),
    getLatestSummary(sessionId),
    getRelevantMemory(telegramUserId, 5),
  ]);

  return {
    history,
    conversationSummary: latestSummary?.summary_text || null,
    memoryItems,
    studentContext: null,
  };
}