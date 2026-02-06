import { useState, useRef, useCallback, useEffect } from 'react';
import { startAnalysis, connectStream, fetchResult, fetchPatterns, type AgentEvent } from '@/lib/api';
import type { AnalysisResult } from '@/data/mockData';

export interface AgentStatus {
  title: string;
  icon: 'database' | 'search' | 'shield';
  status: string;
  progress: string;
  isComplete: boolean;
}

const INITIAL_AGENTS: AgentStatus[] = [
  { title: 'Repo Health', icon: 'database', status: 'Waiting...', progress: '', isComplete: false },
  { title: 'Research Engine', icon: 'search', status: 'Waiting...', progress: '', isComplete: false },
  { title: 'Risk Scorer', icon: 'shield', status: 'Waiting...', progress: '', isComplete: false },
];

const AGENT_INDEX: Record<string, number> = {
  'repo-health': 0,
  'researcher': 1,
  'risk-scorer': 2,
};

function mapResult(raw: any): AnalysisResult {
  return {
    packageName: raw.packageName ?? '',
    grade: raw.grade ?? 'C',
    gradeRationale: raw.gradeRationale ?? '',
    scores: raw.scores ?? { maintenance: 0, security: 0, community: 0, documentation: 0, stability: 0 },
    findings: (raw.findings ?? []).map((f: any) => ({
      severity: f.severity,
      title: f.title,
      detail: f.detail,
      recommendation: f.recommendation,
    })),
    alternatives: (raw.alternatives ?? []).map((a: any) => ({
      name: a.name,
      migrationDifficulty: a.migrationDifficulty ?? 'moderate',
      maintenance: a.maintenance ?? a.comparison ?? '',
      reason: a.reason ?? '',
    })),
    verdict: raw.verdict ?? '',
    patternInsights: { totalAnalyzed: 0, insights: [] },
  };
}

function mapPatterns(raw: any): { totalAnalyzed: number; insights: string[] } {
  if (!raw || raw.message) {
    return { totalAnalyzed: raw?.totalAnalyzed ?? 0, insights: [] };
  }
  return {
    totalAnalyzed: raw.totalAnalyzed ?? 0,
    insights: (raw.patterns ?? []).map((p: any) => p.insight),
  };
}

export function useAnalysis() {
  const [agents, setAgents] = useState<AgentStatus[]>(INITIAL_AGENTS);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showMainContent, setShowMainContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => { eventSourceRef.current?.close(); };
  }, []);

  const analyze = useCallback(async (query: string) => {
    setIsAnalyzing(true);
    setShowResults(true);
    setShowMainContent(false);
    setResult(null);
    setError(null);
    setAnalysisId(null);
    setAgents(INITIAL_AGENTS.map(a => ({ ...a })));

    eventSourceRef.current?.close();

    try {
      const { analysisId: id } = await startAnalysis(query);
      setAnalysisId(id);

      const es = connectStream(
        id,
        (event: AgentEvent) => {
          const idx = AGENT_INDEX[event.agent];

          if (idx !== undefined) {
            setAgents(prev => {
              const next = [...prev];
              next[idx] = {
                ...next[idx],
                status: event.status === 'complete' ? 'Complete \u2713'
                      : event.status === 'error'    ? 'Error \u2717'
                      : event.status === 'running'  ? 'Analyzing...'
                      : next[idx].status,
                progress: event.progress ?? next[idx].progress,
                isComplete: event.status === 'complete',
              };
              return next;
            });
          }

          if (event.agent === 'system' && event.status === 'complete') {
            es.close();
            fetchResult(id)
              .then(async (raw) => {
                const mapped = mapResult(raw);
                try {
                  const patterns = await fetchPatterns();
                  mapped.patternInsights = mapPatterns(patterns);
                } catch {
                  // patterns are optional
                }
                setResult(mapped);
                setIsAnalyzing(false);
                setTimeout(() => setShowMainContent(true), 300);
              })
              .catch((err) => {
                setError(err.message);
                setIsAnalyzing(false);
              });
          }

          if (event.agent === 'system' && event.status === 'error') {
            es.close();
            setError(event.error ?? event.progress ?? 'Analysis failed');
            setIsAnalyzing(false);
          }
        },
        (err) => {
          if (es.readyState === EventSource.CLOSED) {
            setError('Lost connection to server');
            setIsAnalyzing(false);
          }
        },
      );

      eventSourceRef.current = es;
    } catch (err: any) {
      setError(err.message ?? 'Failed to start analysis');
      setIsAnalyzing(false);
    }
  }, []);

  return { agents, result, analysisId, isAnalyzing, showResults, showMainContent, error, analyze };
}
