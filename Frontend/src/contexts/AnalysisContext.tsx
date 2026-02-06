import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AnalysisResult } from '@/data/mockData';
import type { AgentStatus } from '@/hooks/useAnalysis';

export interface SavedAnalysis {
  id: string;
  query: string;
  result: AnalysisResult;
  agents: AgentStatus[];
  completedAt: string;
}

interface AnalysisContextValue {
  /** All completed analyses, newest first */
  history: SavedAnalysis[];
  /** The analysis currently being viewed (null = fresh home screen) */
  activeId: string | null;
  /** Save a completed analysis and make it active */
  save: (entry: SavedAnalysis) => void;
  /** Switch to a previously saved analysis */
  setActive: (id: string | null) => void;
  /** Get a saved analysis by id */
  get: (id: string) => SavedAnalysis | undefined;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const save = useCallback((entry: SavedAnalysis) => {
    setHistory(prev => {
      const exists = prev.find(h => h.id === entry.id);
      if (exists) return prev;
      return [entry, ...prev];
    });
    setActiveId(entry.id);
  }, []);

  const setActive = useCallback((id: string | null) => {
    setActiveId(id);
  }, []);

  const get = useCallback((id: string) => {
    return history.find(h => h.id === id);
  }, [history]);

  return (
    <AnalysisContext.Provider value={{ history, activeId, save, setActive, get }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysisContext() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysisContext must be used within AnalysisProvider');
  return ctx;
}
