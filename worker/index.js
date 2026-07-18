// worker/index.js
//
// Cloudflare Worker entry point — v1.5.1
// Routes requests to chat, health, and feedback endpoints

import { handleChatRequest } from "./router.js";
import { handleHealthRequest } from "./health.js";
import { handleFeedbackRequest } from "./openrouter.js";

// ============================================================
// Main entry — handle all incoming requests
// ============================================================
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // Health check
            if (path === "/health" || path === "/api/health") {
                return handleHealthRequest(env);
            }

            // Feedback submission
            if (path === "/feedback" || path === "/api/feedback") {
                return handleFeedbackRequest(request, env);
            }

            // Chat completion (main endpoint)
            if (path === "/chat" || path === "/api/chat" || path === "/v1/chat") {
                return handleChatRequest(request, env);
            }

            // Catch-all: 404
            return new Response(
                JSON.stringify({
                    error: true,
                    message: "Not found. Available endpoints: /chat, /feedback, /health",
                }),
                {
                    status: 404,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        } catch (err) {
            return new Response(
                JSON.stringify({
                    error: true,
                    message: err?.message || "Internal server error",
                }),
                {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        }
    },
};