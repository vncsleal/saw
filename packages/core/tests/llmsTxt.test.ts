import { describe, it, expect } from 'vitest';
import { generateLlmsTxt } from '../src/llmsTxt.js';

describe('generateLlmsTxt', () => {
  it('produces expected header lines', () => {
    const txt = generateLlmsTxt({ site:'ex.com', feedUrl:'https://ex.com/api/saw/feed', publicKeyFingerprint:'ed25519:abcd1234', publicKey:'BASE64==' });
    expect(txt).toContain('SAW-Version: 1.0');
    expect(txt).toContain('AI-Feed-URL: https://ex.com/api/saw/feed');
    expect(txt).toMatch(/Updated-At:/);
  });
});
