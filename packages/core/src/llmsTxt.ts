export interface LlmsTxtOptions {
  site: string;
  feedUrl: string;
  publicKeyFingerprint: string; // ed25519:xxxx (first 8 hex bytes)
  publicKey: string; // base64
  updatedAt?: string;
}

export function generateLlmsTxt(opts: LlmsTxtOptions): string {
  const updated = opts.updatedAt || new Date().toISOString();
  return [
    '# SAW llms.txt',
    'SAW-Version: 1.0',
    `AI-Feed-URL: ${opts.feedUrl}`,
    `Public-Key: ${opts.publicKeyFingerprint}`,
    `Updated-At: ${updated}`
  ].join('\n') + '\n';
}
