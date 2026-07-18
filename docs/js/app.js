// docs/js/app.js
//
// Arys AI v1.5.1 — Main application entry point
// FIX: aligned element IDs with actual HTML (welcome-screen, enter-chat-btn, etc.)
//      fixed double-initialization guard for initChat/init3D
//      fixed settings modal to match HTML element IDs

import { CONFIG } from "./config.js";
import { initTheme, applyTheme, getCurrentTheme } from "./themes.js";
import { initSettings, getSettings, setSettings } from "./settings.js";
import { initFeedback, openFeedbackModal, closeFeedbackModal } from "./feedback.js";
import { initWelcomeScreen, showWelcomeScreen, hideWelcomeScreen } from "./welcome.js";
import { initChat, sendMessage, clearChat, toggleSidebar, retryLastMessage } from "./chat.js";
import { init3D, stop3D, dispose3D } from "./3d.js";
import { $, $$, getStorage, setStorage } from "./utils.js";

let isInitialized = false;

// ============================================================
// Initialize the application
// ============================================================
export async function initApp() {
    if (isInitialized) return;
    isInitialized = true;

    initTheme();
    initSettings();
    initFeedback();

    // Check if welcome was already dismissed
    const dismissed = getStorage("arys_welcome_dismissed");

    initWelcomeScreen(() => {
        // Called when user clicks "Start Chatting"
        setStorage("arys_welcome_dismissed", true);
        showChatScreen();
    });

    setupGlobalListeners();

    if (dismissed) {
        hideWelcomeScreen();
        showChatScreen();
    } else {
        showWelcomeScreen();
    }

    console.log(`Arys AI v${CONFIG.version} initialized`);
}

// ============================================================
// Show the chat screen (initialize chat + 3D once)
// ============================================================
let chatInitialized = false;
function showChatScreen() {
    const chatScreen = document.getElementById("chat-screen");
    if (chatScreen) {
        chatScreen.style.display = "flex";
        // Trigger fade-in
        requestAnimationFrame(() => {
            chatScreen.style.opacity = "1";
        });
    }

    if (!chatInitialized) {
        chatInitialized = true;
        initChat();
        init3D();
    }
}

// ============================================================
// Setup global event listeners
// ============================================================
function setupGlobalListeners() {
    // Theme buttons in settings modal
    $$(".theme-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            $$(".theme-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            applyTheme(btn.dataset.theme);
        });
    });

    // Sync active theme button on open
    window.addEventListener("themechange", (e) => {
        $$(".theme-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.theme === e.detail.theme);
        });
    });

    // Settings modal — open
    $$("[id$='-settings'], #chat-settings-btn, #welcome-settings-btn, #sidebar-settings").forEach((btn) => {
        if (btn) btn.addEventListener("click", openSettingsModal);
    });

    // Settings modal — close
    const settingsClose = document.getElementById("settings-close");
    if (settingsClose) settingsClose.addEventListener("click", closeSettingsModal);

    const settingsModal = document.getElementById("settings-modal");
    if (settingsModal) {
        settingsModal.addEventListener("click", (e) => {
            if (e.target === settingsModal) closeSettingsModal();
        });
    }

    // Settings range inputs — live value display
    const tempInput = document.getElementById("settings-temperature");
    const tempValue = document.getElementById("temperature-value");
    if (tempInput && tempValue) {
        tempInput.addEventListener("input", () => {
            tempValue.textContent = parseFloat(tempInput.value).toFixed(1);
        });
    }

    const tokensInput = document.getElementById("settings-tokens");
    const tokensValue = document.getElementById("tokens-value");
    if (tokensInput && tokensValue) {
        tokensInput.addEventListener("input", () => {
            tokensValue.textContent = tokensInput.value;
        });
    }

    const depthInput = document.getElementById("settings-depth");
    const depthValue = document.getElementById("depth-value");
    if (depthInput && depthValue) {
        depthInput.addEventListener("input", () => {
            depthValue.textContent = depthInput.value;
        });
    }

    // Settings — save button (the modal has no form submit; button is standalone)
    // We wire the save via a dedicated Save button pattern
    // Settings — clear conversations
    const clearBtn = document.getElementById("settings-clear");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (confirm("Clear all conversations? This cannot be undone.")) {
                clearChat();
                showToast("Conversations cleared");
            }
        });
    }

    // Settings — back to home
    const homeBtn = document.getElementById("settings-home");
    if (homeBtn) {
        homeBtn.addEventListener("click", () => {
            closeSettingsModal();
            // Remove dismissed flag and reload
            localStorage.removeItem("arys_welcome_dismissed");
            location.reload();
        });
    }

    // Feedback buttons
    $$("[id$='-feedback'], #chat-feedback-btn, #sidebar-feedback, #feedback-from-welcome").forEach((btn) => {
        if (btn) btn.addEventListener("click", openFeedbackModal);
    });

    // Sidebar toggle
    const sidebarToggle = document.getElementById("sidebar-toggle");
    if (sidebarToggle) sidebarToggle.addEventListener("click", toggleSidebar);

    // New chat
    const newChatBtn = document.getElementById("new-chat-btn");
    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => {
            clearChat();
            const sidebar = document.getElementById("sidebar");
            if (sidebar?.classList.contains("open")) toggleSidebar();
        });
    }

    // Escape closes any open modal
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeSettingsModal();
            closeFeedbackModal();
        }
    });

    // Visibility change — pause/resume 3D
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stop3D();
        } else if (chatInitialized) {
            init3D();
        }
    });
}

// ============================================================
// Settings modal
// ============================================================
function openSettingsModal() {
    const modal = document.getElementById("settings-modal");
    if (!modal) return;

    populateSettingsForm(getSettings());
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeSettingsModal() {
    const modal = document.getElementById("settings-modal");
    if (!modal) return;

    // Save settings from form before closing
    saveSettingsFromForm();

    modal.classList.add("hidden");
    document.body.style.overflow = "";
}

function populateSettingsForm(settings) {
    const modelEl = document.getElementById("settings-model");
    if (modelEl) modelEl.value = settings.model;

    const tempEl = document.getElementById("settings-temperature");
    const tempValEl = document.getElementById("temperature-value");
    if (tempEl) {
        tempEl.value = settings.temperature;
        if (tempValEl) tempValEl.textContent = Number(settings.temperature).toFixed(1);
    }

    const tokensEl = document.getElementById("settings-tokens");
    const tokensValEl = document.getElementById("tokens-value");
    if (tokensEl) {
        tokensEl.value = settings.maxTokens;
        if (tokensValEl) tokensValEl.textContent = settings.maxTokens;
    }

    const searchEl = document.getElementById("settings-search");
    if (searchEl) searchEl.checked = settings.enableWebSearch;

    const autoEl = document.getElementById("settings-auto-search");
    if (autoEl) autoEl.checked = settings.enableAutoSearch;

    const depthEl = document.getElementById("settings-depth");
    const depthValEl = document.getElementById("depth-value");
    if (depthEl) {
        depthEl.value = settings.searchDepth;
        if (depthValEl) depthValEl.textContent = settings.searchDepth;
    }

    const streamEl = document.getElementById("settings-streaming");
    if (streamEl) streamEl.checked = settings.enableStreaming;

    // Highlight active theme button
    const currentTheme = getCurrentTheme();
    $$(".theme-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.theme === currentTheme);
    });
}

function saveSettingsFromForm() {
    const updated = {};

    const modelEl = document.getElementById("settings-model");
    if (modelEl) updated.model = modelEl.value;

    const tempEl = document.getElementById("settings-temperature");
    if (tempEl) updated.temperature = parseFloat(tempEl.value);

    const tokensEl = document.getElementById("settings-tokens");
    if (tokensEl) updated.maxTokens = parseInt(tokensEl.value, 10);

    const searchEl = document.getElementById("settings-search");
    if (searchEl) updated.enableWebSearch = searchEl.checked;

    const autoEl = document.getElementById("settings-auto-search");
    if (autoEl) updated.enableAutoSearch = autoEl.checked;

    const depthEl = document.getElementById("settings-depth");
    if (depthEl) updated.searchDepth = parseInt(depthEl.value, 10);

    const streamEl = document.getElementById("settings-streaming");
    if (streamEl) updated.enableStreaming = streamEl.checked;

    setSettings(updated);
    showToast("Settings saved");
}

// ============================================================
// Toast notifications
// ============================================================
export function showToast(message, type = "success") {
    const container = document.getElementById("toast-container") || createToastContainer();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Close">&times;</button>
    `;
    toast.querySelector(".toast-close").addEventListener("click", () => toast.remove());
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
    return toast;
}

function createToastContainer() {
    const container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
    return container;
}

// ============================================================
// Export for global access (e.g. retry button in chat.js)
// ============================================================
window.ArysAI = {
    initApp,
    sendMessage,
    clearChat,
    toggleSidebar,
    retryLastMessage,
    openFeedbackModal,
    openSettingsModal,
    showToast,
    version: CONFIG.version,
};

// ============================================================
// Auto-initialize on DOM ready
// ============================================================
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
