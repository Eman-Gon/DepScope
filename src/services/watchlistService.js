/**
 * Watchlist Service
 *
 * In-memory watchlist of repos to monitor on a cron schedule.
 * After each scan cycle, if any repo scores an F grade, generates
 * an audio report via Gemini and triggers a Plivo voice call + SMS.
 */

const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { analyzeRepo } = require('./githubService');
const { researchPackage } = require('./youService');
const { synthesizeRiskAssessment } = require('./geminiService');
const { getCachedData } = require('./demoCache');
const { makeCall, sendSMS } = require('./plivoService');
const config = require('../config');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── In-memory watchlist DB ─────────────────────────────────────────────────
const watchlist = [];      // { id, repoUrl, packageName, owner, repo, addedAt, lastGrade, lastScore, lastScanAt }
const scanHistory = [];    // { id, startedAt, completedAt, results: [], alertReport, detailedReport }
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

// ─── Gemini report generation ───────────────────────────────────────────────

async function generateAlertReport(failedRepos) {
  const models = ['gemini-3-flash-preview', 'gemini-2.5-flash'];
  const summary = failedRepos.map(r => {
    const findings = (r.findings || [])
      .map(f => `${f.severity}: ${f.title} - ${f.detail}`)
      .join('. ');
    return `${r.packageName} (Grade ${r.grade}): ${findings}`;
  }).join('\n\n');

  const prompt = `You are DepScope, an automated dependency security monitor.

The following monitored repositories received an F grade in their latest scan. Generate two outputs.

SCAN RESULTS:
${summary}

OUTPUT 1 - VOICE SCRIPT:
Write a short spoken alert (under 30 seconds when read aloud) suitable for a phone call via text to speech. Be direct and urgent. Name each failing package and the most critical issue. No markdown, no special characters, no formatting. Just plain spoken English sentences. End with "Press 1 to receive the full report by text. Press 2 to dismiss."

OUTPUT 2 - SMS TEXT:
Write a concise SMS message (under 300 characters) summarizing the failing packages and their worst issues. No markdown, no formatting, plain text only.

Respond with ONLY valid JSON in this format:
{
  "voiceScript": "the spoken alert text",
  "smsText": "the sms message text"
}`;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(clean);
    } catch (err) {
      if (err.status === 429 || err.status === 404) continue;
      throw err;
    }
  }

  // Fallback: generate locally without AI
  const names = failedRepos.map(r => r.packageName).join(', ');
  return {
    voiceScript: `DepScope alert. ${failedRepos.length} monitored ${failedRepos.length === 1 ? 'package has' : 'packages have'} received a failing grade: ${names}. Immediate review is recommended. Press 1 to receive the full report by text. Press 2 to dismiss.`,
    smsText: `DepScope Alert: ${names} received grade F. Critical security or maintenance issues detected. Review immediately.`,
  };
}

async function generateDetailedReport(scanResults) {
  const models = ['gemini-3-flash-preview', 'gemini-2.5-flash'];
  const summary = scanResults.map(r => {
    const findings = (r.findings || [])
      .map(f => `[${f.severity}] ${f.title}: ${f.detail}. Recommendation: ${f.recommendation || 'N/A'}`)
      .join('\n');
    return `Package: ${r.packageName}\nGrade: ${r.grade}\nScore: ${r.weightedScore || 'N/A'}\nVerdict: ${r.verdict || 'N/A'}\nFindings:\n${findings}`;
  }).join('\n\n---\n\n');

  const prompt = `You are DepScope, an automated dependency security monitor. A user pressed 1 on their phone to receive a detailed report via SMS.

Write a thorough but SMS-friendly report for the following scan results. NO markdown, NO formatting characters, NO asterisks, NO bullet points. Use plain text with line breaks. Keep it under 1500 characters (SMS limit). Be specific about each vulnerability, what version is affected, and what action to take.

SCAN RESULTS:
${summary}

Respond with ONLY the plain text report, nothing else.`;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      if (err.status === 429 || err.status === 404) continue;
      throw err;
    }
  }

  // Fallback
  return scanResults.map(r =>
    `${r.packageName}: Grade ${r.grade}. ${(r.findings || []).map(f => `${f.severity} - ${f.title}`).join('. ')}`
  ).join('\n\n');
}

// ─── Scan cycle ─────────────────────────────────────────────────────────────

async function runScanCycle(alertPhone, onProgress) {
  if (watchlist.length === 0) {
    console.log('[Watchlist] No repos to scan');
    return null;
  }

  const scan = {
    id: uuidv4(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    results: [],
    alertReport: null,
    detailedReport: null,
    alertTriggered: false,
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

  // Check for F grades
  const failedRepos = scan.results.filter(r => r.grade === 'F');

  if (failedRepos.length > 0) {
    console.log(`[Watchlist] ${failedRepos.length} repos with F grade — generating alert`);
    if (onProgress) onProgress('alerting', `${failedRepos.length} failing — generating alert report...`);

    try {
      const report = await generateAlertReport(failedRepos);
      scan.alertReport = report;

      // Pre-generate the detailed report for press-1
      const detailed = await generateDetailedReport(scan.results);
      scan.detailedReport = detailed;

      if (alertPhone) {
        const answerUrl = `${config.BASE_URL}/api/watchlist/voice-xml/${scan.id}`;
        await makeCall(alertPhone, answerUrl);
        scan.alertTriggered = true;
        console.log(`[Watchlist] Voice alert sent for scan ${scan.id}`);
        if (onProgress) onProgress('alerted', 'Voice alert sent to your phone');
      } else {
        console.log(`[Watchlist] F grades found but no alert phone configured`);
        if (onProgress) onProgress('warning', 'F grades found but no alert phone configured');
      }
    } catch (err) {
      console.error(`[Watchlist] Alert failed: ${err.message}`);
      if (onProgress) onProgress('alert-error', `Alert failed: ${err.message}`);
    }
  } else {
    if (onProgress) onProgress('complete', `All ${scan.results.length} packages healthy`);
  }

  return scan;
}

// ─── Cron management ────────────────────────────────────────────────────────

function startCron(alertPhone, intervalMs) {
  stopCron();
  if (intervalMs) cronIntervalMs = intervalMs;
  console.log(`[Watchlist] Cron started — scanning every ${cronIntervalMs / 1000}s`);
  cronInterval = setInterval(() => runScanCycle(alertPhone), cronIntervalMs);
  runScanCycle(alertPhone);
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
  generateAlertReport,
  generateDetailedReport,
};
