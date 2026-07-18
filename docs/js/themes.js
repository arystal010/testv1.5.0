// docs/js/themes.js
//
// Arys AI v1.5.1 — Theme management

import { CONFIG } from "./config.js";
import { getStorage, setStorage } from "./utils.js";

const STORAGE_KEY = "arys_theme";

// ============================================================
// Apply a theme to the document
// ============================================================
export function applyTheme(themeId) {
    // Validate theme
    const validThemes = CONFIG.themes.map((t) => t.id);
    if (!validThemes.includes(themeId)) {
        themeId = CONFIG.defaults.theme;
    }

    document.documentElement.setAttribute("data-theme", themeId);
    document.documentElement.classList.add("theme-switching");

    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        const themeColors = {
            dark: "#0a0a0f",
            light: "#f5f5f7",
            midnight: "#050816",
            frost: "#e0e8f0",
        };
        meta.content = themeColors[themeId] || "#0a0a0f";
    }

    // Save preference
    setStorage(STORAGE_KEY, themeId);

    // Dispatch event
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: themeId } }));

    // Remove transition lock
    setTimeout(() => {
        document.documentElement.classList.remove("theme-switching");
    }, 500);

    return themeId;
}

// ============================================================
// Get current theme
// ============================================================
export function getCurrentTheme() {
    const stored = getStorage(STORAGE_KEY);
    if (stored) return stored;

    // Check system preference
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
    }

    return CONFIG.defaults.theme;
}

// ============================================================
// Initialize theme
// ============================================================
export function initTheme() {
    const theme = getCurrentTheme();
    applyTheme(theme);
    return theme;
}