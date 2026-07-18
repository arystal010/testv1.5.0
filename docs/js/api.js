// docs/js/api.js
//
// Arys AI v1.5.1 — API client for chat and feedback

import { CONFIG } from "./config.js";
import { getApiSettings } from "./settings.js";

// ============================================================
// Stream a chat completion
// ============================================================
export async function streamChat(messages, onToken, onDone, onError) {
    const settings = getApiSettings();

    // Validate we have messages
    if (!messages || messages.length === 0) {
        onError(new Error("No messages provided"));
        return;
    }

    // Build request payload
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
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMessage =
                errorData?.error || `Server returned HTTP ${response.status}: ${response.statusText}`;
            onError(new Error(errorMessage));
            return;
            }

        // Handle streaming response
        const contentType = response.headers.get("Content-Type") || "";
        if (contentType.includes("text/event-stream") || response.headers.get("Transfer-Encoding") === "chunked") {
            await handleStream(response, onToken, onDone, onError);
        } else {
            // Non-streaming response
            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content || data?.message || "";
            onToken(content);
            onDone(content);
        }
    } catch (err) {
        // Network or unexpected error
        const message = err.message || "Network request failed. Check your connection and try again.";
        onError(new Error(message));
    }
}

// ============================================================
// Handle SSE stream
// ============================================================
async function handleStream(response, onToken, onDone, onError) {
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

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Parse SSE events
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(":")) continue;

                if (trimmed.startsWith("data: ")) {
                    const data = trimmed.slice(6);
                    
                    if (data === "[DONE]") {
                        continue;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed?.choices?.[0]?.delta?.content || 
                                       parsed?.choices?.[0]?.message?.content || 
                                       parsed?.content || "";

                        if (content) {
                            fullContent += content;
                            onToken(content, fullContent);
                        }
                    } catch {
                        // If raw text, treat as content
                        if (data && data !== "[DONE]") {
                            fullContent += data;
                            onToken(data, fullContent);
                        }
                    }
                }
            }
        }
    } catch (err) {
        // Stream error - still deliver what we got
        onError(new Error(`Stream interrupted: ${err.message}`));
        if (fullContent) {
            onDone(fullContent);
        }
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
        headers: {
            "Content-Type": "application/json",
        },
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
    const data = await response.json();
    return data;
}