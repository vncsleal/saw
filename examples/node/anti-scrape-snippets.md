# Anti-Scrape Example Snippets (Phase 2 Draft)

## Deferred Paragraph Loader
```html
<p data-saw-frag="p1" hidden>Large body text chunk 1...</p>
<script>
  for (const el of document.querySelectorAll('[data-saw-frag]')) {
    // Reveal after a small randomized delay to defeat naive static scrapers
    setTimeout(()=>{ el.hidden = false; }, 50 + Math.random()*150);
  }
</script>
```

## Hidden Comment Canary
```html
<!-- CANARY:c-PLACEHOLDER -->
```
(Replace `PLACEHOLDER` with emitted canary token.)

## Fragmentation Utility (Pseudo-code)
```js
function fragmentText(content, size=400){
  const out=[]; let i=0; while(i<content.length){ out.push(content.slice(i,i+size)); i+=size; }
  return out;
}
```

These raise cost for bulk scraping while preserving accessibility (content still in DOM promptly).
