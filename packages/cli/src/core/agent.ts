export interface AgentTask { id: string; status: 'pending'|'running'|'done'|'error'; result?: unknown; error?: string; }
export class AgentQueue { private q: AgentTask[] = []; enqueue(t: AgentTask){ this.q.push(t); } list(){ return [...this.q]; } }
