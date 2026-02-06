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
const watchlist = [];      // { id, repoUrl, packageName, addedAt }
const scanHistory = [];    // { id, startedAt, completedAt, results: [] }
let cronInterval = null;
let cronIntervalMs = 60 * 60 * 1000; // default 1 hour

// ─── CRUD ────────────────────────────────────────────────────────────────────

function addToWatchlist(repoUrl, packageName) {
  const existing = watchlist.find(
    w => w.repoUrl === repoUrl || w.packageName === packageName
  );
  if (existing) return existing;

  const entry = {
    id: uuidv4(),
    repoUrl,
    packageName,
    addedAt: new Date().toISOString(),
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

// ─── Gemini report generation (no markdown) ─────────────────────────────────

async function generateAlertReport(failedRepos) {
  const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
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
Write a short spoken alert (under 30 seconds when read aloud) suitable for a phone call. Be direct and urgent. Name each failing package and the most critical issue. End with "Press 1 to receive the full report by text. Press 2 to dismiss."

OUTPUT 2 - SMS TEXT:
Write a concise SMS message (under 300 characters) summarizing the failing packages and their worst issues. No markdown, no formatting, plain text only. Include a note that detailed reports are available at the API.

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

// ─── Scan cycle ─────────────────────────────────────────────────────────────

async function runScanCycle(alertPhone) {
  if (watchlist.length === 0) {
    console.log('[Watchlist] No repos to scan');
    return null;
  }

  const scan = {
    id: uuidv4(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    results: [],
  };

  console.log(`[Watchlist] Starting scan of ${watchlist.length} repos...`);

  for (const entry of watchlist) {
    try {
      // Run the pipeline for each watched repo
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

      scan.results.push({
        watchlistId: entry.id,
        packageName: entry.packageName,
        repoUrl: entry.repoUrl,
        grade: assessment.grade,
        weightedScore: assessment.weightedScore,
        findings: assessment.findings,
        verdict: assessment.verdict,
        scannedAt: new Date().toISOString(),
      });

      console.log(`[Watchlist] ${entry.packageName}: Grade ${assessment.grade}`);
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
    }
  }

  scan.completedAt = new Date().toISOString();
  scanHistory.push(scan);

  // Check for F grades
  const failedRepos = scan.results.filter(r => r.grade === 'F');

  if (failedRepos.length > 0 && alertPhone) {
    console.log(`[Watchlist] ${failedRepos.length} repos with F grade — generating alert`);

    try {
      const report = await generateAlertReport(failedRepos);

      // Store the report so the voice-xml endpoint can read it
      scan.alertReport = report;

      // Make the Plivo voice call
      const answerUrl = `${config.BASE_URL}/api/watchlist/voice-xml/${scan.id}`;
      await makeCall(alertPhone, answerUrl);

      // Also send the SMS immediately
      await sendSMS(alertPhone, report.smsText);

      console.log(`[Watchlist] Alert sent for scan ${scan.id}`);
    } catch (err) {
      console.error(`[Watchlist] Alert failed: ${err.message}`);
    }
  } else if (failedRepos.length > 0) {
    console.log(`[Watchlist] ${failedRepos.length} repos with F grade but no alert phone configured`);
  }

  return scan;
}

// ─── Cron management ────────────────────────────────────────────────────────

function startCron(alertPhone, intervalMs) {
  stopCron();
  if (intervalMs) cronIntervalMs = intervalMs;
  console.log(`[Watchlist] Cron started — scanning every ${cronIntervalMs / 1000}s`);
  cronInterval = setInterval(() => runScanCycle(alertPhone), cronIntervalMs);
  // Run immediately on start
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
};
