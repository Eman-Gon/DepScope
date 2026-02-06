const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const { analyzeRepo, checkWriteAccess, commitReport } = require('./services/githubService');
const { generateReport } = require('./services/reportService');
const { researchPackage } = require('./services/youService');
const { synthesizeRiskAssessment } = require('./services/geminiService');
const { triggerVoiceAlert, sendSMS } = require('./services/plivoService');
const { getCachedData, hasCachedData } = require('./services/demoCache');
const { orchestrate, registerAgentTools } = require('./services/composioService');
const {
  addToWatchlist, removeFromWatchlist, getWatchlist, getScanHistory,
  runScanCycle, startCron, stopCron, getCronStatus,
} = require('./services/watchlistService');
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

function getBaseUrl(req) {
  if (config.BASE_URL && config.BASE_URL !== `http://localhost:${config.PORT}`) {
    return config.BASE_URL;
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

async function parseInput(input) {
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

  // Most common risk factor categories
  const riskCategoryCounts = {};
  analysisHistory.forEach(a => {
    (a.findings || []).forEach(f => {
      const key = `${f.category}: ${f.title}`;
      riskCategoryCounts[key] = (riskCategoryCounts[key] || 0) + 1;
    });
  });
  const riskFactors = Object.entries(riskCategoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([factor, count]) => ({ factor, count }));

  // Safest score categories on average
  const categoryTotals = { maintenance: 0, security: 0, community: 0, documentation: 0, stability: 0 };
  analysisHistory.forEach(a => {
    if (a.scores) {
      Object.keys(categoryTotals).forEach(cat => {
        categoryTotals[cat] += a.scores[cat] || 0;
      });
    }
  });
  const safestCategories = Object.entries(categoryTotals)
    .map(([category, total]) => ({ category, avgScore: Math.round(total / total ? total / total : 0) }))
    .sort((a, b) => b.avgScore - a.avgScore);
  safestCategories.forEach(c => { c.avgScore = Math.round(categoryTotals[c.category] / total); });

  return {
    totalAnalyzed: total,
    avgGrade: avgGradeLetter,
    patterns,
    mostCommonSeverities: topSeverity.map(([sev, count]) => ({ severity: sev, count })),
    riskFactors,
    safestCategories,
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

// POST /api/analyze/:id/generate-report  — generate DEPSCOPE.md content
app.post('/api/analyze/:id/generate-report', (req, res) => {
  const analysis = analyses[req.params.id];
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
  if (analysis.status !== 'complete') {
    return res.status(400).json({ error: 'Analysis is not yet complete' });
  }

  const markdown = generateReport(analysis);
  analysis.generatedReport = markdown;

  return res.json({
    markdown,
    packageName: analysis.packageName,
    grade: analysis.grade,
  });
});

// POST /api/analyze/:id/publish-report  — commit DEPSCOPE.md to GitHub repo
app.post('/api/analyze/:id/publish-report', async (req, res) => {
  const analysis = analyses[req.params.id];
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
  if (analysis.status !== 'complete') {
    return res.status(400).json({ error: 'Analysis is not yet complete' });
  }

  const markdown = analysis.generatedReport || generateReport(analysis);

  const ghMatch = (analysis.input || '').match(/github\.com\/([^\/]+)\/([^\/\s]+)/);
  if (!ghMatch) {
    return res.status(400).json({ error: 'Cannot determine GitHub repository from analysis', markdown });
  }
  const owner = ghMatch[1];
  const repo = ghMatch[2].replace('.git', '');

  try {
    const access = await checkWriteAccess(owner, repo);
    if (!access.canWrite) {
      return res.status(403).json({ error: 'No write access to this repository', reason: access.reason, markdown });
    }
  } catch (err) {
    return res.status(403).json({ error: `Cannot verify repository access: ${err.message}`, markdown });
  }

  try {
    const result = await commitReport(owner, repo, markdown);
    return res.json({ success: true, sha: result.sha, url: result.url, message: `DEPSCOPE.md committed to ${owner}/${repo}` });
  } catch (err) {
    return res.status(500).json({ error: `Failed to commit report: ${err.message}`, markdown });
  }
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

// POST /api/plivo/test-call — trigger a test call to a phone number
app.post('/api/plivo/test-call', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });
    const { makeCall } = require('./services/plivoService');
    const base = getBaseUrl(req);
    const answerUrl = `${base}/api/plivo/test-voice`;
    const result = await makeCall(phone, answerUrl);
    res.json({ success: true, callUuid: result, answerUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/plivo/test-voice — test voice XML for Plivo integration testing
app.get('/api/plivo/test-voice', (req, res) => {
  const base = getBaseUrl(req);
  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="Polly.Matthew" language="en-US">This is a test call from DepScope dependency monitor. DepScope Alert: 2 monitored packages have received a failing grade. lodash, critical vulnerability: prototype pollution in versions before 4.17.21. event-stream, critical: supply chain attack detected in version 3.3.6. Immediate review is recommended. Press 1 to receive the full report by text. Press 2 to dismiss.</Speak>
  <GetDigits action="${base}/api/plivo/test-input"
             method="POST" timeout="10" numDigits="1">
    <Speak>Please press 1 or 2.</Speak>
  </GetDigits>
</Response>`);
});

// POST /api/plivo/test-input — test DTMF handler
app.post('/api/plivo/test-input', (req, res) => {
  const digits = req.body.Digits;
  res.type('application/xml');
  if (digits === '1') {
    if (alertPhone) {
      sendSMS(alertPhone, 'DepScope Test Report: lodash (Grade F) - prototype pollution CVE. event-stream (Grade F) - supply chain attack. Review at your dashboard.').catch(() => {});
    }
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Speak>Test report sent to your phone. Goodbye.</Speak></Response>`);
  }
  return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Speak>Dismissed. Plivo test complete. Goodbye.</Speak></Response>`);
});

// ─── Plivo voice endpoints ──────────────────────────────────────────────────

// GET /api/plivo/voice-xml/:analysisId  — returns XML when Plivo connects the call
app.get('/api/plivo/voice-xml/:analysisId', (req, res) => {
  const base = getBaseUrl(req);
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
  <GetDigits action="${base}/api/plivo/handle-input/${req.params.analysisId}"
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
    const reportUrl = `${getBaseUrl(req)}/api/analyze/${req.params.analysisId}/result`;
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
  const cached = getCachedData(packageName);
  const useComposio = !!process.env.COMPOSIO_API_KEY;

  // ── Try Composio orchestration first ──
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

      // Check for critical findings → voice alert
      const criticals = (entry.findings || []).filter(f => f.severity === 'CRITICAL');
      if (criticals.length > 0 && alertPhone) {
        broadcastSSE(analysisId, { agent: 'system', status: 'alert', progress: `CRITICAL findings detected — triggering voice alert to ${alertPhone}` });
        triggerVoiceAlert(alertPhone, analysisId).catch(err =>
          console.error(`[Alert] Voice alert failed: ${err.message}`)
        );
      }

      broadcastSSE(analysisId, { agent: 'system', status: 'complete', progress: 'Analysis complete (Composio orchestration)' });
      closeSSE(analysisId);
      return;
    } catch (composioErr) {
      console.warn(`[Pipeline] Composio orchestration failed, falling back to direct execution: ${composioErr.message}`);
      broadcastSSE(analysisId, { agent: 'system', status: 'warning', progress: 'Composio orchestration failed, using direct execution...' });
    }
  }

  // ── Fallback: Direct agent execution ──

  // ── Agents 1 & 2 run in parallel ──
  broadcastSSE(analysisId, { agent: 'repo-health', status: 'running', progress: 'Fetching repository data from GitHub...' });
  broadcastSSE(analysisId, { agent: 'researcher', status: 'running', progress: 'Searching CVE databases and community forums...' });

  let repoHealth;
  let research;

  // Run GitHub analysis and You.com research in parallel
  const [repoResult, researchResult] = await Promise.allSettled([
    withRetry(() => analyzeRepo(parsed.url)),
    withRetry(() => researchPackage(packageName), 1, 2000),
  ]);

  // Process Agent 1 result
  if (repoResult.status === 'fulfilled') {
    repoHealth = repoResult.value;
    entry.repoHealth = repoHealth;
    broadcastSSE(analysisId, { agent: 'repo-health', status: 'complete', progress: `Analyzed ${repoHealth.name} — ${repoHealth.stars} stars` });
  } else if (cached) {
    console.warn(`[Pipeline] GitHub failed for ${packageName}, using cached data: ${repoResult.reason?.message}`);
    repoHealth = cached.repoHealth;
    entry.repoHealth = repoHealth;
    broadcastSSE(analysisId, { agent: 'repo-health', status: 'complete', progress: `Using cached data for ${packageName} (GitHub unavailable)` });
  } else {
    broadcastSSE(analysisId, { agent: 'repo-health', status: 'error', progress: repoResult.reason?.message });
    throw repoResult.reason;
  }

  // Process Agent 2 result
  if (researchResult.status === 'fulfilled') {
    research = researchResult.value;
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
  } else if (cached) {
    console.warn(`[Pipeline] Research failed for ${packageName}, using cached data: ${researchResult.reason?.message}`);
    research = cached.research;
    entry.research = research;
    broadcastSSE(analysisId, { agent: 'researcher', status: 'complete', progress: `Using cached research data (You.com unavailable)` });
  } else {
    broadcastSSE(analysisId, { agent: 'researcher', status: 'error', progress: researchResult.reason?.message });
    throw researchResult.reason;
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
      orchestration: 'direct',
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
        orchestration: 'direct-cached',
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

// ─── Watchlist API ───────────────────────────────────────────────────────────

// GET /api/watchlist — list all watched repos
app.get('/api/watchlist', (_req, res) => {
  res.json({ watchlist: getWatchlist(), cron: getCronStatus() });
});

// POST /api/watchlist — add a repo to the watchlist
app.post('/api/watchlist', async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'Missing input field' });

  try {
    let parsed = await parseInput(input);
    if (parsed.type === 'package') {
      parsed = await resolvePackageToGitHub(parsed);
      if (!parsed.url) {
        return res.status(400).json({ error: `Could not resolve "${input}" to a GitHub repo` });
      }
    }
    const entry = addToWatchlist(parsed.url, parsed.packageName);
    res.json({ added: entry, watchlistSize: getWatchlist().length });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// DELETE /api/watchlist/:id — remove a repo from the watchlist
app.delete('/api/watchlist/:id', (req, res) => {
  const removed = removeFromWatchlist(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Not found' });
  res.json({ removed: true, watchlistSize: getWatchlist().length });
});

// POST /api/watchlist/scan — trigger an immediate scan cycle
app.post('/api/watchlist/scan', async (_req, res) => {
  if (getWatchlist().length === 0) {
    return res.status(400).json({ error: 'Watchlist is empty' });
  }
  const scan = await runScanCycle(alertPhone);
  res.json(scan);
});

// POST /api/watchlist/cron — start or stop the cron
app.post('/api/watchlist/cron', (req, res) => {
  const { action, intervalMinutes } = req.body;
  if (action === 'start') {
    if (!alertPhone) {
      return res.status(400).json({ error: 'Configure alert phone first via POST /api/alert/configure' });
    }
    const ms = (intervalMinutes || 60) * 60 * 1000;
    startCron(alertPhone, ms);
    res.json({ message: 'Cron started', cron: getCronStatus() });
  } else if (action === 'stop') {
    stopCron();
    res.json({ message: 'Cron stopped', cron: getCronStatus() });
  } else {
    res.status(400).json({ error: 'action must be "start" or "stop"' });
  }
});

// GET /api/watchlist/scans — scan history
app.get('/api/watchlist/scans', (_req, res) => {
  res.json({ scans: getScanHistory() });
});

// GET /api/watchlist/voice-xml/:scanId — Plivo voice XML for watchlist alerts
app.get('/api/watchlist/voice-xml/:scanId', (req, res) => {
  const base = getBaseUrl(req);
  const scans = getScanHistory();
  const scan = scans.find(s => s.id === req.params.scanId);

  res.type('application/xml');
  if (!scan || !scan.alertReport) {
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Speak>Sorry, scan report not found.</Speak></Response>`);
  }

  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="Polly.Matthew" language="en-US">${scan.alertReport.voiceScript}</Speak>
  <GetDigits action="${base}/api/watchlist/handle-input/${scan.id}"
             method="POST" timeout="10" numDigits="1">
    <Speak>Please press 1 or 2.</Speak>
  </GetDigits>
</Response>`);
});

// POST /api/watchlist/handle-input/:scanId — DTMF handler for watchlist alerts
app.post('/api/watchlist/handle-input/:scanId', (req, res) => {
  const digits = req.body.Digits;
  res.type('application/xml');

  if (digits === '1') {
    const scans = getScanHistory();
    const scan = scans.find(s => s.id === req.params.scanId);
    if (scan?.alertReport && alertPhone) {
      sendSMS(alertPhone, scan.alertReport.smsText).catch(err =>
        console.error('[Watchlist] SMS follow-up failed:', err.message)
      );
    }
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Speak>Full report sent to your phone. Goodbye.</Speak></Response>`);
  }
  return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Speak>Dismissed. Goodbye.</Speak></Response>`);
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ service: 'DepScope API', status: 'ok' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// GET /api/composio/status — Show Composio orchestration status for demo
app.get('/api/composio/status', async (_req, res) => {
  const hasKey = !!process.env.COMPOSIO_API_KEY;
  const tools = ['DEPSCOPE_REPO_HEALTH', 'DEPSCOPE_RESEARCH', 'DEPSCOPE_RISK_SYNTHESIS'];
  const recentAnalyses = analysisHistory.slice(-10).map(a => ({
    package: a.repoHealth?.name,
    grade: a.grade,
    orchestration: a.orchestration || 'unknown',
  }));

  res.json({
    composioEnabled: hasKey,
    registeredTools: hasKey ? tools : [],
    toolDescriptions: hasKey ? {
      DEPSCOPE_REPO_HEALTH: 'Agent 1: GitHub repo analysis (stars, commits, bus factor)',
      DEPSCOPE_RESEARCH: 'Agent 2: You.com CVE/sentiment research',
      DEPSCOPE_RISK_SYNTHESIS: 'Agent 3: Gemini AI risk assessment synthesis',
    } : {},
    orchestrationMode: hasKey ? 'composio-parallel' : 'direct-fallback',
    recentAnalyses,
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(config.PORT, async () => {
  console.log(`DepScope API running on port ${config.PORT}`);
  console.log(`Base URL: ${config.BASE_URL}`);
  if (process.env.COMPOSIO_API_KEY) {
    try {
      await registerAgentTools();
      console.log('Composio orchestration: enabled');
    } catch (err) {
      console.warn(`Composio init failed (will use direct execution): ${err.message}`);
    }
  } else {
    console.log('Composio orchestration: disabled (no API key)');
  }
});

module.exports = app;