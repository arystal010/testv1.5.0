// docs/js/api.js
//
// Arys AI v1.5.1 — API client for chat and feedback
// FIX: handleStream now correctly parses the worker's custom SSE event format
//      { type: "text", content: "..." } and { type: "done" } / { type: "search" }
//      instead of only looking for OpenAI-format choices[0].delta.content

import { CONFIG } from "./config.js";
import { getApiSettings } from "./settings.js";

// ============================================================
// Stream a chat completion
// ============================================================
export async function streamChat(messages, onToken, onDone, onError, onSearchStatus) {
    const settings = getApiSettings();

    if (!messages || messages.length === 0) {
        onError(new Error("No messages provided"));
        return;
    }

    const payload = {
        messages,
        model: settings.model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        enableWebSearch: settings.enableWebSearch,
        enableAutoSearch: settings.enableAutoSearch,
        searchDepth: settings.searchDepth,
        enableStreaming: settings.enableStreaming,
    };

    try {
        const response = await fetch(`${CONFIG.apiBase}${CONFIG.chatEndpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMessage =
                errorData?.error || `Server returned HTTP ${response.status}: ${response.statusText}`;
            onError(new Error(errorMessage));
            return;
        }

        const contentType = response.headers.get("Content-Type") || "";
        if (contentType.includes("text/event-stream") || response.headers.get("Transfer-Encoding") === "chunked") {
            await handleStream(response, onToken, onDone, onError, onSearchStatus);
        } else {
            // Non-streaming fallback
            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content || data?.message || "";
            onToken(content);
            onDone(content);
        }
    } catch (err) {
        const message = err.message || "Network request failed. Check your connection and try again.";
        onError(new Error(message));
    }
}

// ============================================================
// Handle SSE stream
// FIX: handle worker's custom event format:
//   { type: "text", content: "..." }   → call onToken
//   { type: "search", status: {...} }  → call onSearchStatus
//   { type: "done" }                   → stream is finished
//   { type: "error", error: "..." }    → call onError
// Also retains fallback for raw OpenAI-format streaming
// ============================================================
async function handleStream(response, onToken, onDone, onError, onSearchStatus) {
    const reader = response.body?.getReader();
    if (!reader) {
        onError(new Error("Stream not available"));
        return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

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
                        const parsed = JSON.parse(data);

                        // Worker custom event format
                        if (parsed?.type === "text") {
                            const content = parsed.content || "";
                            if (content) {
                                fullContent += content;
                                onToken(content, fullContent);
                            }
                        } else if (parsed?.type === "search") {
                            if (onSearchStatus) onSearchStatus(parsed.status);
                        } else if (parsed?.type === "done") {
                            // Stream finished — handled below after loop
                        } else if (parsed?.type === "error") {
                            onError(new Error(parsed.error || "Stream error"));
                            return;
                        } else {
                            // Fallback: raw OpenAI SSE format
                            const content =
                                parsed?.choices?.[0]?.delta?.content ||
                                parsed?.choices?.[0]?.message?.content ||
                                parsed?.content ||
                                "";
                            if (content) {
                                fullContent += content;
                                onToken(content, fullContent);
                            }
                        }
                    } catch {
                        // Non-JSON data — treat as raw text content
                        if (data && data !== "[DONE]") {
                            fullContent += data;
                            onToken(data, fullContent);
                        }
                    }
                }
            }
        }
    } catch (err) {
        onError(new Error(`Stream interrupted: ${err.message}`));
        if (fullContent) onDone(fullContent);
        return;
    }

    onDone(fullContent);
}

// ============================================================
// Submit feedback
// ============================================================
export async function submitFeedback({ name, email, type, message, rating }) {
    const response = await fetch(`${CONFIG.apiBase}${CONFIG.feedbackEndpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: name || "",
            email: email || "",
            type: type || "bug",
            message: message || "",
            rating: rating || 0,
        }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to submit feedback");
    }
    return data;
}

// ============================================================
// Check health
// ============================================================
export async function checkHealth() {
    const response = await fetch(`${CONFIG.apiBase}${CONFIG.healthEndpoint}`);
    return await response.json();
}
