// docs/js/app.js
//
// Arys AI v1.5.1 — Main application entry point

import { CONFIG } from "./config.js";
import { initTheme, applyTheme } from "./themes.js";
import { initSettings, getSettings } from "./settings.js";
import { initFeedback, openFeedbackModal } from "./feedback.js";
import { initWelcomeScreen, showWelcomeScreen, hideWelcomeScreen } from "./welcome.js";
import { initChat, sendMessage, clearChat, toggleSidebar } from "./chat.js";
import { init3D, stop3D, dispose3D } from "./3d.js";
import { $, $$, getStorage, setStorage } from "./utils.js";

// ============================================================
// Global state
// ============================================================
let isInitialized = false;

// ============================================================
// Initialize the application
// ============================================================
export async function initApp() {
    if (isInitialized) return;
    isInitialized = true;

    // Initialize theme
    initTheme();

    // Initialize settings
    initSettings();

    // Initialize feedback
    initFeedback();

    // Initialize welcome screen
    initWelcomeScreen(() => {
        // On welcome screen enter
        initChat();
        init3D();
    });

    // Initialize chat (will be called after welcome screen)
    // initChat();

    // Initialize 3D background
    // init3D();

    // Setup global event listeners
    setupGlobalListeners();

    // Show welcome screen
    showWelcomeScreen();

    // Check for welcome screen dismissal
    const dismissed = getStorage("arys_welcome_dismissed");
    if (dismissed) {
        hideWelcomeScreen();
        initChat();
        init3D();
    }

    console.log(`Arys AI v${CONFIG.version} initialized`);
}

// ============================================================
// Setup global event listeners
// ============================================================
function setupGlobalListeners() {
    // Theme toggle
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const current = document.documentElement.getAttribute("data-theme");
            const themes = CONFIG.themes.map((t) => t.id);
            const currentIndex = themes.indexOf(current);
            const nextIndex = (currentIndex + 1) % themes.length;
            applyTheme(themes[nextIndex]);
        });
    }

    // Settings button
    const settingsBtn = document.getElementById("settingsBtn");
    if (settingsBtn) {
        settingsBtn.addEventListener("click", openSettingsModal);
    }

    // Feedback button
    const feedbackBtn = document.getElementById("feedbackBtn");
    if (feedbackBtn) {
        feedbackBtn.addEventListener("click", openFeedbackModal);
    }

    // Close modals on Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeAllModals();
        }
    });

    // Settings modal close
    const settingsClose = document.getElementById("settingsClose");
    if (settingsClose) {
        settingsClose.addEventListener("click", closeSettingsModal);
    }

    const settingsOverlay = document.getElementById("settingsOverlay");
    if (settingsOverlay) {
        settingsOverlay.addEventListener("click", closeSettingsModal);
    }

    // Settings form
    const settingsForm = document.getElementById("settingsForm");
    if (settingsForm) {
        settingsForm.addEventListener("submit", handleSettingsSubmit);
    }

    // Model select
    const modelSelect = document.getElementById("modelSelect");
    if (modelSelect) {
        populateModelSelect(modelSelect);
    }

    // Theme options
    $$(".theme-option").forEach((opt) => {
        opt.addEventListener("click", () => {
            $$(".theme-option").forEach((o) => o.classList.remove("active"));
            opt.classList.add("active");
            applyTheme(opt.dataset.theme);
        });
    });

    // Welcome screen dismiss
    const dismissWelcome = document.getElementById("dismissWelcome");
    if (dismissWelcome) {
        dismissWelcome.addEventListener("click", () => {
            setStorage("arys_welcome_dismissed", true);
        });
    }

    // New chat button
    const newChatBtn = document.getElementById("newChatBtn");
    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => {
            clearChat();
            toggleSidebar();
        });
    }

    // History button
    const historyBtn = document.getElementById("historyBtn");
    if (historyBtn) {
        historyBtn.addEventListener("click", toggleSidebar);
    }

    // Sidebar overlay
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", toggleSidebar);
    }

    // Clear chat button
    const clearChatBtn = document.getElementById("clearChatBtn");
    if (clearChatBtn) {
        clearChatBtn.addEventListener("click", () => {
            if (confirm("Clear all messages?")) {
                clearChat();
            }
        });
    }

    // Window resize
    window.addEventListener("resize", debounce(() => {
        // Trigger resize for 3D
        window.dispatchEvent(new Event("resize"));
    }, 250));

    // Visibility change - pause 3D when tab hidden
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stop3D();
        } else {
            init3D();
        }
    });
}

// ============================================================
// Settings modal
// ============================================================
function openSettingsModal() {
    const modal = document.getElementById("settingsModal");
    if (!modal) return;

    // Populate current values
    const settings = getSettings();
    populateSettingsForm(settings);

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeSettingsModal() {
    const modal = document.getElementById("settingsModal");
    if (!modal) return;

    modal.classList.remove("active");
    document.body.style.overflow = "";
}

function populateSettingsForm(settings) {
    const form = document.getElementById("settingsForm");
    if (!form) return;

    // Model
    const modelSelect = document.getElementById("modelSelect");
    if (modelSelect) {
        modelSelect.value = settings.model;
    }

    // Temperature
    const tempInput = document.getElementById("temperature");
    const tempValue = document.getElementById("temperatureValue");
    if (tempInput) {
        tempInput.value = settings.temperature;
        if (tempValue) tempValue.textContent = settings.temperature.toFixed(1);
    }

    // Max tokens
    const maxTokensInput = document.getElementById("maxTokens");
    if (maxTokensInput) {
        maxTokensInput.value = settings.maxTokens;
    }

    // Toggles
    const toggles = {
        enableWebSearch: settings.enableWebSearch,
        enableAutoSearch: settings.enableAutoSearch,
        enableStreaming: settings.enableStreaming,
    };

    Object.entries(toggles).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.checked = value;
    });

    // Search depth
    const searchDepth = document.getElementById("searchDepth");
    if (searchDepth) {
        searchDepth.value = settings.searchDepth;
    }
}

function populateModelSelect(select) {
    if (!select) return;
    select.innerHTML = CONFIG.models
        .map((m) => `<option value="${m.id}">${m.name}</option>`)
        .join("");
}

async function handleSettingsSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";
    }

    try {
        const formData = new FormData(form);
        const settings = {
            model: formData.get("model"),
            temperature: parseFloat(formData.get("temperature")),
            maxTokens: parseInt(formData.get("maxTokens"), 10),
            enableWebSearch: formData.get("enableWebSearch") === "on",
            enableAutoSearch: formData.get("enableAutoSearch") === "on",
            searchDepth: parseInt(formData.get("searchDepth"), 10),
            enableStreaming: formData.get("enableStreaming") === "on",
        };

        // Save settings
        const { setSettings } = await import("./settings.js");
        setSettings(settings);

        // Show success
        const toast = showToast("Settings saved successfully");
        setTimeout(() => toast?.remove(), 2000);

        closeSettingsModal();
    } catch (err) {
        showToast("Failed to save settings: " + err.message, "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

// ============================================================
// Toast notifications
// ============================================================
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer") || createToastContainer();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Close">&times;</button>
    `;

    toast.querySelector(".toast-close").addEventListener("click", () => toast.remove());
    container.appendChild(toast);

    // Auto remove
    setTimeout(() => toast.remove(), 4000);

    return toast;
}

function createToastContainer() {
    const container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
    return container;
}

function closeAllModals() {
    const modals = document.querySelectorAll(".modal.active");
    modals.forEach((modal) => {
        modal.classList.remove("active");
    });
    document.body.style.overflow = "";
}

// ============================================================
// Debounce helper
// ============================================================
function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ============================================================
// Export for global access
// ============================================================
window.ArysAI = {
    initApp,
    sendMessage,
    clearChat,
    toggleSidebar,
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