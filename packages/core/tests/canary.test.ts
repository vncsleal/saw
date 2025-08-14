import { describe, it, expect } from 'vitest';
import { generateStaticCanary, enrichBlocksWithCanaries } from '../src/canary.js';
import { Block } from '../src/schemas.js';

describe('static canary', () => {
  it('stable for same id/version/secret', () => {
    const a = generateStaticCanary({ secret:'s1', id:'block:x', version:'v1' });
    const b = generateStaticCanary({ secret:'s1', id:'block:x', version:'v1' });
    expect(a).toEqual(b);
  });
  it('changes when version changes', () => {
    const a = generateStaticCanary({ secret:'s1', id:'block:x', version:'v1' });
    const b = generateStaticCanary({ secret:'s1', id:'block:x', version:'v2' });
    expect(a).not.toEqual(b);
  });
  it('enriches blocks with canaries', () => {
  const blocks: Block[] = [{ id:'block:1', type:'doc', title:'T', content:'', version:'v1', updated_at:'2025-01-01T00:00:00Z' } as Block];
  const enriched = enrichBlocksWithCanaries(blocks, 'sec');
    expect(enriched[0].canary).toBeDefined();
  });
});
