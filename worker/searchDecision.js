// worker/searchDecision.js
//
// Search decision engine — v1.5.1
// FIX: properly decode SSE stream and parse OpenRouter delta content
//      instead of checking raw binary for "YES"

import { streamChatCompletion } from "./openrouter.js";

// ============================================================
// Build the search decision prompt
// ============================================================
export function buildSearchDecisionPrompt(userMessage) {
    return `You are a search decision system. Determine if the following user message would benefit from a real-time web search.

Return ONLY "YES" or "NO". No other text.

A message needs web search when it asks about:
- Current events, news, or recent information
- Real-time data (weather, stock prices, sports scores)
- Specific facts, definitions, or statistics
- People, places, companies, or products
- Technical documentation or specifications
- Comparisons or reviews
- Tutorials or how-to guides

A message does NOT need web search when it:
- Is a greeting or casual conversation
- Asks for creative writing or brainstorming
- Requests code generation or debugging
- Asks about general concepts the AI knows
- Is a follow-up within an existing conversation context

User message: "${userMessage}"

Decision:`;
}

// ============================================================
// Parse the search decision response
// FIX: properly parse SSE events to extract delta content text,
//      then check if the accumulated text contains YES/NO
// ============================================================
export function parseSearchDecision(prompt, env) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000);

        streamChatCompletion(
            {
                model: "mistralai/mistral-7b-instruct",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                max_tokens: 10,
                stream: true,
            },
            env
        )
            .then(async (body) => {
                clearTimeout(timeout);
                if (!body) return resolve(false);

                const reader = body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                let fullText = "";

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split("\n");
                        buffer = lines.pop() || "";

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || trimmed.startsWith(":")) continue;

                            if (trimmed.startsWith("data: ")) {
                                const data = trimmed.slice(6);
                                if (data === "[DONE]") continue;
                                try {
                                    // FIX: parse the actual SSE JSON and extract delta text
                                    const parsed = JSON.parse(data);
                                    const content = parsed?.choices?.[0]?.delta?.content || "";
                                    if (content) fullText += content;
                                } catch {
                                    // skip malformed lines
                                }
                            }
                        }
                    }
                } catch {
                    // Ignore stream errors — decide from what we got
                }

                const decision = fullText.toUpperCase().includes("YES");
                resolve(decision);
            })
            .catch(() => {
                clearTimeout(timeout);
                resolve(false);
            });
    });
}
