// worker/models.js
//
// Model definitions — v1.5.1
// Available models for OpenRouter with metadata

export const MODELS = [
    {
        id: "deepseek/deepseek-chat-v3-0324",
        name: "DeepSeek V3",
        description: "Latest DeepSeek model with strong reasoning",
        contextWindow: 128000,
        maxOutput: 8192,
        supportsStreaming: true,
        priority: 1,
    },
    {
        id: "deepseek/deepseek-r1-distill-llama-70b",
        name: "DeepSeek R1 (70B)",
        description: "Reasoning-focused model distilled from R1",
        contextWindow: 128000,
        maxOutput: 8192,
        supportsStreaming: true,
        priority: 2,
    },
    {
        id: "gryphe/mythomax-l2-13b",
        name: "MythoMax 13B",
        description: "Creative and conversational model",
        contextWindow: 4096,
        maxOutput: 4096,
        supportsStreaming: true,
        priority: 3,
    },
    {
        id: "mistralai/mistral-7b-instruct",
        name: "Mistral 7B Instruct",
        description: "Fast and efficient instruction model",
        contextWindow: 8192,
        maxOutput: 4096,
        supportsStreaming: true,
        priority: 4,
    },
    {
        id: "openai/gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        description: "OpenAI's fast and capable model",
        contextWindow: 16384,
        maxOutput: 4096,
        supportsStreaming: true,
        priority: 5,
    },
];

// ============================================================
// Get model by ID
// ============================================================
export function getModelById(id) {
    return MODELS.find((m) => m.id === id) || MODELS[0];
}

// ============================================================
// Get default model
// ============================================================
export function getDefaultModel() {
    return MODELS[0];
}

// ============================================================
// Get all model IDs
// ============================================================
export function getModelIds() {
    return MODELS.map((m) => m.id);
}