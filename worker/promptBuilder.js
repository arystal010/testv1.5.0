// worker/promptBuilder.js
//
// Message builder — v1.5.1
// Constructs enhanced messages with web search context for OpenRouter

// ============================================================
// System prompt for Arys AI
// ============================================================
function getSystemPrompt(searchContext) {
    const contextSection = searchContext && searchContext.trim()
        ? `\n\n## Web Search Results\n${searchContext}\n\nUse the above search results to answer the user's question. Cite sources where possible. If the search results are insufficient or contain a diagnostic message, let the user know clearly.`
        : `\n\nNote: Web search is not available for this conversation. Answer based on your existing knowledge.`;

    return `You are Arys AI, a premium, minimal AI assistant focused on providing clear, accurate, and helpful responses.

## Capabilities
- Answer questions on a wide range of topics using your knowledge
- Web search integration for real-time information
- Code generation and analysis
- Creative writing and brainstorming
- Problem-solving and reasoning

## Style Guide
- Be concise but thorough
- Use clear, simple language
- Format responses with proper Markdown
- Use code blocks with language tags for code
- Break down complex topics into digestible sections
- Be honest about uncertainty
- When citing sources from web search, reference them inline${contextSection}

## Rules
- Do not make up facts or sources
- If you don't know something, say so clearly
- Refuse harmful or unethical requests
- Keep responses well-structured
- Use bullet points and numbered lists for clarity
- When providing code, ensure it's correct and well-commented`;
}

// ============================================================
// Build messages array for OpenRouter
// ============================================================
export function buildMessages(messages, searchContext) {
    const systemMessage = {
        role: "system",
        content: getSystemPrompt(searchContext),
    };

    // Filter and validate messages
    const validMessages = (messages || [])
        .filter((m) => m && typeof m === "object" && m.role && m.content)
        .map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content).trim(),
        }))
        .filter((m) => m.content.length > 0);

    return [systemMessage, ...validMessages];
}

// ============================================================
// Get a formatted search context for injection
// ============================================================
export function formatSearchContext(searchResults) {
    if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
        return null;
    }

    const formatted = searchResults.map((r, i) => {
        const parts = [`[${i + 1}] ${r.title || "Untitled"}`];
        if (r.url) parts.push(`    Source: ${r.url}`);
        if (r.description) parts.push(`    ${r.description}`);
        if (r.content && r.content !== r.description) {
            parts.push(`    Content: ${r.content.slice(0, 500)}`);
        }
        return parts.join("\n");
    });

    return formatted.join("\n\n");
}