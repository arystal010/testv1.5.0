// worker/router.js
//
// Chat message router — v1.5.1
// Routes messages to OpenRouter with optional web search context

import { performSearch, formatResultsForContext, getSearchErrorSummary } from "./firecrawl.js";
import { buildMessages } from "./promptBuilder.js";
import { buildSearchDecisionPrompt, parseSearchDecision } from "./searchDecision.js";
import { streamChatCompletion } from "./openrouter.js";
import { getSettingsFromBody } from "./settings.js";
import {
    buildSearchEvent,
    buildDiagnosticEvent,
    buildDoneEvent,
    buildTextEvent,
    buildErrorEvent,
    createStreamingResponse,
    createErrorResponse,
    streamHeaders,
} from "./utils.js";

// ============================================================
// Router — handle chat request
// ============================================================
export async function handleChatRequest(request, env) {
    const corsHeaders = getCorsHeaders(env);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return createErrorResponse("Method not allowed. Use POST.", 405, corsHeaders);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return createErrorResponse("Invalid JSON body.", 400, corsHeaders);
    }

    const settings = getSettingsFromBody(body);
    const messages = body.messages || [];
    const firecrawlApiKey = env.FIRECRAWL_API_KEY || "";
    const stream = body.stream !== false && settings.enableStreaming !== false;

    if (!messages || messages.length === 0) {
        return createErrorResponse("No messages provided.", 400, corsHeaders);
    }

    // Check if web search should be performed
    const shouldSearch = await decideToSearch(messages, settings, firecrawlApiKey, env);

    let searchStatus = null;
    let searchContext = "";

    if (shouldSearch) {
        // Perform search
        const searchResult = await executeSearch(messages, settings, firecrawlApiKey);

        if (searchResult.diagnostics) {
            searchStatus = {
                type: searchResult.warning ? "warning" : searchResult.error ? "error" : "success",
                message: searchResult.warning || searchResult.error || `Searched for "${searchResult.query}"`,
                details: searchResult.diagnostics,
            };
        }

        if (searchResult.results && searchResult.results.length > 0) {
            searchContext = formatResultsForContext(searchResult.results, settings.searchDepth || 5);
        } else {
            // Search failed or returned no results — provide diagnostic info
            const diag = searchResult.diagnostics;
            const errorSummary = getSearchErrorSummary(diag);
            searchContext = `[Web Search Diagnostic]\n${errorSummary}\n\nNo web results were retrieved. Answer based on your existing knowledge.`;
        }
    }

    // Build the prompt with search context
    const builtMessages = buildMessages(messages, searchContext);

    // Build the request for OpenRouter
    const openRouterBody = {
        model: settings.model,
        messages: builtMessages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: stream,
    };

    try {
        if (stream) {
            // Streaming response
            const openRouterStream = await streamChatCompletion(openRouterBody, env);
            return createStreamingResponse(openRouterStream, searchStatus, corsHeaders);
        } else {
            // Non-streaming response
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${env.OPENROUTER_API_KEY || ""}`,
                    "HTTP-Referer": env.SITE_URL || "https://arysai.pages.dev",
                    "X-Title": "Arys AI",
                },
                body: JSON.stringify(openRouterBody),
            });

            const data = await response.json();

            if (!response.ok) {
                return createErrorResponse(
                    data?.error?.message || `OpenRouter error: ${response.status}`,
                    response.status,
                    corsHeaders
                );
            }

            const responseData = {
                ...data,
                searchStatus: searchStatus,
                searchContext: searchContext || undefined,
            };

            return new Response(JSON.stringify(responseData), {
                status: 200,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            });
        }
    } catch (err) {
        return createErrorResponse(
            err?.message || "Internal server error during OpenAI call.",
            500,
            corsHeaders
        );
    }
}

// ============================================================
// Decide whether to perform a web search
// ============================================================
async function decideToSearch(messages, settings, apiKey, env) {
    // If search is disabled in settings, skip
    if (!settings.enableWebSearch) return false;

    // If auto search detection is disabled, always search
    if (!settings.enableAutoSearch) return true;

    // Check if the last user message triggers search
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return false;

    const content = (lastUserMsg.content || "").trim();
    if (!content) return false;

    // Quick keyword check for obvious search needs
    const searchTriggers = [
        "search", "find", "look up", "lookup", "google", "what is",
        "who is", "when did", "where is", "how to", "latest",
        "news", "current", "today", "now", "weather", "population",
        "definition", "meaning", "recent", "update", "status",
        "price", "stock", "rate", "exchange", "time",
    ];

    const lower = content.toLowerCase();
    const hasTrigger = searchTriggers.some((t) => lower.includes(t));

    if (hasTrigger) return true;

    // For ambiguous cases, use AI to decide
    if (env.OPENROUTER_API_KEY) {
        try {
            const decisionPrompt = buildSearchDecisionPrompt(content);
            const decision = await parseSearchDecision(decisionPrompt, env);
            return decision;
        } catch {
            // Fallback: search if content seems like a question
            return content.includes("?") || content.length > 20;
        }
    }

    return false;
}

// ============================================================
// Execute search with diagnostics
// ============================================================
async function executeSearch(messages, settings, apiKey) {
    // Extract search query from messages
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const query = lastUserMsg?.content?.trim() || "";

    // If query is too short, expand it from conversation context
    const expandedQuery = expandQuery(query, messages);

    try {
        const result = await performSearch(expandedQuery, apiKey, {
            searchDepth: settings.searchDepth || 6,
        });

        return {
            ...result,
            query: expandedQuery,
        };
    } catch (err) {
        return {
            results: [],
            query: expandedQuery,
            error: err?.message || "Search execution failed",
            diagnostics: {
                finalStatus: "failed",
                errors: [err?.message || "Unknown error during search"],
                attempts: 1,
                totalDuration: 0,
                query: expandedQuery,
            },
        };
    }
}

// ============================================================
// Expand short query with conversation context
// ============================================================
function expandQuery(query, messages) {
    if (query.length > 30) return query;

    // Find previous user messages for context
    const prevUserMsgs = messages
        .filter((m) => m.role === "user")
        .slice(-3, -1)
        .map((m) => m.content?.trim() || "")
        .filter(Boolean);

    if (prevUserMsgs.length > 0) {
        const context = prevUserMsgs.join(" ");
        return `${context} ${query}`;
    }

    return query;
}

// ============================================================
// CORS headers
// ============================================================
function getCorsHeaders(env) {
    const origin = env?.CORS_ORIGIN || "*";
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
    };
}