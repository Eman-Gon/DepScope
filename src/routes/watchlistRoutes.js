const express = require('express');
const {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  getScanHistory,
  runScanCycle,
  startCron,
  stopCron,
  getCronStatus,
} = require('../services/watchlistService');
const { parseInput, resolvePackageToGitHub } = require('../lib/input');

const router = express.Router();

router.get('/api/watchlist', (_req, res) => {
  const entries = getWatchlist().map(entry => ({
    id: entry.id,
    input: entry.repoUrl,
    packageName: entry.packageName,
    owner: entry.owner || null,
    repo: entry.repo || null,
    addedAt: entry.addedAt,
    lastGrade: entry.lastGrade || null,
    lastScore: entry.lastScore || null,
    lastScanAt: entry.lastScanAt || null,
  }));
  res.json({ entries, cron: getCronStatus() });
});

router.post('/api/watchlist', async (req, res) => {
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
    const entry = addToWatchlist(parsed.url, parsed.packageName, parsed.owner, parsed.repo);
    return res.json(entry);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/api/watchlist/:id', (req, res) => {
  const removed = removeFromWatchlist(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Not found' });
  return res.json({ removed: true, watchlistSize: getWatchlist().length });
});

router.post('/api/watchlist/scan', async (_req, res) => {
  if (getWatchlist().length === 0) {
    return res.status(400).json({ error: 'Watchlist is empty' });
  }

  const scan = await runScanCycle((status, message) => {
    console.log(`[Watchlist][${status}] ${message}`);
  });
  return res.json({ scan });
});

router.post('/api/watchlist/cron', (req, res) => {
  const { action, intervalMinutes } = req.body;
  if (action === 'start') {
    const ms = (intervalMinutes || 60) * 60 * 1000;
    startCron(ms);
    return res.json({ message: 'Cron started', cron: getCronStatus() });
  }
  if (action === 'stop') {
    stopCron();
    return res.json({ message: 'Cron stopped', cron: getCronStatus() });
  }
  return res.status(400).json({ error: 'action must be "start" or "stop"' });
});

router.get('/api/watchlist/scans', (_req, res) => {
  res.json({ scans: getScanHistory() });
});

module.exports = router;
