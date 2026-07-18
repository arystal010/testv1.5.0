// docs/js/chat.js
//
// Arys AI v1.5.1 — Chat module
// FIX: added removeStorage to imports (was used but never imported)

import { CONFIG } from "./config.js";
import { streamChat } from "./api.js";
import { renderMarkdown, highlightCodeBlocks } from "./markdown.js";
import {
    $, $$, generateId, sanitize, copyToClipboard,
    autoResizeTextarea, getStorage, setStorage, removeStorage, formatTime
} from "./utils.js";

const HISTORY_KEY = "arys_chat_history";
const MAX_HISTORY = 50;

// ============================================================
// State
// ============================================================
let chatHistory = [];
let currentMessages = [];
let abortController = null;
let isProcessing = false;

// ============================================================
// Send a message
// ============================================================
export async function sendMessage(text) {
    if (isProcessing || !text || !text.trim()) return;
    text = text.trim();

    const chatMessages = document.getElementById("messages-list");
    if (!chatMessages) return;

    isProcessing = true;
    updateSendButtonState();

    // Add user message
    addMessage("user", text);
    currentMessages.push({ role: "user", content: text });

    // Show typing indicator
    const typingEl = showTypingIndicator();

    // Create assistant message container
    const assistantMsg = document.createElement("div");
    assistantMsg.className = "message assistant";
    assistantMsg.dataset.messageId = generateId();

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;

    const content = document.createElement("div");
    content.className = "message-content";
    content.id = `msg-${assistantMsg.dataset.messageId}`;

    assistantMsg.appendChild(avatar);
    assistantMsg.appendChild(content);
    chatMessages.appendChild(assistantMsg);

    scrollToBottom();

    abortController = new AbortController();
    let fullContent = "";

    await streamChat(
        currentMessages,
        // onToken
        (token) => {
            fullContent += token;
            content.innerHTML = renderMarkdown(fullContent);
            highlightCodeBlocks(content);
            scrollToBottom();
        },
        // onDone
        (finalContent) => {
            typingEl.remove();
            if (finalContent) {
                currentMessages.push({ role: "assistant", content: finalContent });
                addCopyButtons(content);
                saveToHistory(finalContent);
            }
            isProcessing = false;
            updateSendButtonState();
            abortController = null;
        },
        // onError
        (error) => {
            typingEl.remove();
            content.innerHTML = `
                <div class="message-error">
                    <div class="error-icon">⚠</div>
                    <div class="error-text">${sanitize(error.message || "An error occurred while processing your request.")}</div>
                    <button class="retry-btn" onclick="window.ArysAI && window.ArysAI.retryLastMessage()">Retry</button>
                </div>
            `;
            isProcessing = false;
            updateSendButtonState();
            abortController = null;
        }
    );
}

// ============================================================
// Add message to chat
// ============================================================
function addMessage(role, text) {
    const chatMessages = document.getElementById("messages-list");
    if (!chatMessages) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${role}`;
    msgDiv.dataset.messageId = generateId();

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    if (role === "user") {
        avatar.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    } else {
        avatar.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;
    }

    const content = document.createElement("div");
    content.className = "message-content";

    if (role === "user") {
        content.textContent = text;
    } else {
        content.innerHTML = renderMarkdown(text);
        highlightCodeBlocks(content);
        addCopyButtons(content);
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

// ============================================================
// Show typing indicator
// ============================================================
function showTypingIndicator() {
    const chatMessages = document.getElementById("messages-list");
    const typing = document.createElement("div");
    typing.className = "typing-indicator";
    typing.innerHTML = `
        <div class="typing-bounce">
            <span></span>
            <span></span>
            <span></span>
        </div>
        <span class="typing-text">Thinking</span>
    `;
    chatMessages.appendChild(typing);
    scrollToBottom();
    return typing;
}

// ============================================================
// Add copy buttons to code blocks
// ============================================================
function addCopyButtons(container) {
    container.querySelectorAll(".code-block").forEach((block) => {
        if (block.querySelector(".copy-btn")) return;

        const btn = document.createElement("button");
        btn.className = "copy-btn";
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
        btn.addEventListener("click", () => {
            const code = block.querySelector("code")?.textContent || "";
            copyToClipboard(code);
            btn.textContent = "Copied!";
            setTimeout(() => {
                btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
            }, 2000);
        });
        block.style.position = "relative";
        block.appendChild(btn);
    });
}

// ============================================================
// Scroll to bottom
// ============================================================
function scrollToBottom() {
    const area = document.getElementById("messages-area");
    if (area) area.scrollTop = area.scrollHeight;
}

// ============================================================
// Retry last message
// ============================================================
export function retryLastMessage() {
    if (currentMessages.length < 2) return;

    if (currentMessages[currentMessages.length - 1]?.role === "assistant") {
        currentMessages.pop();
    }

    const lastUserMsg = currentMessages[currentMessages.length - 1];
    if (lastUserMsg?.role !== "user") return;

    const chatMessages = document.getElementById("messages-list");
    if (chatMessages) {
        const lastMsg = chatMessages.lastElementChild;
        if (lastMsg?.classList.contains("assistant") || lastMsg?.classList.contains("typing-indicator")) {
            chatMessages.removeChild(lastMsg);
        }
    }

    sendMessage(lastUserMsg.content);
}

// ============================================================
// Clear chat
// ============================================================
export function clearChat() {
    const chatMessages = document.getElementById("messages-list");
    if (chatMessages) chatMessages.innerHTML = "";
    currentMessages = [];
    chatHistory = [];
    // FIX: removeStorage is now imported and works correctly
    removeStorage(HISTORY_KEY);
    updateHistoryUI();
}

// ============================================================
// Save to history
// ============================================================
function saveToHistory(content) {
    const title = content.slice(0, 60).replace(/\n/g, " ") || "New conversation";
    const entry = {
        id: generateId(),
        title,
        timestamp: Date.now(),
        messages: [...currentMessages],
    };

    chatHistory = getStorage(HISTORY_KEY, []);
    chatHistory.unshift(entry);
    if (chatHistory.length > MAX_HISTORY) {
        chatHistory = chatHistory.slice(0, MAX_HISTORY);
    }
    setStorage(HISTORY_KEY, chatHistory);
    updateHistoryUI();
}

// ============================================================
// Update history UI
// ============================================================
function updateHistoryUI() {
    const container = document.getElementById("sidebar-history");
    if (!container) return;

    chatHistory = getStorage(HISTORY_KEY, []);

    if (chatHistory.length === 0) {
        container.innerHTML = `
            <div class="history-empty">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>No conversation history</span>
            </div>
        `;
        return;
    }

    container.innerHTML = chatHistory
        .slice(0, 20)
        .map(
            (entry) => `
            <button class="history-item" data-id="${entry.id}">
                <div class="history-item-title">${sanitize(entry.title)}</div>
                <div class="history-item-time">${formatTime(entry.timestamp)}</div>
            </button>
        `
        )
        .join("");

    container.querySelectorAll(".history-item").forEach((item) => {
        item.addEventListener("click", () => {
            const entry = chatHistory.find((e) => e.id === item.dataset.id);
            if (entry) loadConversation(entry);
        });
    });
}

// ============================================================
// Load conversation from history
// ============================================================
function loadConversation(entry) {
    const chatMessages = document.getElementById("messages-list");
    if (!chatMessages) return;

    chatMessages.innerHTML = "";
    currentMessages = entry.messages || [];
    currentMessages.forEach((msg) => addMessage(msg.role, msg.content));

    const sidebar = document.getElementById("sidebar");
    if (sidebar?.classList.contains("open")) toggleSidebar();
}

// ============================================================
// Toggle sidebar
// ============================================================
export function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (sidebar) sidebar.classList.toggle("open");
    if (overlay) overlay.classList.toggle("hidden");
}

// ============================================================
// Update send button state
// ============================================================
function updateSendButtonState() {
    const sendBtn = document.getElementById("send-btn");
    if (sendBtn) {
        sendBtn.disabled = isProcessing;
        sendBtn.innerHTML = isProcessing
            ? `<svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
    }
}

// ============================================================
// Initialize chat
// ============================================================
export function initChat() {
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");
    const historyBtn = document.getElementById("sidebar-toggle");
    const sidebarOverlay = document.getElementById("sidebar-overlay");

    if (chatForm && chatInput) {
        chatForm.addEventListener("submit", (e) => {
            e.preventDefault();
            if (chatInput.value.trim() && !isProcessing) {
                sendMessage(chatInput.value.trim());
                chatInput.value = "";
                autoResizeTextarea(chatInput);
            }
        });

        chatInput.addEventListener("input", () => autoResizeTextarea(chatInput));

        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                chatForm.dispatchEvent(new Event("submit"));
            }
        });
    }

    // Also handle the standalone send button click (not inside form submit)
    if (sendBtn) {
        sendBtn.addEventListener("click", () => {
            const chatInput = document.getElementById("chat-input");
            if (chatInput?.value.trim() && !isProcessing) {
                sendMessage(chatInput.value.trim());
                chatInput.value = "";
                autoResizeTextarea(chatInput);
            }
        });
    }

    if (historyBtn) historyBtn.addEventListener("click", toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener("click", toggleSidebar);

    const newChatBtn = document.getElementById("new-chat-btn");
    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => {
            clearChat();
            toggleSidebar();
        });
    }

    updateHistoryUI();
}
