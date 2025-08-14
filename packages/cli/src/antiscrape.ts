import { detectCanaries } from './api.js';

export interface AntiScrapeOptions {
  includeMeta?: boolean;     // Insert <meta name="saw-canary" ...>
  includeComment?: boolean;  // Insert HTML comment containing token
  includeSpan?: boolean;     // Insert hidden span with token
  honeyLink?: boolean;       // Insert honeypot link (style=display:none) with token in href
  randomZeroWidth?: boolean; // Sprinkle zero-width chars around token to trip naive scrapers
}

export interface AntiScrapeResult { html: string; token: string; }

export function generateCanaryToken(): string {
  const letters = () => Array.from({length: 3+Math.floor(Math.random()*3)}, ()=> String.fromCharCode(65+Math.floor(Math.random()*26))).join('');
  const digits = () => String(Math.floor(100000 + Math.random()*900000));
  return letters() + '-' + digits();
}

function obfuscateToken(token: string, opts: AntiScrapeOptions): string {
  if (!opts.randomZeroWidth) return token;
  const zw = ['\u200B','\u200C','\u200D'];
  return token.split('').map(ch => ch + (Math.random()<0.25? zw[Math.floor(Math.random()*zw.length)] : '')).join('');
}

export function buildAntiScrapeHTML(baseHtml: string, opts: AntiScrapeOptions = {}): AntiScrapeResult {
  const token = generateCanaryToken();
  const obf = obfuscateToken(token, opts);
  // Decide insertion point: before closing body or at end
  const parts: string[] = [];
  if (opts.includeMeta !== false) parts.push(`<meta name="saw-canary" content="${token}">`);
  if (opts.includeComment !== false) parts.push(`<!-- saw-canary:${token} -->`);
  if (opts.includeSpan !== false) parts.push(`<span style="display:none" data-saw-canary="1">${obf}</span>`);
  if (opts.honeyLink) parts.push(`<a href="/__${token.toLowerCase()}__" style="display:none">${obf}</a>`);
  let augmented = baseHtml;
  const injection = '\n' + parts.join('\n') + '\n';
  const bodyCloseRegex = /<\/body>/i;
  if (bodyCloseRegex.test(augmented)) {
    augmented = augmented.replace(bodyCloseRegex, injection + '</body>');
  } else {
    augmented += injection;
  }
  return { html: augmented, token };
}

// Simple page handler factory (Node http)
export function createAntiScrapePageHandler(baseHtmlProvider: () => string | Promise<string>, opts: AntiScrapeOptions = {}) {
  return async function pageHandler(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
    try {
      const html = await baseHtmlProvider();
      const { html: injected, token } = buildAntiScrapeHTML(html, opts);
      res.statusCode = 200;
      res.setHeader('content-type','text/html; charset=utf-8');
      res.setHeader('x-saw-canary', token);
      res.end(injected);
    } catch (e: unknown) {
      res.statusCode = 500; res.setHeader('content-type','text/plain');
      res.end('error generating page');
    }
  };
}

// Lightweight check utility (wraps detectCanaries) for custom pipelines
export function extractCanariesFromHtml(html: string) {
  return detectCanaries(html); // same pattern
}
