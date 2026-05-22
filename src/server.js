const config = require('./config');
const { createApp } = require('./app');
const { registerAgentTools } = require('./services/composioService');
const { GIT_COMMIT, DEPLOY_TIME } = require('./lib/version');

const app = createApp();

async function start() {
  app.listen(config.PORT, async () => {
    console.log(`[STARTUP] DepScope running on port ${config.PORT} (commit: ${GIT_COMMIT}, deployed: ${DEPLOY_TIME})`);
    console.log(`[STARTUP] Base URL: ${config.BASE_URL}`);
    console.log(`[STARTUP] RENDER_EXTERNAL_URL: ${process.env.RENDER_EXTERNAL_URL || 'not set'}`);
    console.log(`[STARTUP] Node ${process.version}, ENV: ${process.env.NODE_ENV || 'development'}`);
    config.CONFIG_WARNINGS.forEach(warning => console.warn(`[CONFIG] ${warning}`));
    console.log(`[STARTUP] Tavily configured: ${config.has.tavily}`);

    if (config.has.composio) {
      try {
        await registerAgentTools();
        console.log('Composio orchestration: enabled');
      } catch (err) {
        console.warn(`Composio init failed (will use direct execution): ${err.message}`);
      }
    } else {
      console.log('Composio orchestration: disabled (no API key)');
    }
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
