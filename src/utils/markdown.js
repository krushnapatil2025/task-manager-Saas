/**
 * Sanitizes and parses basic Markdown symbols and user @mentions into HTML.
 * Safe against XSS by pre-escaping all HTML tags.
 * 
 * Supported:
 * - Code block: ```code``` -> <pre className="chat-code-block"><code>...</code></pre>
 * - Inline code: `code` -> <code className="chat-inline-code">...</code>
 * - Bold: **text** -> <strong>...</strong>
 * - Italics: *text* or _text_ -> <em>...</em>
 * - Strikethrough: ~~text~~ -> <del>...</del>
 * - Mentions: @username -> <strong className="chat-mention">@username</strong>
 */
export const parseMarkdownAndMentions = (text) => {
  if (!text) return '';

  // 1. Escape HTML characters to protect against XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Parse Code Blocks (triple backticks)
  html = html.replace(/```([\s\S]+?)```/g, (match, code) => {
    return `<pre class="chat-code-block"><code>${code.trim()}</code></pre>`;
  });

  // 3. Parse Inline Code (single backticks)
  html = html.replace(/`([^`\n]+?)`/g, '<code class="chat-inline-code">$1</code>');

  // 4. Parse Bold (**text**)
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');

  // 5. Parse Italics (*text* or _text_)
  html = html.replace(/\*([\s\S]+?)\*/g, '<em>$1</em>');
  html = html.replace(/_([\s\S]+?)_/g, '<em>$1</em>');

  // 6. Parse Strikethrough (~~text~~)
  html = html.replace(/~~([\s\S]+?)~~/g, '<del>$1</del>');

  // 7. Parse @mentions
  // Matches @ followed by word characters, ensuring it doesn't break HTML tags we just generated
  html = html.replace(/(^|[^a-zA-Z0-9_>])@(\w+)/g, '$1<strong class="chat-mention">@$2</strong>');

  return html;
};
