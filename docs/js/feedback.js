// docs/js/feedback.js
//
// Arys AI v1.5.1 — Feedback module

import { CONFIG } from "./config.js";
import { submitFeedback } from "./api.js";
import { $, sanitize, generateId } from "./utils.js";

// ============================================================
// Open feedback modal
// ============================================================
export function openFeedbackModal() {
    const modal = document.getElementById("feedbackModal");
    if (!modal) return;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
}

// ============================================================
// Close feedback modal
// ============================================================
export function closeFeedbackModal() {
    const modal = document.getElementById("feedbackModal");
    if (!modal) return;

    modal.classList.remove("active");
    document.body.style.overflow = "";
}

// ============================================================
// Initialize feedback form
// ============================================================
export function initFeedback() {
    const form = document.getElementById("feedbackForm");
    const closeBtn = document.getElementById("feedbackClose");
    const openBtn = document.getElementById("openFeedbackBtn");

    if (!form) return;

    // Open button
    if (openBtn) {
        openBtn.addEventListener("click", openFeedbackModal);
    }

    // Close button
    if (closeBtn) {
        closeBtn.addEventListener("click", closeFeedbackModal);
    }

    // Close on backdrop click
    const modal = document.getElementById("feedbackModal");
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeFeedbackModal();
        });
    }

    // Close with Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeFeedbackModal();
    });

    // Form submission
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector(".feedback-submit");
        const originalText = submitBtn?.textContent || "Submit";

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting...";
        }

        // Clear previous errors
        const errorEl = document.getElementById("feedbackError");
        if (errorEl) errorEl.style.display = "none";

        // Get form data
        const name = sanitize($("#feedbackName", form)?.value || "").slice(0, 100);
        const email = sanitize($("#feedbackEmail", form)?.value || "").slice(0, 200);
        const type = $("#feedbackType", form)?.value || "bug";
        const message = sanitize($("#feedbackMessage", form)?.value || "").slice(0, 5000);
        const rating = parseInt($("#feedbackRating", form)?.value || "0");

        // Validate
        if (!message || message.length < 10) {
            if (errorEl) {
                errorEl.textContent = "Message must be at least 10 characters.";
                errorEl.style.display = "block";
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
            return;
        }

        try {
            await submitFeedback({ name, email, type, message, rating });

            // Show success
            const successEl = document.getElementById("feedbackSuccess");
            if (successEl) {
                successEl.style.display = "block";
            }

            // Reset form
            form.reset();

            // Close after delay
            setTimeout(() => {
                closeFeedbackModal();
                if (successEl) successEl.style.display = "none";
            }, 2000);
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = err.message || "Failed to submit feedback. Please try again.";
                errorEl.style.display = "block";
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    });
}