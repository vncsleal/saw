// Simple anti-scrape Level 1–2 examples: deferred loader & text fragmentation

export function deferredParagraph(html, delayMs = 300) {
  return `<div data-saw-deferred style="min-height:1em" data-delay="${delayMs}"></div><template data-saw-frag>${html}</template>`;
}

export function fragmentationUtility(text) {
  // Split into randomized chunks of 20-40 chars to frustrate naive linear scraping
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const span = 20 + Math.floor(Math.random()*20);
    chunks.push(text.slice(i, i+span));
    i += span;
  }
  return chunks.map(c=>`<span data-saw-frag>${c}</span>`).join('');
}

export const clientBootstrap = `(()=>{const swap=()=>{document.querySelectorAll('[data-saw-deferred]').forEach(el=>{const t=el.nextElementSibling; if(t&&t.tagName==='TEMPLATE'){const d=parseInt(el.getAttribute('data-delay')||'0',10);setTimeout(()=>{el.replaceWith(t.innerHTML);},d);}});}; if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',swap);}else{swap();}})();`;
