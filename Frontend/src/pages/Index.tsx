import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import SearchInput from '@/components/SearchInput';
import AgentStatusCard from '@/components/AgentStatusCard';
import GradeDisplay from '@/components/GradeDisplay';
import RadarChartComponent from '@/components/RadarChart';
import FindingsList from '@/components/FindingsList';
import AlternativesTable from '@/components/AlternativesTable';
import PatternInsights from '@/components/PatternInsights';
import VerdictBox from '@/components/VerdictBox';
import { mockAnalysisResult } from '@/data/mockData';

const Index = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [agentsComplete, setAgentsComplete] = useState([false, false, false]);
  const [showMainContent, setShowMainContent] = useState(false);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setShowResults(true);
    setAgentsComplete([false, false, false]);
    setShowMainContent(false);

    // Simulate agent completion with staggered timing
    setTimeout(() => setAgentsComplete([true, false, false]), 800);
    setTimeout(() => setAgentsComplete([true, true, false]), 1400);
    setTimeout(() => {
      setAgentsComplete([true, true, true]);
      setIsAnalyzing(false);
    }, 2000);
    setTimeout(() => setShowMainContent(true), 2300);
  };

  const agents = [
    {
      title: 'Repo Health',
      icon: 'database' as const,
      status: agentsComplete[0] ? 'Complete ✓' : 'Analyzing...',
      progress: 'Analyzed 356 commits',
    },
    {
      title: 'Research Engine',
      icon: 'search' as const,
      status: agentsComplete[1] ? 'Complete ✓' : 'Searching...',
      progress: 'Found 1 CVE, 3 alternatives',
    },
    {
      title: 'Risk Scorer',
      icon: 'shield' as const,
      status: agentsComplete[2] ? 'Complete ✓' : 'Scoring...',
      progress: 'Generated risk assessment',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-12">
        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Analyze Dependency Risk
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Get instant insights into package health, security vulnerabilities, and maintenance status.
          </p>
          <SearchInput onAnalyze={handleAnalyze} isLoading={isAnalyzing} />
        </motion.div>

        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              {/* Agent Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {agents.map((agent, index) => (
                  <AgentStatusCard
                    key={agent.title}
                    {...agent}
                    isComplete={agentsComplete[index]}
                    delay={index * 0.15}
                  />
                ))}
              </div>

              {/* Main Content - Two Columns */}
              <AnimatePresence>
                {showMainContent && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-12"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Left Column - Grade & Chart */}
                      <div className="space-y-8 p-6 rounded-xl bg-card border border-border">
                        <GradeDisplay 
                          grade={mockAnalysisResult.grade} 
                          rationale={mockAnalysisResult.gradeRationale} 
                        />
                        <RadarChartComponent scores={mockAnalysisResult.scores} />
                      </div>

                      {/* Right Column - Findings */}
                      <div className="p-6 rounded-xl bg-card border border-border">
                        <FindingsList findings={mockAnalysisResult.findings} />
                      </div>
                    </div>

                    {/* Alternatives Table */}
                    <AlternativesTable alternatives={mockAnalysisResult.alternatives} />

                    {/* Pattern Insights */}
                    <PatternInsights 
                      totalAnalyzed={mockAnalysisResult.patternInsights.totalAnalyzed}
                      insights={mockAnalysisResult.patternInsights.insights}
                    />

                    {/* Verdict */}
                    <VerdictBox 
                      verdict={mockAnalysisResult.verdict} 
                      grade={mockAnalysisResult.grade}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;
