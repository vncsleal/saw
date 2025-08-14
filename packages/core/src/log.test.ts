import { describe, it, expect } from 'vitest';
import { MemoryLog } from './store.js';

describe('MemoryLog', () => {
  it('stores and retrieves entries', () => {
    const log = new MemoryLog();
    log.write({ ts:new Date().toISOString(), level:'info', event:'test', data:{ a:1 } });
    expect(log.entries().length).toBe(1);
    expect(log.entries()[0].event).toBe('test');
  });
});
