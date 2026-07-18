// worker/health.js
//
// Arys AI v1.5.1 — Health check endpoint
// FIX: renamed export from handleHealth → handleHealthRequest to match index.js import

/**
 * GET /health
 * Returns server status and configuration info
 */
export async function handleHealthRequest(request, env) {
    try {
        const healthInfo = {
            status: "ok",
            version: "1.5.1",
            name: "Arys AI",
            timestamp: new Date().toISOString(),
            uptime: typeof env?.UP_TIME !== "undefined" ? env.UP_TIME : "unknown",
            services: {
                openrouter: await checkOpenRouter(env),
                firecrawl: await checkFirecrawl(env),
            },
            config: {
                models: typeof env?.MODELS !== "undefined" ? env.MODELS.split(",") : [],
                features: {
                    webSearch: env?.FIRECRAWL_API_KEY ? true : false,
                    streaming: true,
                    feedback: true,
                },
            },
        };

        // Determine overall health
        const allHealthy = Object.values(healthInfo.services).every((s) => s.status === "ok");
        if (!allHealthy) {
            healthInfo.status = "degraded";
        }

        return new Response(JSON.stringify(healthInfo, null, 2), {
            status: allHealthy ? 200 : 503,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (error) {
        return new Response(
            JSON.stringify({
                status: "error",
                version: "1.5.1",
                name: "Arys AI",
                timestamp: new Date().toISOString(),
                error: error.message,
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    }
}

/**
 * Check OpenRouter API connectivity
 */
async function checkOpenRouter(env) {
    try {
        const apiKey = env?.OPENROUTER_API_KEY;
        if (!apiKey) {
            return { status: "unavailable", message: "No API key configured" };
        }

        const response = await fetch("https://openrouter.ai/api/v1/models", {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
        });

        if (response.ok) {
            const data = await response.json();
            return {
                status: "ok",
                models: data?.data?.length || 0,
                message: "Connected",
            };
        }

        return {
            status: "error",
            message: `HTTP ${response.status}: ${response.statusText}`,
        };
    } catch (error) {
        return {
            status: "error",
            message: error.message,
        };
    }
}

/**
 * Check Firecrawl API connectivity
 */
async function checkFirecrawl(env) {
    try {
        const apiKey = env?.FIRECRAWL_API_KEY;
        if (!apiKey) {
            return { status: "unavailable", message: "No API key configured" };
        }

        const response = await fetch("https://api.firecrawl.dev/v1/health", {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });

        if (response.ok) {
            return {
                status: "ok",
                message: "Connected",
            };
        }

        return {
            status: "error",
            message: `HTTP ${response.status}: ${response.statusText}`,
        };
    } catch (error) {
        return {
            status: "error",
            message: error.message,
        };
    }
}
