const express = require('express');
const config = require('../config');
const { analysisHistory } = require('../state');
const { GIT_COMMIT, DEPLOY_TIME } = require('../lib/version');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: GIT_COMMIT, deployedAt: DEPLOY_TIME });
});

router.get('/api/composio/status', async (_req, res) => {
  const hasKey = config.has.composio;
  const tools = ['DEPSCOPE_REPO_HEALTH', 'DEPSCOPE_RESEARCH', 'DEPSCOPE_RISK_SYNTHESIS'];
  const recentAnalyses = analysisHistory.slice(-10).map(analysis => ({
    package: analysis.repoHealth?.name,
    grade: analysis.grade,
    orchestration: analysis.orchestration || 'unknown',
  }));

  res.json({
    composioEnabled: hasKey,
    registeredTools: hasKey ? tools : [],
    toolDescriptions: hasKey ? {
      DEPSCOPE_REPO_HEALTH: 'Agent 1: GitHub repo analysis (stars, commits, bus factor)',
      DEPSCOPE_RESEARCH: 'Agent 2: OSV.dev, GitHub Advisory, npm metadata, and Tavily research',
      DEPSCOPE_RISK_SYNTHESIS: 'Agent 3: Gemini AI risk assessment synthesis',
    } : {},
    orchestrationMode: hasKey ? 'composio-parallel' : 'direct-fallback',
    recentAnalyses,
  });
});

router.get('/debug', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    node: process.version,
    env: process.env.NODE_ENV || 'development',
    baseUrl: config.BASE_URL,
    renderExternalUrl: process.env.RENDER_EXTERNAL_URL || 'not set',
    port: config.PORT,
    geminiConfigured: config.has.gemini,
    githubConfigured: config.has.github,
    tavilyConfigured: config.has.tavily,
    configWarnings: config.CONFIG_WARNINGS,
    researchSources: {
      npmRegistry: true,
      osv: true,
      githubAdvisory: true,
      tavily: config.has.tavily,
    },
    requestHost: req.headers.host,
    requestProto: req.headers['x-forwarded-proto'] || req.protocol,
  });
});

module.exports = router;
