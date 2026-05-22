const { analyzeRepo } = require('../services/githubService');
const { researchPackage } = require('../services/researchService');
const { synthesizeRiskAssessment } = require('../services/geminiService');
const { getCachedData } = require('../services/demoCache');
const { orchestrate } = require('../services/composioService');
const { analyses, analysisHistory } = require('../state');
const { broadcastSSE, closeSSE } = require('../realtime/sse');
const { withRetry } = require('../lib/retry');

async function runPipeline(analysisId, parsed) {
  const entry = analyses[analysisId];
  const packageName = parsed.packageName;
  const cached = getCachedData(packageName);
  const useComposio = !!process.env.COMPOSIO_API_KEY;

  if (useComposio) {
    try {
      const { repoHealth, research, assessment } = await orchestrate(
        parsed.url,
        packageName,
        (agent, status, message) => broadcastSSE(analysisId, { agent, status, progress: message }),
        cached?.assessment || null
      );

      Object.assign(entry, {
        repoHealth,
        research,
        scores: assessment.scores,
        grade: assessment.grade,
        gradeRationale: assessment.gradeRationale,
        findings: assessment.findings,
        alternatives: assessment.alternatives,
        verdict: assessment.verdict,
        weightedScore: assessment.weightedScore,
        status: 'complete',
        orchestration: 'composio',
      });
      analysisHistory.push(entry);

      broadcastSSE(analysisId, {
        agent: 'system',
        status: 'complete',
        progress: 'Analysis complete (Composio orchestration)',
      });
      closeSSE(analysisId);
      return;
    } catch (composioErr) {
      console.warn(`[Pipeline] Composio orchestration failed, falling back to direct execution: ${composioErr.message}`);
      broadcastSSE(analysisId, {
        agent: 'system',
        status: 'warning',
        progress: 'Composio orchestration failed, using direct execution...',
      });
    }
  }

  broadcastSSE(analysisId, {
    agent: 'repo-health',
    status: 'running',
    progress: 'Fetching repository data from GitHub...',
  });
  broadcastSSE(analysisId, {
    agent: 'researcher',
    status: 'running',
    progress: 'Checking OSV.dev, GitHub advisories, npm metadata, and web context...',
  });

  let repoHealth;
  let research;

  const [repoResult, researchResult] = await Promise.allSettled([
    withRetry(() => analyzeRepo(parsed.url)),
    withRetry(() => researchPackage(packageName), 1, 2000),
  ]);

  if (repoResult.status === 'fulfilled') {
    repoHealth = repoResult.value;
    entry.repoHealth = repoHealth;
    broadcastSSE(analysisId, {
      agent: 'repo-health',
      status: 'complete',
      progress: `Analyzed ${repoHealth.name} — ${repoHealth.stars} stars`,
    });
  } else if (cached) {
    console.warn(`[Pipeline] GitHub failed for ${packageName}, using cached data: ${repoResult.reason?.message}`);
    repoHealth = cached.repoHealth;
    entry.repoHealth = repoHealth;
    broadcastSSE(analysisId, {
      agent: 'repo-health',
      status: 'complete',
      progress: `Using cached data for ${packageName} (GitHub unavailable)`,
    });
  } else {
    broadcastSSE(analysisId, {
      agent: 'repo-health',
      status: 'error',
      progress: repoResult.reason?.message,
    });
    throw repoResult.reason;
  }

  if (researchResult.status === 'fulfilled') {
    research = researchResult.value;
    if (
      cached &&
      (research.cves || []).length === 0 &&
      (research.alternatives || []).length === 0 &&
      research.sentiment?.overall === 'neutral'
    ) {
      console.warn(`[Pipeline] Research returned empty results for ${packageName}, using cached research`);
      research = cached.research;
    }
    entry.research = research;
    broadcastSSE(analysisId, {
      agent: 'researcher',
      status: 'complete',
      progress: `Found ${(research.cves || []).length} advisories, ${(research.alternatives || []).length} alternatives`,
    });
  } else if (cached) {
    console.warn(`[Pipeline] Research failed for ${packageName}, using cached data: ${researchResult.reason?.message}`);
    research = cached.research;
    entry.research = research;
    broadcastSSE(analysisId, {
      agent: 'researcher',
      status: 'complete',
      progress: 'Using cached research data (research sources unavailable)',
    });
  } else {
    broadcastSSE(analysisId, {
      agent: 'researcher',
      status: 'error',
      progress: researchResult.reason?.message,
    });
    throw researchResult.reason;
  }

  broadcastSSE(analysisId, {
    agent: 'risk-scorer',
    status: 'running',
    progress: 'Synthesizing risk assessment with Gemini...',
  });

  try {
    const assessment = await withRetry(() => synthesizeRiskAssessment(repoHealth, research), 1, 2000);
    Object.assign(entry, {
      scores: assessment.scores,
      grade: assessment.grade,
      gradeRationale: assessment.gradeRationale,
      findings: assessment.findings,
      alternatives: assessment.alternatives,
      verdict: assessment.verdict,
      weightedScore: assessment.weightedScore,
      status: 'complete',
      orchestration: 'direct',
    });
    broadcastSSE(analysisId, {
      agent: 'risk-scorer',
      status: 'complete',
      result: { grade: assessment.grade },
    });
  } catch (err) {
    if (cached) {
      console.warn(`[Pipeline] Gemini failed for ${packageName}, using cached assessment: ${err.message}`);
      Object.assign(entry, {
        scores: cached.assessment.scores,
        grade: cached.assessment.grade,
        gradeRationale: cached.assessment.gradeRationale,
        findings: cached.assessment.findings,
        alternatives: cached.assessment.alternatives,
        verdict: cached.assessment.verdict,
        weightedScore: cached.assessment.weightedScore,
        status: 'complete',
        orchestration: 'direct-cached',
      });
      broadcastSSE(analysisId, {
        agent: 'risk-scorer',
        status: 'complete',
        result: { grade: cached.assessment.grade },
      });
    } else {
      broadcastSSE(analysisId, { agent: 'risk-scorer', status: 'error', progress: err.message });
      throw err;
    }
  }

  analysisHistory.push(entry);
  broadcastSSE(analysisId, { agent: 'system', status: 'complete', progress: 'Analysis complete' });
  closeSSE(analysisId);
}

module.exports = { runPipeline };
