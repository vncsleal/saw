// In-memory key & block store abstractions (Phase 3 scaffold)
import { ApiKeyRecord } from './auth.js';
import { Block } from './schemas.js';
import { computeDiff, DiffResult } from './diff.js';

export interface KeyStore {
  add(record: ApiKeyRecord): void;
  get(id: string): ApiKeyRecord | undefined;
  list(): ApiKeyRecord[];
}

export class MemoryKeyStore implements KeyStore {
  private map = new Map<string, ApiKeyRecord>();
  add(record: ApiKeyRecord) { this.map.set(record.id, record); }
  get(id: string) { return this.map.get(id); }
  list() { return Array.from(this.map.values()); }
}

export interface BlockStore {
  list(): Block[];
  set(blocks: Block[]): void;
}

export interface VersionedBlockStore extends BlockStore {
  history(): Array<{ ts: string; blocks: Block[] }>;
  snapshotAt(iso: string): Block[];
  diffSince(sinceISO: string): DiffResult;
}

export class MemoryBlockStore implements VersionedBlockStore {
  private blocks: Block[] = [];
  private snapshots: Array<{ ts: string; blocks: Block[] }> = [];

  list() { return this.blocks.slice(); }

  set(blocks: Block[]) {
    this.blocks = blocks.slice();
    const ts = new Date().toISOString();
    this.snapshots.push({ ts, blocks: this.blocks.slice() });
    if (this.snapshots.length > 500) this.snapshots.splice(0, this.snapshots.length - 500); // cap history
  }

  history() { return this.snapshots.slice(); }

  snapshotAt(iso: string): Block[] {
    if (!iso) return [];
    // find the latest snapshot with ts <= iso
    const target = Date.parse(iso);
    if (isNaN(target)) return [];
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      const snap = this.snapshots[i];
      if (Date.parse(snap.ts) <= target) return snap.blocks.slice();
    }
    return [];
  }

  diffSince(sinceISO: string): DiffResult {
    const prev = this.snapshotAt(sinceISO);
    return computeDiff(sinceISO, this.blocks, prev);
  }
}

export interface LogEntry { ts: string; level: string; event: string; data: unknown }
export interface LogAdapter { write(entry: LogEntry): void; entries(): LogEntry[]; }

export class MemoryLog implements LogAdapter {
  private arr: LogEntry[] = [];
  write(entry: LogEntry) { this.arr.push(entry); }
  entries() { return this.arr.slice(); }
}
