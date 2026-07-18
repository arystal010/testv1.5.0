// worker/openrouter.js
//
// OpenRouter streaming integration — v1.5.1
// Enhanced retry logic, model fallback, token-aware timeouts, feedback handler

import { MODELS } from "./models.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const FEEDBACK_KV_KEY = "arys_feedback";
const RETRYABLE_STATUS = [408, 429, 500, 502, 503, 504];
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 30000;

// ============================================================
// Stream a chat completion from OpenRouter
// ============================================================
export async function streamChatCompletion(body, env) {
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error("OpenRouter API key is not configured");
    }

    // Build model preference list with fallback
    const preferredModel = body.model || "deepseek/deepseek-chat-v3-0324";
    const models = getModelFallbackList(preferredModel);

    let lastError = null;

    for (const modelId of models) {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

            try {
                const response = await fetch(OPENROUTER_URL, {
                    method: "POST",
                    signal: controller.signal,
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": env.SITE_URL || "https://arysai.pages.dev",
                        "X-Title": "Arys AI",
                    },
                    body: JSON.stringify({
                        ...body,
                        model: modelId,
                    }),
                });

                clearTimeout(timeout);

                if (response.ok && response.body) {
                    return response.body;
                }

                if (RETRYABLE_STATUS.includes(response.status)) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 3000);
                    await sleep(delay);
                    continue;
                }

                // Non-retryable error for this model
                try {
                    const errBody = await response.json().catch(() => null);
                    lastError = errBody?.error?.message || `Model ${modelId} returned HTTP ${response.status}`;
                } catch {
                    lastError = `Model ${modelId} returned HTTP ${response.status}`;
                }
                break; // Try next model
            } catch (error) {
                clearTimeout(timeout);

                if (error.name === "AbortError") {
                    lastError = `Model ${modelId} timed out after ${REQUEST_TIMEOUT_MS}ms`;
                    break; // Try next model
                }

                lastError = error?.message || `Model ${modelId} failed`;
                if (attempt < MAX_RETRIES) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 3000);
                    await sleep(delay);
                    continue;
                }
                break; // Try next model
            }
        }

        // If we got a response from this model, return it
        if (!lastError) break;
    }

    throw new Error(lastError || "All OpenRouter models failed");
}

// ============================================================
// Get ordered list of models to try
// ============================================================
function getModelFallbackList(preferredModel) {
    const modelIds = MODELS.map((m) => m.id);
    const ordered = [];

    // Preferred model first
    if (modelIds.includes(preferredModel)) {
        ordered.push(preferredModel);
    } else {
        ordered.push(preferredModel);
    }

    // Add all known models as fallbacks
    for (const id of modelIds) {
        if (!ordered.includes(id)) {
            ordered.push(id);
        }
    }

    return ordered;
}

// ============================================================
// Handle feedback submission
// ============================================================
export async function handleFeedbackRequest(request, env) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return new Response(
            JSON.stringify({ error: true, message: "Method not allowed. Use POST." }),
            { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(
            JSON.stringify({ error: true, message: "Invalid JSON body." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Validate
    const message = (body.message || "").trim();
    if (!message || message.length < 10) {
        return new Response(
            JSON.stringify({ error: true, message: "Message must be at least 10 characters." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const feedbackEntry = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        name: (body.name || "").trim().slice(0, 100) || null,
        email: (body.email || "").trim().slice(0, 200) || null,
        type: (body.type || "bug").trim(),
        message: message.slice(0, 5000),
        rating: Math.min(5, Math.max(1, parseInt(body.rating) || 0)) || null,
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get("User-Agent") || null,
    };

    // Try KV storage first
    if (env && env.FEEDBACK_KV) {
        try {
            const existing = await env.FEEDBACK_KV.get(FEEDBACK_KV_KEY, "text").catch(() => null);
            const entries = existing ? JSON.parse(existing) : [];
            entries.push(feedbackEntry);
            await env.FEEDBACK_KV.put(FEEDBACK_KV_KEY, JSON.stringify(entries));
        } catch (err) {
            console.error("KV save failed:", err);
            // Fall through to temporary storage
        }
    }

    // If KV not available or failed, use a temporary in-memory array (per-worker, lost on restart)
    // This is stored in the global scope for the worker's lifetime
    if (!globalThis.__arysFeedbackStore) {
        globalThis.__arysFeedbackStore = [];
    }
    globalThis.__arysFeedbackStore.push(feedbackEntry);

    // Also log for debugging
    console.log("Feedback received:", JSON.stringify(feedbackEntry));

    return new Response(
        JSON.stringify({ success: true, id: feedbackEntry.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
}

// ============================================================
// Get all stored feedback
// ============================================================
export async function getFeedbackEntries(env) {
    // Try KV first
    if (env && env.FEEDBACK_KV) {
        try {
            const data = await env.FEEDBACK_KV.get(FEEDBACK_KV_KEY, "text").catch(() => null);
            if (data) return JSON.parse(data);
        } catch {
            // Fall through
        }
    }

    // Fallback to memory store
    return globalThis.__arysFeedbackStore || [];
}

// ============================================================
// Sleep helper
// ============================================================
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}