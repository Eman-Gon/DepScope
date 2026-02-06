const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export async function startAnalysis(input: string): Promise<{ analysisId: string }> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface AgentEvent {
  agent: string;
  status: string;
  progress?: string;
  error?: string;
  result?: { grade: string };
}

export function connectStream(
  analysisId: string,
  onEvent: (event: AgentEvent) => void,
  onError: (err: Event) => void,
): EventSource {
  const es = new EventSource(`${API_BASE}/api/analyze/${analysisId}/stream`);
  es.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data));
    } catch {
      // ignore malformed events
    }
  };
  es.onerror = onError;
  return es;
}

export async function fetchResult(analysisId: string) {
  const res = await fetch(`${API_BASE}/api/analyze/${analysisId}/result`);
  if (!res.ok) throw new Error(`Result fetch failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchPatterns() {
  const res = await fetch(`${API_BASE}/api/patterns`);
  if (!res.ok) throw new Error(`Patterns fetch failed: HTTP ${res.status}`);
  return res.json();
}
