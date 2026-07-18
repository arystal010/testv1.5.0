// worker/searchDecision.js
//
// Search decision engine — v1.5.1
// Determines whether a user message requires a web search

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
// ============================================================
export function parseSearchDecision(prompt, env) {
    return new Promise((resolve) => {
        // Timeout after 5s
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
                let fullResponse = "";

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        fullResponse += decoder.decode(value, { stream: true });
                    }
                } catch {
                    // Ignore stream errors
                }

                const cleaned = fullResponse.replace(/data:\s*/g, "").trim();
                const decision = cleaned.includes("YES") || cleaned.includes("yes");

                resolve(decision);
            })
            .catch(() => {
                clearTimeout(timeout);
                resolve(false);
            });
    });
}