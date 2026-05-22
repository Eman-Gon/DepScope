const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const analysisRoutes = require('./routes/analysisRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const statusRoutes = require('./routes/statusRoutes');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    const start = Date.now();
    const { method, url } = req;
    console.log(`[REQ] ${method} ${url} from ${req.ip} at ${new Date().toISOString()}`);
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[RES] ${method} ${url} -> ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  app.use(statusRoutes);
  app.use(analysisRoutes);
  app.use(watchlistRoutes);

  const frontendDist = path.resolve(__dirname, '../Frontend/dist');
  if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({ service: 'DepScope API', status: 'ok' });
    });
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  return app;
}

module.exports = { createApp };
