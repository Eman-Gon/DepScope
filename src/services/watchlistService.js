/**
 * Watchlist Service
 *
 * In-memory watchlist of repos to monitor on a cron schedule.
 * Scan results are kept in memory and surfaced through the dashboard/API.
 */

const { v4: uuidv4 } = require('uuid');
const { analyzeRepo } = require('./githubService');
const { researchPackage } = require('./researchService');
const { synthesizeRiskAssessment } = require('./geminiService');
const { getCachedData } = require('./demoCache');

// ─── In-memory watchlist DB ─────────────────────────────────────────────────
const watchlist = [];      // { id, repoUrl, packageName, owner, repo, addedAt, lastGrade, lastScore, lastScanAt }
const scanHistory = [];    // { id, startedAt, completedAt, results: [], failedCount }
let cronInterval = null;
let cronIntervalMs = 60 * 60 * 1000; // default 1 hour

// ─── CRUD ────────────────────────────────────────────────────────────────────

function addToWatchlist(repoUrl, packageName, owner, repo) {
  const existing = watchlist.find(
    w => w.repoUrl === repoUrl || w.packageName === packageName
  );
  if (existing) return existing;

  const entry = {
    id: uuidv4(),
    repoUrl,
    packageName,
    owner: owner || null,
    repo: repo || null,
    addedAt: new Date().toISOString(),
    lastGrade: null,
    lastScore: null,
    lastScanAt: null,
  };
  watchlist.push(entry);
  return entry;
}

function removeFromWatchlist(id) {
  const idx = watchlist.findIndex(w => w.id === id);
  if (idx === -1) return false;
  watchlist.splice(idx, 1);
  return true;
}

function getWatchlist() {
  return [...watchlist];
}

function getScanHistory() {
  return scanHistory.slice(-20);
}

// ─── Scan cycle ─────────────────────────────────────────────────────────────

async function runScanCycle(onProgress) {
  if (watchlist.length === 0) {
    console.log('[Watchlist] No repos to scan');
    return null;
  }

  const scan = {
    id: uuidv4(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    results: [],
    failedCount: 0,
  };

  console.log(`[Watchlist] Starting scan of ${watchlist.length} repos...`);
  if (onProgress) onProgress('started', `Scanning ${watchlist.length} packages...`);

  for (let i = 0; i < watchlist.length; i++) {
    const entry = watchlist[i];
    if (onProgress) onProgress('scanning', `Analyzing ${entry.packageName} (${i + 1}/${watchlist.length})...`);

    try {
      const repoHealth = await analyzeRepo(entry.repoUrl);

      let research;
      try {
        research = await researchPackage(entry.packageName);
      } catch (_) {
        const cached = getCachedData(entry.packageName);
        research = cached?.research || { cves: [], sentiment: { overall: 'unknown' }, alternatives: [] };
      }

      let assessment;
      try {
        assessment = await synthesizeRiskAssessment(repoHealth, research);
      } catch (_) {
        const cached = getCachedData(entry.packageName);
        assessment = cached?.assessment || { grade: 'C', findings: [], weightedScore: 50, verdict: 'Unable to assess' };
      }

      const result = {
        watchlistId: entry.id,
        packageName: entry.packageName,
        repoUrl: entry.repoUrl,
        grade: assessment.grade,
        weightedScore: assessment.weightedScore,
        findings: assessment.findings,
        verdict: assessment.verdict,
        scannedAt: new Date().toISOString(),
      };
      scan.results.push(result);

      // Update the watchlist entry with latest results
      entry.lastGrade = assessment.grade;
      entry.lastScore = assessment.weightedScore;
      entry.lastScanAt = result.scannedAt;

      console.log(`[Watchlist] ${entry.packageName}: Grade ${assessment.grade}`);
      if (onProgress) onProgress('scanned', `${entry.packageName}: Grade ${assessment.grade}`);
    } catch (err) {
      console.error(`[Watchlist] Failed to scan ${entry.packageName}: ${err.message}`);
      scan.results.push({
        watchlistId: entry.id,
        packageName: entry.packageName,
        repoUrl: entry.repoUrl,
        grade: 'ERROR',
        error: err.message,
        scannedAt: new Date().toISOString(),
      });
      if (onProgress) onProgress('error', `${entry.packageName}: ${err.message}`);
    }
  }

  scan.completedAt = new Date().toISOString();
  scanHistory.push(scan);

  const failedRepos = scan.results.filter(r => r.grade === 'F');
  scan.failedCount = failedRepos.length;
  if (failedRepos.length > 0) {
    console.log(`[Watchlist] ${failedRepos.length} repos with F grade`);
    if (onProgress) onProgress('warning', `${failedRepos.length} packages received grade F`);
  } else {
    if (onProgress) onProgress('complete', `All ${scan.results.length} packages healthy`);
  }

  return scan;
}

// ─── Cron management ────────────────────────────────────────────────────────

function startCron(intervalMs) {
  stopCron();
  if (intervalMs) cronIntervalMs = intervalMs;
  console.log(`[Watchlist] Cron started — scanning every ${cronIntervalMs / 1000}s`);
  cronInterval = setInterval(() => runScanCycle(), cronIntervalMs);
  runScanCycle();
}

function stopCron() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log('[Watchlist] Cron stopped');
  }
}

function getCronStatus() {
  return {
    running: !!cronInterval,
    intervalMs: cronIntervalMs,
    watchlistSize: watchlist.length,
    totalScans: scanHistory.length,
  };
}

module.exports = {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  getScanHistory,
  runScanCycle,
  startCron,
  stopCron,
  getCronStatus,
};
