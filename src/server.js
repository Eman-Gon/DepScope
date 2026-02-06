const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const { analyzeRepo } = require('./services/githubService');
const { researchPackage } = require('./services/youService');
const { synthesizeRiskAssessment } = require('./services/geminiService');
const { triggerVoiceAlert, sendSMS } = require('./services/plivoService');
const { getCachedData, hasCachedData } = require('./services/demoCache');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── In-memory stores ───────────────────────────────────────────────────────
const analyses = {};          // analysisId -> result object
const sseClients = {};        // analysisId -> [res, ...]
const analysisHistory = [];   // for pattern aggregation
let alertPhone = null;        // registered phone for voice alerts

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseInput(input) {
  // GitHub URL
  const ghMatch = input.match(/github\.com\/([^\/]+)\/([^\/\s]+)/);
  if (ghMatch) {
    return {
      type: 'github',
      owner: ghMatch[1],
      repo: ghMatch[2].replace('.git', ''),
      url: `https://github.com/${ghMatch[1]}/${ghMatch[2].replace('.git', '')}`,
      packageName: ghMatch[2].replace('.git', ''),
    };
  }
  // owner/repo format (e.g., "lodash/lodash")
  const slashMatch = input.match(/^([^\/\s]+)\/([^\/\s]+)$/);
  if (slashMatch) {
    return {
      type: 'github',
      owner: slashMatch[1],
      repo: slashMatch[2],
      url: `https://github.com/${slashMatch[1]}/${slashMatch[2]}`,
      packageName: slashMatch[2],
    };
  }
  // Bare package name — will try npm registry lookup then GitHub
  return {
    type: 'package',
    packageName: input,
  };
}

async function resolvePackageToGitHub(parsed) {
  if (parsed.type === 'github') return parsed;

  // Try npm registry to find the GitHub repo
  try {
    const response = await axios.get(`https://registry.npmjs.org/${parsed.packageName}`, { timeout: 5000 });
    const repoUrl = response.data.repository?.url || '';
    const ghMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\s.]+)/);
    if (ghMatch) {
      parsed.owner = ghMatch[1];
      parsed.repo = ghMatch[2].replace('.git', '');
      parsed.url = `https://github.com/${parsed.owner}/${parsed.repo}`;
      parsed.type = 'github';
      return parsed;
    }
  } catch (err) {
    console.warn(`npm registry lookup failed for ${parsed.packageName}: ${err.message}`);
  }

  // Fallback: assume owner === packageName (works for lodash, express, etc.)
  parsed.owner = parsed.packageName;
  parsed.repo = parsed.packageName;
  parsed.url = `https://github.com/${parsed.packageName}/${parsed.packageName}`;
  parsed.type = 'github';
  return parsed;
}

function broadcastSSE(analysisId, data) {
  const clients = sseClients[analysisId] || [];
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => res.write(payload));
}

function closeSSE(analysisId) {
  const clients = sseClients[analysisId] || [];
  clients.forEach(res => res.end());
  delete sseClients[analysisId];
}

// ─── Pattern aggregation ─────────────────────────────────────────────────────

function getPatternInsights() {
  if (analysisHistory.length < 2) return null;

  const total = analysisHistory.length;
  const gradeValues = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  const avgGradeNum =
    analysisHistory.reduce((s, a) => s + (gradeValues[a.grade] || 0), 0) / total;
  const avgGradeLetter =
    avgGradeNum >= 3.5 ? 'A' : avgGradeNum >= 2.5 ? 'B' : avgGradeNum >= 1.5 ? 'C' : avgGradeNum >= 0.5 ? 'D' : 'F';

  const singleMaintainerCount = analysisHistory.filter(
    a => a.repoHealth?.busFactorScore === 'critical'
  ).length;

  const withCVEs = analysisHistory.filter(
    a => (a.research?.cves?.length || 0) > 0
  ).length;

  const patterns = [];

  if (singleMaintainerCount > 0) {
    patterns.push({
      insight: `Single-maintainer projects appeared in ${Math.round((singleMaintainerCount / total) * 100)}% of analyzed repos`,
      basedOn: `${singleMaintainerCount} of ${total} repos analyzed`,
      confidence: parseFloat((singleMaintainerCount / total).toFixed(2)),
    });
  }

  if (withCVEs > 0) {
    patterns.push({
      insight: `${Math.round((withCVEs / total) * 100)}% of analyzed packages had at least one known CVE`,
      basedOn: `${withCVEs} of ${total} repos analyzed`,
      confidence: parseFloat((withCVEs / total).toFixed(2)),
    });
  }

  // Most common severity across all findings
  const severityCounts = {};
  analysisHistory.forEach(a => {
    (a.findings || []).forEach(f => {
      severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;
    });
  });
  const topSeverity = Object.entries(severityCounts).sort((a, b) => b[1] - a[1]);

  return {
    totalAnalyzed: total,
    avgGrade: avgGradeLetter,
    patterns,
    mostCommonSeverities: topSeverity.map(([sev, count]) => ({ severity: sev, count })),
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/analyze  — kick off analysis
app.post('/api/analyze', async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'Missing input field' });

  const analysisId = uuidv4();
  const parsed = parseInput(input.trim());

  analyses[analysisId] = {
    id: analysisId,
    input: parsed.url || parsed.packageName,
    packageName: parsed.packageName,
    timestamp: new Date().toISOString(),
    status: 'running',
  };

  // Resolve package name to GitHub URL asynchronously then run pipeline
  resolvePackageToGitHub(parsed).then(resolved => {
    analyses[analysisId].input = resolved.url;
    return runPipeline(analysisId, resolved);
  }).catch(err => {
    console.error(`Pipeline error for ${analysisId}:`, err);
    analyses[analysisId].status = 'error';
    analyses[analysisId].error = err.message;
    broadcastSSE(analysisId, { agent: 'system', status: 'error', error: err.message });
    closeSSE(analysisId);
  });

  return res.json({ analysisId });
});

// GET /api/analyze/:id/stream  — SSE for live status
app.get('/api/analyze/:id/stream', (req, res) => {
  const { id } = req.params;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n'); // flush headers

  if (!sseClients[id]) sseClients[id] = [];
  sseClients[id].push(res);

  req.on('close', () => {
    sseClients[id] = (sseClients[id] || []).filter(c => c !== res);
  });
});

// GET /api/analyze/:id/result  — full result JSON
app.get('/api/analyze/:id/result', (req, res) => {
  const analysis = analyses[req.params.id];
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
  return res.json(analysis);
});

// GET /api/patterns  — aggregated pattern insights
app.get('/api/patterns', (_req, res) => {
  const insights = getPatternInsights();
  if (!insights) {
    return res.json({ message: 'Need at least 2 analyses for pattern insights', totalAnalyzed: analysisHistory.length });
  }
  return res.json(insights);
});

// POST /api/alert/configure  — register phone for Plivo alerts
app.post('/api/alert/configure', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Missing phone field' });
  alertPhone = phone;
  return res.json({ message: 'Alert phone configured', phone });
});

// ─── Plivo voice endpoints ──────────────────────────────────────────────────

// GET /api/plivo/voice-xml/:analysisId  — returns XML when Plivo connects the call
app.get('/api/plivo/voice-xml/:analysisId', (req, res) => {
  const analysis = analyses[req.params.analysisId];
  if (!analysis) {
    res.type('application/xml');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Speak>Sorry, analysis not found.</Speak></Response>`);
  }

  const pkg = analysis.packageName || 'unknown package';
  const grade = analysis.grade || 'unknown';
  const criticalFindings = (analysis.findings || []).filter(f => f.severity === 'CRITICAL');
  const topFinding = criticalFindings[0];

  let speak = `DepScope alert for ${pkg}. Overall risk grade: ${grade}.`;
  if (topFinding) {
    speak += ` Critical finding: ${topFinding.title}. ${topFinding.detail}. Our recommendation: ${topFinding.recommendation}.`;
    if (criticalFindings.length > 1) {
      speak += ` There are ${criticalFindings.length - 1} additional critical findings.`;
    }
  }
  speak += ' Press 1 to receive the full report via text message. Press 2 to dismiss.';

  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="Polly.Matthew" language="en-US">${speak}</Speak>
  <GetDigits action="${config.BASE_URL}/api/plivo/handle-input/${req.params.analysisId}"
             method="POST" timeout="10" numDigits="1">
    <Speak>Please press 1 or 2.</Speak>
  </GetDigits>
</Response>`);
});

// POST /api/plivo/handle-input/:analysisId  — DTMF handler
app.post('/api/plivo/handle-input/:analysisId', (req, res) => {
  const digits = req.body.Digits;
  res.type('application/xml');

  if (digits === '1') {
    const reportUrl = `${config.BASE_URL}/api/analyze/${req.params.analysisId}/result`;
    // Send SMS with report link
    if (alertPhone) {
      sendSMS(alertPhone, `DepScope Report: ${reportUrl}`).catch(err =>
        console.error('[Plivo] SMS follow-up failed:', err.message)
      );
    }
    console.log(`[Plivo] User pressed 1 — sending report link for ${req.params.analysisId}`);
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Speak>Report link sent to your phone. Goodbye.</Speak></Response>`);
  }
  return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Speak>Dismissed. Goodbye.</Speak></Response>`);
});

// ─── Analysis pipeline ──────────────────────────────────────────────────────

async function withRetry(fn, retries = 2, delayMs = 1000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`Retry ${i + 1}/${retries}: ${err.message}`);
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
}

async function runPipeline(analysisId, parsed) {
  const entry = analyses[analysisId];
  const packageName = parsed.packageName;

  // Check for cached demo data as fallback
  const cached = getCachedData(packageName);

  // ── Agent 1: Repo Health ──
  broadcastSSE(analysisId, { agent: 'repo-health', status: 'running', progress: 'Fetching repository data from GitHub...' });

  let repoHealth;
  try {
    repoHealth = await withRetry(() => analyzeRepo(parsed.url));
    entry.repoHealth = repoHealth;
    broadcastSSE(analysisId, { agent: 'repo-health', status: 'complete', progress: `Analyzed ${repoHealth.name} — ${repoHealth.stars} stars` });
  } catch (err) {
    if (cached) {
      console.warn(`[Pipeline] GitHub failed for ${packageName}, using cached data: ${err.message}`);
      repoHealth = cached.repoHealth;
      entry.repoHealth = repoHealth;
      broadcastSSE(analysisId, { agent: 'repo-health', status: 'complete', progress: `Using cached data for ${packageName} (GitHub unavailable)` });
    } else {
      broadcastSSE(analysisId, { agent: 'repo-health', status: 'error', progress: err.message });
      throw err;
    }
  }

  // ── Agent 2: External Research (runs in parallel start) ──
  broadcastSSE(analysisId, { agent: 'researcher', status: 'running', progress: 'Searching CVE databases and community forums...' });

  let research;
  try {
    research = await withRetry(() => researchPackage(repoHealth.name), 1, 2000);
    // If research returned empty results and we have cached data, use it
    if (cached && research.cves.length === 0 && research.alternatives.length === 0 && 
        research.sentiment.overall === 'neutral') {
      console.warn(`[Pipeline] You.com returned empty results for ${packageName}, using cached research`);
      research = cached.research;
    }
    entry.research = research;
    broadcastSSE(analysisId, {
      agent: 'researcher',
      status: 'complete',
      progress: `Found ${research.cves.length} CVEs, ${research.alternatives.length} alternatives`,
    });
  } catch (err) {
    if (cached) {
      console.warn(`[Pipeline] Research failed for ${packageName}, using cached data: ${err.message}`);
      research = cached.research;
      entry.research = research;
      broadcastSSE(analysisId, { agent: 'researcher', status: 'complete', progress: `Using cached research data (You.com unavailable)` });
    } else {
      broadcastSSE(analysisId, { agent: 'researcher', status: 'error', progress: err.message });
      throw err;
    }
  }

  // ── Agent 3: Risk Synthesis ──
  broadcastSSE(analysisId, { agent: 'risk-scorer', status: 'running', progress: 'Synthesizing risk assessment with Gemini...' });

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
    });
    broadcastSSE(analysisId, { agent: 'risk-scorer', status: 'complete', result: { grade: assessment.grade } });
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
      });
      broadcastSSE(analysisId, { agent: 'risk-scorer', status: 'complete', result: { grade: cached.assessment.grade } });
    } else {
      broadcastSSE(analysisId, { agent: 'risk-scorer', status: 'error', progress: err.message });
      throw err;
    }
  }

  // Store for patterns
  analysisHistory.push(entry);

  // Check for critical findings → voice alert
  const criticals = (entry.findings || []).filter(f => f.severity === 'CRITICAL');
  if (criticals.length > 0 && alertPhone) {
    broadcastSSE(analysisId, { agent: 'system', status: 'alert', progress: `CRITICAL findings detected — triggering voice alert to ${alertPhone}` });
    triggerVoiceAlert(alertPhone, analysisId).catch(err =>
      console.error(`[Alert] Voice alert failed: ${err.message}`)
    );
  }

  // Done
  broadcastSSE(analysisId, { agent: 'system', status: 'complete', progress: 'Analysis complete' });
  closeSSE(analysisId);
}

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ service: 'DepScope API', status: 'ok' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`DepScope API running on port ${config.PORT}`);
  console.log(`Base URL: ${config.BASE_URL}`);
});

module.exports = app;