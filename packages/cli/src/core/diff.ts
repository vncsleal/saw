import { canonicalize } from './canonicalize.js';

export interface DiffResult { added: string[]; removed: string[]; }
export function diffStringArrays(oldArr: string[], newArr: string[]): DiffResult { const oldSet = new Set(oldArr); const newSet = new Set(newArr); const added = [...newSet].filter(x=>!oldSet.has(x)); const removed = [...oldSet].filter(x=>!newSet.has(x)); return { added, removed }; }
export function diffCanonical(a: unknown, b: unknown): DiffResult { const ca = canonicalize(a); const cb = canonicalize(b); if (ca === cb) return { added: [], removed: [] }; const aLines = ca.split('\n'); const bLines = cb.split('\n'); return diffStringArrays(aLines, bLines); }
