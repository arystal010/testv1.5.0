// worker/utils.js
//
// Worker utilities — v1.5.1
// SSE streaming, error responses, event builders

// ============================================================
// SSE Event Builders
// ============================================================

export function buildTextEvent(content) {
    return `data: ${JSON.stringify({ type: "text", content })}\n\n`;
}

export function buildSearchEvent(status) {
    return `data: ${JSON.stringify({ type: "search", status })}\n\n`;
}

export function buildDiagnosticEvent(info) {
    return `data: ${JSON.stringify({ type: "diagnostic", info })}\n\n`;
}

export function buildDoneEvent() {
    return `data: ${JSON.stringify({ type: "done" })}\n\n`;
}

export function buildErrorEvent(error) {
    return `data: ${JSON.stringify({ type: "error", error })}\n\n`;
}

// ============================================================
// Streaming response factory
// ============================================================
export function createStreamingResponse(openRouterStream, searchStatus, corsHeaders) {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start writing to the stream
    (async () => {
        try {
            // Send search status first if present
            if (searchStatus) {
                await writer.write(encoder.encode(buildSearchEvent(searchStatus)));
            }

            // Process OpenRouter stream
            const reader = openRouterStream.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

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
                            const content = parsed?.choices?.[0]?.delta?.content || "";
                            if (content) {
                                await writer.write(encoder.encode(buildTextEvent(content)));
                            }
                        } catch {
                            // Skip malformed JSON lines
                        }
                    }
                }
            }

            // Process remaining buffer
            if (buffer.trim()) {
                const trimmed = buffer.trim();
                if (trimmed.startsWith("data: ")) {
                    const data = trimmed.slice(6);
                    if (data !== "[DONE]") {
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed?.choices?.[0]?.delta?.content || "";
                            if (content) {
                                await writer.write(encoder.encode(buildTextEvent(content)));
                            }
                        } catch {
                            // Skip
                        }
                    }
                }
            }

            await writer.write(encoder.encode(buildDoneEvent()));
        } catch (err) {
            await writer.write(encoder.encode(buildErrorEvent(err?.message || "Stream error")));
        } finally {
            await writer.close();
        }
    })();

    return new Response(readable, {
        status: 200,
        headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}

// ============================================================
// Error response factory
// ============================================================
export function createErrorResponse(message, status = 500, corsHeaders = {}) {
    return new Response(
        JSON.stringify({
            error: true,
            message,
        }),
        {
            status,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
            },
        }
    );
}

// ============================================================
// Stream headers helper
// ============================================================
export function streamHeaders(corsHeaders = {}) {
    return {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    };
}