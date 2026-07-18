// worker/firecrawl.js
//
// Firecrawl API integration — v1.5.1
//
// Robust search with:
//   - Multiple API endpoint fallbacks
//   - Retry logic with exponential backoff
//   - Comprehensive error parsing
//   - Response format normalization
//   - Timeout handling
//   - Diagnostic output on failure

const API_BASE = "https://api.firecrawl.dev/v1";
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

// ============================================================
// Response format keys that Firecrawl may return under
// ============================================================
const RESULT_PATHS = [
    ["data", "results"],
    ["data"],
    ["results"],
    ["result"],
    ["response", "results"],
    ["body", "results"],
];

// ============================================================
// Extract nested value from object by path array
// ============================================================
function getByPath(obj, path) {
    let current = obj;
    for (const key of path) {
        if (!current || typeof current !== "object") return undefined;
        current = current[key];
    }
    return current;
}

// ============================================================
// Normalize a single result item from any Firecrawl format
// ============================================================
function normalizeResult(item) {
    if (!item || typeof item !== "object") return null;

    const title = item.title || item.name || item.heading || "";
    const url = item.url || item.link || item.source || item.href || "";
    const description = item.description
        || item.snippet
        || item.summary
        || item.excerpt
        || item.text
        || "";
    const content = item.content || item.markdown || item.text || description;

    // If both are empty, skip this result
    if (!url && !title && !description) return null;

    return {
        title: String(title).slice(0, 500),
        url: String(url).slice(0, 2000),
        description: String(description).slice(0, 1000),
        content: String(content).slice(0, 5000),
        score: typeof item.score === "number" ? item.score : 0,
    };
}

// ============================================================
// Parse results from any Firecrawl response shape
// ============================================================
function extractResults(responseBody) {
    if (!responseBody || typeof responseBody !== "object") {
        return { results: [], raw: null };
    }

    // Direct array at top level
    if (Array.isArray(responseBody)) {
        return {
            results: responseBody.map(normalizeResult).filter(Boolean),
            raw: responseBody,
        };
    }

    // Try known paths
    for (const path of RESULT_PATHS) {
        const found = getByPath(responseBody, path);
        if (Array.isArray(found) && found.length > 0) {
            return {
                results: found.map(normalizeResult).filter(Boolean),
                raw: responseBody,
            };
        }
    }

    // Try any key that is an array with objects
    for (const key of Object.keys(responseBody)) {
        const val = responseBody[key];
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
            const results = val.map(normalizeResult).filter(Boolean);
            if (results.length > 0) {
                return { results, raw: responseBody };
            }
        }
    }

    // Last resort: the body itself might be a single result
    const single = normalizeResult(responseBody);
    if (single) {
        return { results: [single], raw: responseBody };
    }

    return { results: [], raw: responseBody };
}

// ============================================================
// Sleep helper
// ============================================================
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Fetch with timeout + AbortController
// ============================================================
async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timer);
    }
}

// ============================================================
// Perform a Firecrawl search with full diagnostics
// ============================================================
export async function performSearch(query, apiKey, options = {}) {
    const depth = options.searchDepth ?? 6;
    const diag = {
        query,
        attempts: 0,
        endpoints: [],
        timestamps: [],
        errors: [],
        totalDuration: 0,
        finalStatus: "unknown",
        retryCount: 0,
    };

    const startTime = Date.now();
    const encodedQuery = encodeURIComponent(query);
    const endpoints = [
        `${API_BASE}/search?query=${encodedQuery}&limit=${depth}`,
        `${API_BASE}/search?q=${encodedQuery}&count=${depth}`,
    ];

    // If no API key, still try without it (may work for public tier)
    const headers = {
        "Content-Type": "application/json",
    };
    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        diag.attempts++;
        diag.retryCount = attempt;

        for (const endpoint of endpoints) {
            const epLabel = endpoint.split("?")[0];
            diag.endpoints.push(epLabel);
            diag.timestamps.push(new Date().toISOString());

            try {
                const response = await fetchWithTimeout(
                    endpoint,
                    { method: "GET", headers },
                    TIMEOUT_MS
                );

                const body = await response.json().catch(() => null);

                if (!response.ok) {
                    const errMsg = body?.message || body?.error || body?.error?.message || JSON.stringify(body);
                    const statusCode = response.status;
                    let err = `HTTP ${statusCode}: ${errMsg}`;

                    // Rate limiting
                    if (statusCode === 429) {
                        err = `Rate limited (429). Waiting before retry.`;
                        diag.errors.push(err);
                        await sleep(RETRY_DELAY_MS);
                        continue;
                    }

                    // Auth errors
                    if (statusCode === 401 || statusCode === 403) {
                        err = `Authentication error (${statusCode}). API key may be invalid or missing.`;
                        diag.errors.push(err);
                        diag.finalStatus = "auth_error";
                        diag.totalDuration = Date.now() - startTime;
                        return { results: [], diagnostics: diag, error: err };
                    }

                    diag.errors.push(err);
                    lastError = err;
                    continue; // try next endpoint
                }

                // Successful response — parse results
                const { results, raw } = extractResults(body);

                diag.totalDuration = Date.now() - startTime;

                if (results.length === 0) {
                    // No results from successful request
                    const warning = `Search completed but returned 0 results. The query may be too specific or the index may not have relevant content.`;
                    diag.errors.push(warning);
                    diag.finalStatus = "empty_results";
                    return {
                        results: [],
                        diagnostics: diag,
                        warning,
                    };
                }

                // Success with results
                diag.finalStatus = "success";
                return {
                    results,
                    diagnostics: diag,
                    warning: null,
                };
            } catch (err) {
                const errMsg = err?.message || String(err);
                let humanErr = errMsg;

                if (err?.name === "AbortError") {
                    humanErr = `Request timed out after ${TIMEOUT_MS}ms. The search API may be slow or unreachable.`;
                } else if (errMsg.includes("fetch")) {
                    humanErr = `Network error: unable to reach Firecrawl API. Check connectivity or API endpoint.`;
                } else if (errMsg.includes("JSON")) {
                    humanErr = `Invalid JSON response from search API.`;
                }

                diag.errors.push(humanErr);
                lastError = humanErr;

                // If not last attempt, wait before retry
                if (attempt < MAX_RETRIES) {
                    await sleep(RETRY_DELAY_MS * (attempt + 1));
                }
            }
        }
    }

    // All attempts exhausted
    diag.totalDuration = Date.now() - startTime;
    diag.finalStatus = "failed";

    return {
        results: [],
        diagnostics: diag,
        error: lastError || "All search attempts failed after retries.",
    };
}

// ============================================================
// Fallback — scrape a single page directly (no search)
// ============================================================
export async function scrapeUrl(url, apiKey) {
    const headers = {
        "Content-Type": "application/json",
    };
    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    try {
        const response = await fetchWithTimeout(
            `${API_BASE}/scrape`,
            {
                method: "POST",
                headers,
                body: JSON.stringify({ url }),
            },
            TIMEOUT_MS
        );

        const body = await response.json().catch(() => null);

        if (!response.ok || !body) {
            return { success: false, error: body?.message || `HTTP ${response.status}` };
        }

        // Firecrawl returns scraped content in body.data
        const data = body.data || body;
        const content = data.content || data.markdown || data.text || data.description || "";

        return {
            success: true,
            title: data.title || data.name || "",
            content: String(content).slice(0, 10000),
            url,
        };
    } catch (err) {
        return {
            success: false,
            error: err?.message || "Scrape failed",
        };
    }
}

// ============================================================
// Format search results for LLM context
// ============================================================
export function formatResultsForContext(results, maxResults = 5) {
    if (!results || results.length === 0) {
        return "No web search results available.";
    }

    const limited = results.slice(0, maxResults);
    const parts = limited.map((r, i) => {
        const lines = [`[${i + 1}] ${r.title}`];
        if (r.url) lines.push(`    URL: ${r.url}`);
        if (r.description) lines.push(`    ${r.description}`);
        return lines.join("\n");
    });

    return parts.join("\n\n");
}

// ============================================================
// Get a human-readable error summary from diagnostics
// ============================================================
export function getSearchErrorSummary(diagnostics) {
    if (!diagnostics) return "Unknown search error.";

    const parts = [];

    if (diagnostics.finalStatus === "success") return null; // no error

    if (diagnostics.finalStatus === "auth_error") {
        parts.push("Search could not authenticate. The API key may be missing or invalid.");
    } else if (diagnostics.finalStatus === "empty_results") {
        parts.push("The search returned no results. Try a different or more general query.");
    } else if (diagnostics.finalStatus === "failed") {
        parts.push("Search failed after multiple attempts.");
    }

    if (diagnostics.errors && diagnostics.errors.length > 0) {
        const unique = [...new Set(diagnostics.errors)];
        parts.push(`Details: ${unique.slice(0, 3).join(" | ")}`);
    }

    parts.push(`(Attempts: ${diagnostics.attempts}, Duration: ${diagnostics.totalDuration}ms)`);

    return parts.join(" ");
}