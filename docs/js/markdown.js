// docs/js/markdown.js
//
// Arys AI v1.5.1 — Markdown rendering with syntax highlighting

// ============================================================
// Escape HTML
// ============================================================
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// Render inline code
// ============================================================
function renderInlineCode(text) {
    return text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
}

// ============================================================
// Render bold/italic
// ============================================================
function renderEmphasis(text) {
    // Bold: **text** or __text__
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");

    // Italic: *text* or _text_ (but not ** or __)
    text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    text = text.replace(/(?<!_)_([^_]+)_(?!_)/g, "<em>$1</em>");

    return text;
}

// ============================================================
// Render links
// ============================================================
function renderLinks(text) {
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

// ============================================================
// Render code blocks with syntax highlighting
// ============================================================
function renderCodeBlocks(text) {
    return text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || "text";
        const escaped = escapeHtml(code.trim());
        return `<pre class="code-block"><code class="language-${language}">${escaped}</code></pre>`;
    });
}

// ============================================================
// Render blockquotes
// ============================================================
function renderBlockquotes(text) {
    return text.replace(/^>\s*(.+)$/gm, "<blockquote>$1</blockquote>");
}

// ============================================================
// Render lists
// ============================================================
function renderLists(text) {
    // Unordered lists
    text = text.replace(/^[\s]*[-*+]\s+(.+)$/gm, "<li>$1</li>");
    text = text.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

    // Ordered lists
    text = text.replace(/^[\s]*\d+\.\s+(.+)$/gm, "<li>$1</li>");
    text = text.replace(/(<li>.*<\/li>\n?)+/g, "<ol>$&</ol>");

    return text;
}

// ============================================================
// Render headings
// ============================================================
function renderHeadings(text) {
    text = text.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
    text = text.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
    text = text.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
    return text;
}

// ============================================================
// Render horizontal rules
// ============================================================
function renderHorizontalRules(text) {
    return text.replace(/^---$/gm, "<hr>");
}

// ============================================================
// Render paragraphs
// ============================================================
function renderParagraphs(text) {
    // Split by double newlines
    const blocks = text.split(/\n\s*\n/);
    return blocks
        .map((block) => {
            block = block.trim();
            if (!block) return "";
            // Don't wrap already-block elements
            if (/^<(h[1-6]|ul|ol|pre|blockquote|hr)/.test(block)) return block;
            return `<p>${block}</p>`;
        })
        .join("\n");
}

// ============================================================
// Main render function
// ============================================================
export function renderMarkdown(text) {
    if (!text) return "";

    let html = text;

    // Process in order
    html = renderCodeBlocks(html);
    html = renderHeadings(html);
    html = renderHorizontalRules(html);
    html = renderBlockquotes(html);
    html = renderLists(html);
    html = renderLinks(html);
    html = renderEmphasis(html);
    html = renderInlineCode(html);
    html = renderParagraphs(html);

    return html;
}

// ============================================================
// Highlight code blocks (call after DOM insertion)
// ============================================================
export function highlightCodeBlocks(container) {
    const blocks = container.querySelectorAll("pre code");
    blocks.forEach((block) => {
        if (!block.classList.contains("hljs")) {
            block.classList.add("hljs");
            // Simple highlighting for common patterns
            highlightElement(block);
        }
    });
}

// ============================================================
// Simple syntax highlighting
// ============================================================
function highlightElement(element) {
    let html = element.innerHTML;

    // Keywords
    html = html.replace(
        /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|finally|throw|new|this|super|extends|implements|interface|type|enum|public|private|protected|static|readonly)\b/g,
        '<span class="hljs-keyword">$1</span>'
    );

    // Strings
    html = html.replace(/"([^"\\]|\\.)*"/g, '<span class="hljs-string">$&</span>');
    html = html.replace(/'([^'\\]|\\.)*'/g, '<span class="hljs-string">$&</span>');
    html = html.replace(/`([^`\\]|\\.)*`/g, '<span class="hljs-string">$&</span>');

    // Comments
    html = html.replace(/\/\/.*$/gm, '<span class="hljs-comment">$&</span>');
    html = html.replace(/\/\*[\s\S]*?\*\//g, '<span class="hljs-comment">$&</span>');

    // Numbers
    html = html.replace(/\b\d+(\.\d+)?\b/g, '<span class="hljs-number">$&</span>');

    // Functions
    html = html.replace(/\b([a-zA-Z_$][\w$]*)\s*\(/g, '<span class="hljs-function">$1</span>(');

    element.innerHTML = html;
}