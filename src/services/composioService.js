/**
 * Composio Orchestration Service
 * 
 * Registers 3 agent tools with Composio and orchestrates them:
 *   1. DEPSCOPE_REPO_HEALTH   — GitHub repo analysis (Agent 1)
 *   2. DEPSCOPE_RESEARCH      — You.com CVE/sentiment research (Agent 2)
 *   3. DEPSCOPE_RISK_SYNTHESIS — Gemini risk assessment (Agent 3)
 */

const { Composio } = require('@composio/core');
const z = require('zod');
const { analyzeRepo } = require('./githubService');
const { researchPackage } = require('./youService');
const { synthesizeRiskAssessment } = require('./geminiService');

let composio = null;
let toolsRegistered = false;

function getComposio() {
  if (!composio) {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) throw new Error('COMPOSIO_API_KEY not set');
    composio = new Composio({ apiKey });
  }
  return composio;
}

async function registerAgentTools() {
  if (toolsRegistered) return;
  const c = getComposio();

  // Agent 1: Repo Health Analyzer
  await c.tools.createCustomTool({
    name: 'DepScope Repo Health Analyzer',
    description: 'Analyzes a GitHub repository for maintenance health, bus factor, commit frequency, and community signals.',
    slug: 'DEPSCOPE_REPO_HEALTH',
    inputParams: z.object({
      repoUrl: z.string().describe('GitHub repository URL (e.g. https://github.com/lodash/lodash)'),
    }),
    execute: async (input) => {
      const result = await analyzeRepo(input.repoUrl);
      return { data: result };
    },
  });

  // Agent 2: External Researcher
  await c.tools.createCustomTool({
    name: 'DepScope External Researcher',
    description: 'Researches a package using You.com API for CVEs, community sentiment, and alternative libraries.',
    slug: 'DEPSCOPE_RESEARCH',
    inputParams: z.object({
      packageName: z.string().describe('npm package name (e.g. lodash)'),
    }),
    execute: async (input) => {
      const result = await researchPackage(input.packageName);
      return { data: result };
    },
  });

  // Agent 3: Risk Synthesizer
  await c.tools.createCustomTool({
    name: 'DepScope Risk Synthesizer',
    description: 'Uses Gemini AI to synthesize a risk assessment from repo health and research data, producing a letter grade and findings.',
    slug: 'DEPSCOPE_RISK_SYNTHESIS',
    inputParams: z.object({
      repoHealthJson: z.string().describe('JSON-stringified repository health data from Agent 1'),
      researchJson: z.string().describe('JSON-stringified research data from Agent 2'),
    }),
    execute: async (input) => {
      const repoHealth = JSON.parse(input.repoHealthJson);
      const research = JSON.parse(input.researchJson);
      const result = await synthesizeRiskAssessment(repoHealth, research);
      return { data: result };
    },
  });

  toolsRegistered = true;
  console.log('[Composio] 3 agent tools registered');
}

/**
 * Run the full analysis pipeline via Composio orchestration.
 * Agents 1 & 2 run in parallel, then Agent 3 synthesizes.
 * 
 * @param {string} repoUrl - GitHub URL
 * @param {string} packageName - Package name
 * @param {function} onProgress - Callback for progress updates: (agent, status, message)
 * @param {Object|null} cachedAssessment - Optional cached assessment for Agent 3 fallback
 * @returns {Object} { repoHealth, research, assessment }
 */
async function orchestrate(repoUrl, packageName, onProgress = () => {}, cachedAssessment = null) {
  await registerAgentTools();
  const c = getComposio();

  // Phase 1: Execute Agents 1 & 2 in parallel via Composio
  onProgress('repo-health', 'running', 'Fetching repository data from GitHub...');
  onProgress('researcher', 'running', 'Searching CVE databases and community forums...');

  const [repoResult, researchResult] = await Promise.allSettled([
    c.tools.execute('DEPSCOPE_REPO_HEALTH', {
      arguments: { repoUrl },
    }),
    c.tools.execute('DEPSCOPE_RESEARCH', {
      arguments: { packageName },
    }),
  ]);

  // Extract Agent 1 result
  if (repoResult.status !== 'fulfilled' || !repoResult.value?.data) {
    const err = repoResult.reason || new Error('Repo health analysis returned no data');
    onProgress('repo-health', 'error', err.message);
    throw err;
  }
  const repoHealth = repoResult.value.data;
  onProgress('repo-health', 'complete', `Analyzed ${repoHealth.name} — ${repoHealth.stars} stars`);

  // Extract Agent 2 result
  if (researchResult.status !== 'fulfilled' || !researchResult.value?.data) {
    const err = researchResult.reason || new Error('Research returned no data');
    onProgress('researcher', 'error', err.message);
    throw err;
  }
  const research = researchResult.value.data;
  onProgress('researcher', 'complete', `Found ${research.cves.length} CVEs, ${research.alternatives.length} alternatives`);

  // Phase 2: Execute Agent 3 (depends on Agents 1 & 2)
  onProgress('risk-scorer', 'running', 'Synthesizing risk assessment with Gemini...');

  let assessment;
  try {
    const synthResult = await c.tools.execute('DEPSCOPE_RISK_SYNTHESIS', {
      arguments: { repoHealthJson: JSON.stringify(repoHealth), researchJson: JSON.stringify(research) },
    });

    if (!synthResult?.data) {
      throw new Error('Risk synthesis returned no data');
    }
    assessment = synthResult.data;
  } catch (synthErr) {
    if (cachedAssessment) {
      console.warn(`[Composio] Agent 3 failed, using cached assessment: ${synthErr.message}`);
      assessment = cachedAssessment;
    } else {
      throw synthErr;
    }
  }
  onProgress('risk-scorer', 'complete', `Grade: ${assessment.grade}`);

  return { repoHealth, research, assessment };
}

module.exports = { registerAgentTools, orchestrate, getComposio };
