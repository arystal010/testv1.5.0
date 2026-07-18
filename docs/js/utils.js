// docs/js/utils.js
//
// Arys AI v1.5.1 — Utility functions

// ============================================================
// DOM Helpers
// ============================================================
export const $ = (selector, parent = document) => parent.querySelector(selector);
export const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

export function createElement(tag, className, attributes = {}) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
}

export function sanitize(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// Local Storage with JSON parsing
// ============================================================
export function getStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch {
        return defaultValue;
    }
}

export function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

export function removeStorage(key) {
    localStorage.removeItem(key);
}

// ============================================================
// ID generation
// ============================================================
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ============================================================
// Debounce
// ============================================================
export function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ============================================================
// Throttle
// ============================================================
export function throttle(fn, limit = 300) {
    let inThrottle = false;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// ============================================================
// Clipboard
// ============================================================
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        return true;
    }
}

// ============================================================
// Time formatting
// ============================================================
export function formatTime(date) {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================================
// Text truncation
// ============================================================
export function truncate(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text || "";
    return text.slice(0, maxLength) + "...";
}

// ============================================================
// Detect mobile
// ============================================================
export function isMobile() {
    return window.innerWidth <= 768;
}

// ============================================================
// Auto-resize textarea
// ============================================================
export function autoResizeTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
}

// ============================================================
// Escape regex special chars
// ============================================================
export function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================
// Safe JSON parse
// ============================================================
export function safeJsonParse(str, fallback = null) {
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}