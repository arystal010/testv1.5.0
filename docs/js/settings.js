// docs/js/settings.js
//
// Arys AI v1.5.1 — Settings management

import { CONFIG } from "./config.js";
import { getStorage, setStorage } from "./utils.js";

const STORAGE_KEY = "arys_settings";

// ============================================================
// Default settings
// ============================================================
export const DEFAULT_SETTINGS = {
    model: CONFIG.defaults.model,
    temperature: CONFIG.defaults.temperature,
    maxTokens: CONFIG.defaults.maxTokens,
    enableWebSearch: CONFIG.defaults.enableWebSearch,
    enableAutoSearch: CONFIG.defaults.enableAutoSearch,
    searchDepth: CONFIG.defaults.searchDepth,
    enableStreaming: CONFIG.defaults.enableStreaming,
};

// ============================================================
// Get all settings
// ============================================================
export function getSettings() {
    const stored = getStorage(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };

    // Merge with defaults to handle new settings
    return { ...DEFAULT_SETTINGS, ...stored };
}

// ============================================================
// Get a single setting
// ============================================================
export function getSetting(key) {
    const settings = getSettings();
    return settings[key];
}

// ============================================================
// Update a setting
// ============================================================
export function setSetting(key, value) {
    const settings = getSettings();
    settings[key] = value;
    setStorage(STORAGE_KEY, settings);
    return settings;
}

// ============================================================
// Update multiple settings
// ============================================================
export function setSettings(newSettings) {
    const settings = { ...getSettings(), ...newSettings };
    setStorage(STORAGE_KEY, settings);
    return settings;
}

// ============================================================
// Reset to defaults
// ============================================================
export function resetSettings() {
    setStorage(STORAGE_KEY, DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
}

// ============================================================
// Get settings for API request
// ============================================================
export function getApiSettings() {
    const settings = getSettings();
    return {
        model: settings.model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        enableWebSearch: settings.enableWebSearch,
        enableAutoSearch: settings.enableAutoSearch,
        searchDepth: settings.searchDepth,
        enableStreaming: settings.enableStreaming,
    };
}