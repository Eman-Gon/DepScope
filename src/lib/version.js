const DEPLOY_TIME = new Date().toISOString();

const GIT_COMMIT = (() => {
  try {
    return require('child_process')
      .execSync('git rev-parse --short HEAD', { timeout: 3000 })
      .toString()
      .trim();
  } catch {
    return process.env.RENDER_GIT_COMMIT || 'unknown';
  }
})();

module.exports = {
  DEPLOY_TIME,
  GIT_COMMIT,
};
