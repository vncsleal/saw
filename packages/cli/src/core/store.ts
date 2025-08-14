export interface InMemoryStore<T> { get(key: string): T | undefined; set(key: string, value: T): void; delete(key: string): void; }
export function createInMemoryStore<T>(): InMemoryStore<T> { const m = new Map<string,T>(); return { get: k=>m.get(k), set: (k,v)=>{ m.set(k,v); }, delete: k=>{ m.delete(k); } }; }
