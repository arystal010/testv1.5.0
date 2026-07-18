// frontend/js/app.js
//
// Arys AI — Main application entry point

import { streamChat, stopGeneration } from "./api.js";
import { CONFIG, SELECTORS, ROLE, DEFAULT_SYSTEM_PROMPT } from "./config.js";

// ============================================================
// State
// ============================================================
let messages = [{ role: "system", content: DEFAULT_SYSTEM_PROMPT }];
let isStreaming = false;
const themes = ["dark", "light"];
let themeIndex = 0;

// ============================================================
// DOM helpers
// ============================================================
const $ = (sel) => document.querySelector(sel);

function getElements() {
    return {
        messagesEl: $(SELECTORS.messages),
        promptEl: $(SELECTORS.prompt),
        sendBtn: $(SELECTORS.send),
        stopBtn: $(SELECTORS.stop),
        newChatBtn: $(SELECTORS.newChat),
        themeBtn: $(SELECTORS.theme),
        scrollBtn: $(SELECTORS.scroll),
    };
}

// ============================================================
// Render a single message bubble
// ============================================================
function renderMessage(role, text) {
    const { messagesEl } = getElements();
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.setAttribute("data-role", role);

    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = role === ROLE.USER ? "You" : "Arys AI";

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = text;

    div.appendChild(label);
    div.appendChild(content);
    messagesEl.appendChild(div);
    scrollToBottom();
    return content; // return so we can append tokens to it
}

// ============================================================
// Scroll helpers
// ============================================================
function scrollToBottom() {
    const { messagesEl, scrollBtn } = getElements();
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (scrollBtn) scrollBtn.hidden = true;
}

function updateScrollButton() {
    const { messagesEl, scrollBtn } = getElements();
    if (!scrollBtn) return;
    const nearBottom =
        messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
    scrollBtn.hidden = nearBottom;
}

// ============================================================
// Send a message
// ============================================================
async function sendMessage() {
    const { promptEl, sendBtn, stopBtn } = getElements();
    const text = promptEl.value.trim();
    if (!text || isStreaming) return;

    // Add user message to history and UI
    messages.push({ role: ROLE.USER, content: text });
    renderMessage(ROLE.USER, text);
    promptEl.value = "";
    promptEl.style.height = "auto";

    // Prepare streaming state
    isStreaming = true;
    sendBtn.disabled = true;
    if (stopBtn) stopBtn.hidden = false;

    // Create assistant bubble for streaming
    const assistantContent = renderMessage(ROLE.ASSISTANT, "");

    const conversationHistory = messages.filter((m) => m.role !== "system").concat();

    await streamChat({
        messages: messages.slice(), // include system prompt
        onStart: () => {
            assistantContent.textContent = "";
        },
        onToken: (token, fullText) => {
            assistantContent.textContent = fullText;
            scrollToBottom();
        },
        onFinish: (fullText) => {
            assistantContent.textContent = fullText || assistantContent.textContent;
            messages.push({ role: ROLE.ASSISTANT, content: fullText });
            finishStreaming();
        },
        onError: (err) => {
            assistantContent.textContent = `⚠ ${err}`;
            assistantContent.style.color = "var(--error, #e55)";
            finishStreaming();
        },
    });
}

function finishStreaming() {
    const { sendBtn, stopBtn } = getElements();
    isStreaming = false;
    sendBtn.disabled = false;
    if (stopBtn) stopBtn.hidden = true;
}

// ============================================================
// New chat
// ============================================================
function newChat() {
    messages = [{ role: "system", content: DEFAULT_SYSTEM_PROMPT }];
    const { messagesEl } = getElements();
    messagesEl.innerHTML = `
        <section class="welcome">
            <h1>What can I help with?</h1>
            <p>Conversations are temporary.</p>
        </section>
    `;
}

// ============================================================
// Theme toggle
// ============================================================
function toggleTheme() {
    themeIndex = (themeIndex + 1) % themes.length;
    document.body.className = themes[themeIndex];
}

// ============================================================
// Auto-resize textarea
// ============================================================
function autoResize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, CONFIG.MAX_INPUT_ROWS * 24) + "px";
}

// ============================================================
// Initialize
// ============================================================
function init() {
    const { promptEl, sendBtn, stopBtn, newChatBtn, themeBtn, scrollBtn, messagesEl } =
        getElements();

    // Send on button click
    if (sendBtn) {
        sendBtn.addEventListener("click", sendMessage);
    }

    // Send on Enter (Shift+Enter = newline)
    if (promptEl) {
        promptEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        promptEl.addEventListener("input", () => autoResize(promptEl));
    }

    // Stop streaming
    if (stopBtn) {
        stopBtn.hidden = true;
        stopBtn.addEventListener("click", () => {
            stopGeneration();
            finishStreaming();
        });
    }

    // New chat
    if (newChatBtn) {
        newChatBtn.addEventListener("click", newChat);
    }

    // Theme toggle
    if (themeBtn) {
        themeBtn.addEventListener("click", toggleTheme);
    }

    // Scroll to bottom button
    if (scrollBtn) {
        scrollBtn.hidden = true;
        scrollBtn.addEventListener("click", scrollToBottom);
    }

    // Show/hide scroll button on scroll
    if (messagesEl) {
        messagesEl.addEventListener("scroll", updateScrollButton);
    }
}

// ============================================================
// Boot
// ============================================================
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
