import { describe, it, expect } from 'vitest';
import { EphemeralCanaryStore, detectCanaries, mapDetectedTokens } from './ephemeral.js';

describe('EphemeralCanaryStore', () => {
  it('issues and looks up tokens within TTL', () => {
    const store = new EphemeralCanaryStore(1000);
    const token = store.issue('req-1');
    expect(store.lookup(token)?.requestId).toBe('req-1');
    expect(store.size()).toBe(1);
  });
  it('expires tokens after TTL', async () => {
    const store = new EphemeralCanaryStore(10); // 10ms
    const token = store.issue('req-2');
    await new Promise(r=>setTimeout(r, 25));
    expect(store.lookup(token)).toBeUndefined();
  });
  it('maps detected tokens including unknown after expiry', async () => {
    const store = new EphemeralCanaryStore(5); // very short TTL
    const token = store.issue('req-map');
    const firstMap = mapDetectedTokens([token], store);
    expect(firstMap.matched.length).toBe(1);
    await new Promise(r=>setTimeout(r, 15));
    const secondMap = mapDetectedTokens([token], store);
    expect(secondMap.matched.length).toBe(0);
    expect(secondMap.unknown).toContain(token);
  });
});

describe('detectCanaries', () => {
  it('classifies single vs multiple', () => {
    const single = detectCanaries('Example c-ABC12345 more');
    expect(single.classification).toBe('single');
    const multi = detectCanaries('A c-AAAA1111 and c-BBBB2222 text');
    expect(multi.classification).toBe('multiple');
    const none = detectCanaries('Nothing here');
    expect(none.classification).toBe('none');
  });
});
