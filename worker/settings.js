// worker/settings.js
//
// Settings parser — v1.5.1
// Extracts and validates user settings from request body

const DEFAULT_SETTINGS = {
    model: "deepseek/deepseek-chat-v3-0324",
    temperature: 0.7,
    maxTokens: 4096,
    enableWebSearch: true,
    enableAutoSearch: true,
    searchDepth: 6,
    enableStreaming: true,
};

// ============================================================
// Extract settings from request body
// ============================================================
export function getSettingsFromBody(body) {
    if (!body || typeof body !== "object") {
        return { ...DEFAULT_SETTINGS };
    }

    const settings = body.settings || body.config || {};

    return {
        model: settings.model || body.model || DEFAULT_SETTINGS.model,
        temperature: parseFloat(settings.temperature ?? body.temperature ?? DEFAULT_SETTINGS.temperature),
        maxTokens: parseInt(settings.maxTokens ?? body.maxTokens ?? DEFAULT_SETTINGS.maxTokens, 10) || DEFAULT_SETTINGS.maxTokens,
        enableWebSearch: settings.enableWebSearch !== undefined ? Boolean(settings.enableWebSearch) : DEFAULT_SETTINGS.enableWebSearch,
        enableAutoSearch: settings.enableAutoSearch !== undefined ? Boolean(settings.enableAutoSearch) : DEFAULT_SETTINGS.enableAutoSearch,
        searchDepth: parseInt(settings.searchDepth ?? DEFAULT_SETTINGS.searchDepth, 10) || DEFAULT_SETTINGS.searchDepth,
        enableStreaming: settings.enableStreaming !== undefined ? Boolean(settings.enableStreaming) : DEFAULT_SETTINGS.enableStreaming,
    };
}

// ============================================================
// Validate and clamp settings
// ============================================================
export function validateSettings(settings) {
    const validated = { ...settings };

    // Temperature: 0-2
    validated.temperature = Math.max(0, Math.min(2, validated.temperature || DEFAULT_SETTINGS.temperature));

    // Max tokens: 256-16384
    validated.maxTokens = Math.max(256, Math.min(16384, validated.maxTokens || DEFAULT_SETTINGS.maxTokens));

    // Search depth: 1-12
    validated.searchDepth = Math.max(1, Math.min(12, validated.searchDepth || DEFAULT_SETTINGS.searchDepth));

    return validated;
}