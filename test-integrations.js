const axios = require('axios');
const config = require('./src/config');

const OSV_API = 'https://api.osv.dev/v1/querybatch';
const GITHUB_API = 'https://api.github.com';
const NPM_REGISTRY = 'https://registry.npmjs.org';
const TAVILY_API = 'https://api.tavily.com/search';
const COMPOSIO_API = 'https://backend.composio.dev/api/v3/tools';
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';

const args = process.argv.slice(2);
const strict = args.includes('--strict') ||
  String(process.env.INTEGRATION_TEST_STRICT || '').toLowerCase() === 'true' ||
  process.env.INTEGRATION_TEST_STRICT === '1';
const positionalArgs = args.filter(arg => !arg.startsWith('--'));

const packageName = process.env.TEST_PACKAGE || positionalArgs[0] || 'lodash';
const repoUrl = process.env.TEST_REPO || positionalArgs[1] || 'https://github.com/lodash/lodash';
const timeout = parseInt(process.env.INTEGRATION_TEST_TIMEOUT_MS, 10) || 15000;
const retries = parseInt(process.env.INTEGRATION_TEST_RETRIES, 10) || 2;
const backendBaseUrl = process.env.TEST_API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

const secretEnvNames = [
  'GITHUB_TOKEN',
  'GEMINI_API_KEY',
  'TAVILY_API_KEY',
  'COMPOSIO_API_KEY',
];

class SkipError extends Error {}

function isConfigured(name) {
  const key = name.replace(/_API_KEY$/, '').replace(/_TOKEN$/, '').toLowerCase();
  return config.has[key] || Boolean(config[name] && !config[name].includes('your_'));
}

function secretValues(name) {
  return [process.env[name], config[name]].filter(Boolean);
}

function sanitize(value) {
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return '';

  secretEnvNames.forEach(name => {
    secretValues(name).forEach(secret => {
      if (secret.length >= 6) {
        text = text.split(secret).join(`<redacted:${name}>`);
      }
    });
  });

  return text.replace(/AIza[0-9A-Za-z_-]{20,}/g, '<redacted:google-api-key>');
}

function compactData(data) {
  if (!data) return '';
  if (typeof data === 'string') return data.slice(0, 500);
  if (data.error?.message) return data.error.message;
  if (data.error_description) return data.error_description;
  if (data.message) return data.message;
  return JSON.stringify(data).slice(0, 500);
}

function describeError(err) {
  const parts = [];
  if (err.response?.status) parts.push(`HTTP ${err.response.status}`);
  if (err.status && !err.response?.status) parts.push(`status ${err.status}`);
  if (err.code) parts.push(err.code);

  const responseData = compactData(err.response?.data);
  if (responseData) {
    parts.push(responseData);
  } else if (err.message) {
    parts.push(err.message);
  }

  return sanitize(parts.join(' - '));
}

function isTransientNetworkError(err) {
  if (['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(err.code)) {
    return true;
  }
  return err.response?.status >= 500;
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= retries || !isTransientNetworkError(err)) break;
      await wait(500 * attempt);
    }
  }

  throw lastError;
}

function parseGithubRepo(input) {
  const match = input.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!match) throw new Error(`TEST_REPO must be a GitHub URL, got ${input}`);
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
  };
}

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (isConfigured('GITHUB_TOKEN')) headers.Authorization = `Bearer ${config.GITHUB_TOKEN}`;
  return headers;
}

async function checkNpmRegistry() {
  const response = await withRetry(() =>
    axios.get(`${NPM_REGISTRY}/${encodeURIComponent(packageName)}`, { timeout })
  );
  const latest = response.data?.['dist-tags']?.latest;
  if (!latest) throw new Error('npm metadata response did not include dist-tags.latest');
  return `${response.data.name}@${latest}`;
}

async function checkOsv() {
  const response = await withRetry(() =>
    axios.post(
      OSV_API,
      { queries: [{ package: { ecosystem: 'npm', name: packageName } }] },
      { timeout }
    )
  );

  if (!Array.isArray(response.data?.results)) {
    throw new Error('OSV querybatch response did not include results[]');
  }

  const vulnCount = response.data.results
    .flatMap(result => Array.isArray(result.vulns) ? result.vulns : [])
    .length;
  return `${response.data.results.length} query result(s), ${vulnCount} vuln id(s)`;
}

async function checkGithubRepo() {
  const { owner, repo } = parseGithubRepo(repoUrl);
  const response = await withRetry(() =>
    axios.get(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: githubHeaders(),
      timeout,
    })
  );

  if (!response.data?.full_name) throw new Error('GitHub repo response did not include full_name');
  return `${response.data.full_name}, stars=${response.data.stargazers_count}`;
}

async function checkGithubAdvisories() {
  const response = await withRetry(() =>
    axios.get(`${GITHUB_API}/advisories`, {
      headers: githubHeaders(),
      params: {
        ecosystem: 'npm',
        affects: packageName,
        per_page: 10,
      },
      timeout,
    })
  );

  if (!Array.isArray(response.data)) {
    throw new Error('GitHub advisories response was not an array');
  }
  return `${response.data.length} advisory record(s)`;
}

async function checkTavily() {
  const response = await withRetry(() =>
    axios.post(
      TAVILY_API,
      {
        query: `${packageName} npm package maintenance`,
        search_depth: 'basic',
        max_results: 1,
        include_answer: false,
      },
      {
        headers: {
          Authorization: `Bearer ${config.TAVILY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout,
      }
    )
  );

  if (!Array.isArray(response.data?.results)) {
    throw new Error('Tavily response did not include results[]');
  }
  return `${response.data.results.length} result(s)`;
}

async function checkGemini() {
  const modelNames = (process.env.GEMINI_TEST_MODELS || 'gemini-3-flash-preview,gemini-2.5-flash')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);

  const errors = [];

  for (const modelName of modelNames) {
    try {
      const response = await withRetry(() =>
        axios.post(
          `${GEMINI_API}/${encodeURIComponent(modelName)}:generateContent`,
          {
            contents: [{
              parts: [{ text: 'Return exactly this text and nothing else: OK' }],
            }],
          },
          {
            params: { key: config.GEMINI_API_KEY },
            timeout,
          }
        )
      );
      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new Error('Gemini returned empty text');
      return `${modelName} responded with "${sanitize(text).slice(0, 80)}"`;
    } catch (err) {
      errors.push(`${modelName}: ${describeError(err)}`);
    }
  }

  throw new Error(`All Gemini test models failed. ${errors.join(' | ')}`);
}

async function checkComposio() {
  const response = await withRetry(() =>
    axios.get(COMPOSIO_API, {
      headers: { 'x-api-key': config.COMPOSIO_API_KEY },
      params: { limit: 1 },
      timeout,
    })
  );

  if (!response.data) throw new Error('Composio response was empty');
  return 'v3 tools endpoint reachable';
}

async function checkBackendApi() {
  try {
    const response = await axios.get(`${backendBaseUrl}/health`, { timeout: 3000 });
    if (response.data?.status !== 'ok') {
      throw new Error('/health did not return status=ok');
    }
    return `${backendBaseUrl}/health`;
  } catch (err) {
    if (!strict && ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND'].includes(err.code)) {
      throw new SkipError(`Backend API not running at ${backendBaseUrl}`);
    }
    throw err;
  }
}

const checks = [
  { name: 'npm registry', run: checkNpmRegistry },
  { name: 'OSV.dev querybatch', run: checkOsv },
  { name: 'GitHub REST API', run: checkGithubRepo },
  { name: 'GitHub Security Advisories', run: checkGithubAdvisories },
  { name: 'Tavily Search API', env: 'TAVILY_API_KEY', optional: true, run: checkTavily },
  { name: 'Gemini API', env: 'GEMINI_API_KEY', optional: true, run: checkGemini },
  { name: 'Composio API', env: 'COMPOSIO_API_KEY', optional: true, run: checkComposio },
  { name: 'DepScope backend API', optional: true, run: checkBackendApi },
];

async function runCheck(check) {
  const label = check.name.padEnd(30);

  if (check.env && !isConfigured(check.env)) {
    if (check.optional && !strict) {
      console.log(`SKIP ${label} ${check.env} is not configured`);
      return 'skip';
    }
    console.log(`FAIL ${label} ${check.env} is not configured`);
    return 'fail';
  }

  try {
    const detail = await check.run();
    console.log(`PASS ${label} ${sanitize(detail)}`);
    return 'pass';
  } catch (err) {
    if (err instanceof SkipError) {
      console.log(`SKIP ${label} ${sanitize(err.message)}`);
      return 'skip';
    }
    console.log(`FAIL ${label} ${describeError(err)}`);
    return 'fail';
  }
}

async function main() {
  console.log('DepScope integration checks');
  console.log('===========================');
  console.log(`Package: ${packageName}`);
  console.log(`Repo: ${repoUrl}`);
  console.log(`Strict mode: ${strict ? 'on' : 'off'}`);
  console.log('');

  const results = { pass: 0, skip: 0, fail: 0 };
  for (const check of checks) {
    const status = await runCheck(check);
    results[status] += 1;
  }

  console.log('');
  console.log(`Summary: ${results.pass} passed, ${results.skip} skipped, ${results.fail} failed`);
  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`Integration runner crashed: ${describeError(err)}`);
  process.exit(1);
});
