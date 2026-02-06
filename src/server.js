const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const { analyzeRepo } = require('./services/githubService');
const { researchPackage } = require('./services/youService');
const { synthesizeRiskAssessment } = require('./services/geminiService');

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

async function parseInput(input) {
  // GitHub URL
  const ghMatch = input.match(/github\.com\/([^\/]+)\/([^\/\s]+)/);
  if (ghMatch) {
    return {
      type: 'github',
      url: `https://github.com/${ghMatch[1]}/${ghMatch[2].replace('.git', '')}`,
      packageName: ghMatch[2].replace('.git', ''),
    };
  }
  // Bare package name — look up repo URL from npm registry
  try {
    const { data } = await require('axios').get(`https://registry.npmjs.org/${encodeURIComponent(input)}`);
    const repoUrl = data.repository?.url || '';
    const npmGhMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\s\.]+)/);
    if (npmGhMatch) {
      return {
        type: 'package',
        url: `https://github.com/${npmGhMatch[1]}/${npmGhMatch[2]}`,
        packageName: input,
      };
    }
  } catch (e) {
    console.warn(`npm registry lookup failed for "${input}", falling back to naive URL`);
  }
  // Fallback: guess owner == package name (works for lodash, express, etc.)
  return {
    type: 'package',
    url: `https://github.com/${input}/${input}`,
    packageName: input,
  };
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
  const parsed = await parseInput(input.trim());

  analyses[analysisId] = {
    id: analysisId,
    input: parsed.url,
    packageName: parsed.packageName,
    timestamp: new Date().toISOString(),
    status: 'running',
  };

  // Fire-and-forget the pipeline
  runPipeline(analysisId, parsed).catch(err => {
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
    // In production, send SMS via Plivo here
    console.log(`[Plivo] User pressed 1 — would SMS report link for ${req.params.analysisId}`);
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Speak>Report link sent to your phone. Goodbye.</Speak></Response>`);
  }
  return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Speak>Dismissed. Goodbye.</Speak></Response>`);
});

// ─── Analysis pipeline ──────────────────────────────────────────────────────

async function runPipeline(analysisId, parsed) {
  const entry = analyses[analysisId];

  // Agent 1 & Agent 2 run in parallel
  broadcastSSE(analysisId, { agent: 'repo-health', status: 'running', progress: 'Fetching repository data from GitHub...' });
  broadcastSSE(analysisId, { agent: 'researcher', status: 'running', progress: 'Searching CVE databases and community forums...' });

  const repoHealthPromise = analyzeRepo(parsed.url)
    .then(repoHealth => {
      entry.repoHealth = repoHealth;
      broadcastSSE(analysisId, { agent: 'repo-health', status: 'complete', progress: `Analyzed ${repoHealth.name} — ${repoHealth.stars} stars` });
      return repoHealth;
    })
    .catch(err => {
      broadcastSSE(analysisId, { agent: 'repo-health', status: 'error', progress: err.message });
      throw err;
    });

  const researchPromise = researchPackage(parsed.packageName)
    .then(research => {
      entry.research = research;
      broadcastSSE(analysisId, {
        agent: 'researcher',
        status: 'complete',
        progress: `Found ${research.cves.length} CVEs, ${research.alternatives.length} alternatives`,
      });
      return research;
    })
    .catch(err => {
      broadcastSSE(analysisId, { agent: 'researcher', status: 'error', progress: err.message });
      throw err;
    });

  const [repoHealth, research] = await Promise.all([repoHealthPromise, researchPromise]);

  // Agent 3: Risk Synthesis
  broadcastSSE(analysisId, { agent: 'risk-scorer', status: 'running', progress: 'Synthesizing risk assessment with Gemini...' });

  try {
    const assessment = await synthesizeRiskAssessment(repoHealth, research);
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
    broadcastSSE(analysisId, { agent: 'risk-scorer', status: 'error', progress: err.message });
    throw err;
  }

  // Store for patterns
  analysisHistory.push(entry);

  // Check for critical findings → voice alert
  const criticals = (entry.findings || []).filter(f => f.severity === 'CRITICAL');
  if (criticals.length > 0 && alertPhone) {
    broadcastSSE(analysisId, { agent: 'system', status: 'alert', progress: `CRITICAL findings detected — triggering voice alert to ${alertPhone}` });
    // Plivo call would be triggered here in production
    console.log(`[Alert] Would call ${alertPhone} for analysis ${analysisId}`);
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