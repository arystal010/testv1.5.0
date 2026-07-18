// docs/js/config.js
//
// Arys AI v1.5.1 — Configuration
// Centralized configuration for the frontend

export const CONFIG = {
    // API
    apiBase: "/api",
    chatEndpoint: "/chat",
    feedbackEndpoint: "/feedback",
    healthEndpoint: "/health",

    // Default settings
    defaults: {
        model: "deepseek/deepseek-chat-v3-0324",
        temperature: 0.7,
        maxTokens: 4096,
        enableWebSearch: true,
        enableAutoSearch: true,
        searchDepth: 6,
        enableStreaming: true,
        theme: "dark",
    },

    // Available models
    models: [
        { id: "deepseek/deepseek-chat-v3-0324", name: "DeepSeek V3", description: "Latest DeepSeek model with strong reasoning" },
        { id: "deepseek/deepseek-r1-distill-llama-70b", name: "DeepSeek R1 (70B)", description: "Reasoning-focused model distilled from R1" },
        { id: "gryphe/mythomax-l2-13b", name: "MythoMax 13B", description: "Creative and conversational model" },
        { id: "mistralai/mistral-7b-instruct", name: "Mistral 7B Instruct", description: "Fast and efficient instruction model" },
        { id: "openai/gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "OpenAI's fast and capable model" },
    ],

    // Themes
    themes: [
        { id: "dark", name: "Dark", preview: "#0a0a0f" },
        { id: "light", name: "Light", preview: "#f5f5f7" },
        { id: "midnight", name: "Midnight", preview: "#050816" },
        { id: "frost", name: "Frost", preview: "#e0e8f0" },
    ],

    // Feedback types
    feedbackTypes: [
        { id: "bug", name: "Bug", icon: "bug" },
        { id: "suggestion", name: "Suggestion", icon: "suggestion" },
        { id: "feature", name: "Feature", icon: "feature" },
        { id: "other", name: "Other", icon: "other" },
    ],

    // Limits
    limits: {
        maxMessageLength: 10000,
        maxFeedbackMessageLength: 5000,
        maxNameLength: 100,
        maxEmailLength: 200,
        minFeedbackMessageLength: 10,
        maxHistoryItems: 50,
    },

    // Animation durations
    animation: {
        screenTransition: 600,
        messageIn: 300,
        modalIn: 250,
        toastIn: 300,
        typingBounce: 1400,
    },

    // Version
    version: "1.5.1",
    buildDate: "2026-07-18",
};