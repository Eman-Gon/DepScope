const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { analyses, analysisHistory } = require('../state');
const { attachSSEClient, broadcastSSE, closeSSE } = require('../realtime/sse');
const { parseInput, resolvePackageToGitHub } = require('../lib/input');
const { getPatternInsights } = require('../lib/patterns');
const { runPipeline } = require('../pipeline/runPipeline');
const { checkWriteAccess, commitReport } = require('../services/githubService');
const { generateReport } = require('../services/reportService');

const router = express.Router();

router.post('/api/analyze', async (req, res) => {
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

  resolvePackageToGitHub(parsed)
    .then(resolved => {
      analyses[analysisId].input = resolved.url;
      return runPipeline(analysisId, resolved);
    })
    .catch(err => {
      console.error(`Pipeline error for ${analysisId}:`, err);
      analyses[analysisId].status = 'error';
      analyses[analysisId].error = err.message;
      broadcastSSE(analysisId, { agent: 'system', status: 'error', error: err.message });
      closeSSE(analysisId);
    });

  return res.json({ analysisId });
});

router.get('/api/analyze/:id/stream', (req, res) => {
  attachSSEClient(req.params.id, req, res);
});

router.get('/api/analyze/:id/result', (req, res) => {
  const analysis = analyses[req.params.id];
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
  return res.json(analysis);
});

router.post('/api/analyze/:id/generate-report', (req, res) => {
  const analysis = analyses[req.params.id];
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
  if (analysis.status !== 'complete') {
    return res.status(400).json({ error: 'Analysis is not yet complete' });
  }

  const sections = req.body.sections || undefined;
  const markdown = generateReport(analysis, sections);
  analysis.generatedReport = markdown;

  return res.json({
    markdown,
    packageName: analysis.packageName,
    grade: analysis.grade,
  });
});

router.post('/api/analyze/:id/publish-report', async (req, res) => {
  const analysis = analyses[req.params.id];
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
  if (analysis.status !== 'complete') {
    return res.status(400).json({ error: 'Analysis is not yet complete' });
  }

  const sections = req.body.sections || undefined;
  const markdown = generateReport(analysis, sections);

  const ghMatch = (analysis.input || '').match(/github\.com\/([^\/]+)\/([^\/\s]+)/);
  if (!ghMatch) {
    return res.status(400).json({ error: 'Cannot determine GitHub repository from analysis', markdown });
  }

  const owner = ghMatch[1];
  const repo = ghMatch[2].replace('.git', '');

  try {
    const access = await checkWriteAccess(owner, repo);
    if (!access.canWrite) {
      return res.status(403).json({
        error: 'No write access to this repository',
        reason: access.reason,
        markdown,
      });
    }
  } catch (err) {
    return res.status(403).json({ error: `Cannot verify repository access: ${err.message}`, markdown });
  }

  try {
    const result = await commitReport(owner, repo, markdown);
    return res.json({
      success: true,
      sha: result.sha,
      url: result.url,
      message: `DEPSCOPE.md committed to ${owner}/${repo}`,
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to commit report: ${err.message}`, markdown });
  }
});

router.get('/api/patterns', (_req, res) => {
  const insights = getPatternInsights(analysisHistory);
  if (!insights) {
    return res.json({
      message: 'Need at least 2 analyses for pattern insights',
      totalAnalyzed: analysisHistory.length,
    });
  }
  return res.json(insights);
});

module.exports = router;
