import { describe, it, expect } from 'vitest';
import { computeDiff } from '../src/diff.js';
import type { Block } from '../src/schemas.js';

const baseBlock = (id:string, ver:string, updated:string): Block => ({ id, type:'doc', title:id, content:'', version:ver, updated_at:updated });

describe('computeDiff', () => {
  it('detects changed and removed blocks since timestamp', () => {
    const prev = [ baseBlock('block:1','v1','2025-01-01T00:00:00Z'), baseBlock('block:2','v1','2025-01-01T00:00:10Z') ];
    const curr = [ baseBlock('block:1','v2','2025-01-01T00:05:00Z'), baseBlock('block:3','v1','2025-01-01T00:06:00Z') ];
    const diff = computeDiff('2025-01-01T00:01:00Z', curr, prev);
    expect(diff.changed.map(c=>c.id).sort()).toEqual(['block:1','block:3']);
    expect(diff.removed).toEqual(['block:2']);
  });
});
