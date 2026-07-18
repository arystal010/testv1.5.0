// docs/js/welcome.js
//
// Arys AI v1.5.1 — Welcome screen module
// FIX: removed import of non-existent `animate` and `generateId` from utils
//      replaced animate() calls with direct CSS transition approach

import { $ } from "./utils.js";

// ============================================================
// Animate an element with CSS transitions
// ============================================================
function animateEl(el, props, durationMs, easing) {
    if (!el) return;
    el.style.transition = `opacity ${durationMs}ms ${easing}, transform ${durationMs}ms ${easing}`;
    // Force reflow so transition triggers
    el.getBoundingClientRect();
    if (props.opacity !== undefined) el.style.opacity = props.opacity;
    if (props.transform !== undefined) el.style.transform = props.transform;
}

// ============================================================
// Show welcome screen
// ============================================================
export function showWelcomeScreen() {
    const welcomeScreen = $("#welcome-screen");
    if (!welcomeScreen) return;

    welcomeScreen.classList.add("active");
    document.body.style.overflow = "hidden";

    animateEntrance();

    if (window.init3DBackground) {
        window.init3DBackground();
    }
}

// ============================================================
// Hide welcome screen
// ============================================================
export function hideWelcomeScreen() {
    const welcomeScreen = $("#welcome-screen");
    if (!welcomeScreen) return;

    welcomeScreen.classList.remove("active");
    document.body.style.overflow = "";

    if (window.stop3DBackground) {
        window.stop3DBackground();
    }
}

// ============================================================
// Animate entrance
// ============================================================
function animateEntrance() {
    const elements = [
        { selector: ".welcome-logo", delay: 0 },
        { selector: ".welcome-title", delay: 150 },
        { selector: ".welcome-description", delay: 300 },
        { selector: ".welcome-info-card", delay: 450 },
        { selector: ".welcome-enter-btn", delay: 600 },
    ];

    elements.forEach(({ selector, delay }) => {
        const el = $(selector);
        if (el) {
            el.style.opacity = "0";
            el.style.transform = "translateY(30px)";
            setTimeout(() => {
                animateEl(el, { opacity: 1, transform: "translateY(0)" }, 600, "cubic-bezier(0.16, 1, 0.3, 1)");
            }, delay);
        }
    });
}

// ============================================================
// Initialize welcome screen
// ============================================================
export function initWelcomeScreen(onEnter) {
    const enterBtn = $("#enter-chat-btn");
    const welcomeScreen = $("#welcome-screen");

    if (!enterBtn || !welcomeScreen) return;

    enterBtn.addEventListener("click", () => {
        const elements = welcomeScreen.querySelectorAll(
            ".welcome-logo, .welcome-title, .welcome-description, .welcome-info-card, .welcome-enter-btn"
        );
        elements.forEach((el, i) => {
            setTimeout(() => {
                animateEl(el, { opacity: 0, transform: "translateY(-20px)" }, 300, "cubic-bezier(0.4, 0, 1, 1)");
            }, i * 50);
        });

        setTimeout(() => {
            hideWelcomeScreen();
            if (onEnter) onEnter();
        }, 400);
    });

    // Keyboard: Enter or Space
    document.addEventListener("keydown", (e) => {
        if (welcomeScreen.classList.contains("active") && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            enterBtn.click();
        }
    });

    // Touch ripple effect on button
    enterBtn.addEventListener("pointerdown", (e) => {
        const rect = enterBtn.getBoundingClientRect();
        const ripple = document.createElement("span");
        ripple.className = "btn-ripple";
        ripple.style.left = `${e.clientX - rect.left}px`;
        ripple.style.top = `${e.clientY - rect.top}px`;
        enterBtn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });
}
