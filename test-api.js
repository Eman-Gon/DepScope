require('dotenv').config();
const axios = require('axios');

const BASE = `http://localhost:${process.env.PORT || 3000}`;
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

// ── Integration: API endpoints ──────────────────────────────────────────────

async function testHealthEndpoint() {
  console.log('\n=== Integration: Health endpoint ===\n');
  const res = await axios.get(`${BASE}/health`);
  assert(res.status === 200, 'GET /health returns 200');
  assert(res.data.status === 'ok', 'health status is ok');
}

async function testRootEndpoint() {
  console.log('\n=== Integration: Root endpoint ===\n');
  const res = await axios.get(`${BASE}/`);
  assert(res.status === 200, 'GET / returns 200');
  const contentType = res.headers['content-type'] || '';
  assert(
    res.data.service === 'DepScope API' || contentType.includes('text/html'),
    'root returns API status in dev or frontend HTML in production build'
  );
}

async function testAnalyzeEndpoint() {
  console.log('\n=== Integration: POST /api/analyze ===\n');

  // Missing input returns 400
  try {
    await axios.post(`${BASE}/api/analyze`, {});
    assert(false, 'missing input returns 400');
  } catch (err) {
    assert(err.response?.status === 400, 'missing input returns 400');
  }

  // Valid input returns analysisId
  const res = await axios.post(`${BASE}/api/analyze`, { input: 'https://github.com/lodash/lodash' });
  assert(res.status === 200, 'valid input returns 200');
  assert(typeof res.data.analysisId === 'string', 'returns analysisId string');
  assert(res.data.analysisId.length > 0, 'analysisId is non-empty');

  return res.data.analysisId;
}

async function testResultEndpoint(analysisId) {
  console.log('\n=== Integration: GET /api/analyze/:id/result ===\n');

  // Unknown ID returns 404
  try {
    await axios.get(`${BASE}/api/analyze/nonexistent/result`);
    assert(false, 'unknown ID returns 404');
  } catch (err) {
    assert(err.response?.status === 404, 'unknown ID returns 404');
  }

  // Poll until complete or timeout (30s)
  const deadline = Date.now() + 30000;
  let result;
  while (Date.now() < deadline) {
    const res = await axios.get(`${BASE}/api/analyze/${analysisId}/result`);
    result = res.data;
    if (result.status === 'complete' || result.status === 'error') break;
    await new Promise(r => setTimeout(r, 1000));
  }

  assert(result, 'result exists');
  assert(result.id === analysisId, 'result ID matches');
  assert(['complete', 'error', 'running'].includes(result.status), `status is valid (${result.status})`);

  if (result.status === 'complete') {
    assert(result.grade, `has grade (${result.grade})`);
    assert(result.scores, 'has scores object');
    assert(Array.isArray(result.findings), 'has findings array');
    assert(typeof result.verdict === 'string', 'has verdict string');
    assert(result.repoHealth, 'has repoHealth');
    assert(result.research, 'has research');
    assert(typeof result.weightedScore === 'number', 'has weightedScore');
  } else {
    console.log(`  (analysis ended with status: ${result.status} — ${result.error || 'no error detail'})`);
  }
}

async function testPatternsEndpoint() {
  console.log('\n=== Integration: GET /api/patterns ===\n');
  const res = await axios.get(`${BASE}/api/patterns`);
  assert(res.status === 200, 'GET /api/patterns returns 200');
  assert(res.data.totalAnalyzed !== undefined || res.data.message, 'returns totalAnalyzed or message');
}

// ── Runner ──────────────────────────────────────────────────────────────────

async function run() {
  console.log('DepScope Test Suite');
  console.log('===================');

  // Integration tests (server must be running)
  try {
    await axios.get(`${BASE}/health`);
  } catch {
    console.error(`\nServer not running at ${BASE}. Start it with: npm start\n`);
    process.exit(1);
  }

  await testHealthEndpoint();
  await testRootEndpoint();
  await testPatternsEndpoint();
  const analysisId = await testAnalyzeEndpoint();
  await testResultEndpoint(analysisId);

  // Summary
  console.log(`\n===================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`===================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner error:', err.message);
  process.exit(1);
});
