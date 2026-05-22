require('dotenv').config();

const CONFIG_WARNINGS = [];

function cleanEnvValue(name) {
  const raw = process.env[name];
  if (raw == null) return undefined;

  let value = String(raw).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  if (value !== raw) {
    CONFIG_WARNINGS.push(`${name} was normalized by trimming whitespace or surrounding quotes`);
  }

  return value || undefined;
}

function isConfigured(value) {
  return Boolean(value && !value.includes('your_'));
}

const config = {
  PORT: cleanEnvValue('PORT') || 3000,
  BASE_URL: cleanEnvValue('BASE_URL') || cleanEnvValue('RENDER_EXTERNAL_URL') || `http://localhost:${cleanEnvValue('PORT') || 3000}`,

  // API Keys
  GITHUB_TOKEN: cleanEnvValue('GITHUB_TOKEN'),
  TAVILY_API_KEY: cleanEnvValue('TAVILY_API_KEY'),
  GEMINI_API_KEY: cleanEnvValue('GEMINI_API_KEY'),
  COMPOSIO_API_KEY: cleanEnvValue('COMPOSIO_API_KEY'),
  GITHUB_MAX_COMMITS: parseInt(cleanEnvValue('GITHUB_MAX_COMMITS'), 10) || 100,

  CONFIG_WARNINGS,
};

config.has = {
  github: isConfigured(config.GITHUB_TOKEN),
  tavily: isConfigured(config.TAVILY_API_KEY),
  gemini: isConfigured(config.GEMINI_API_KEY),
  composio: isConfigured(config.COMPOSIO_API_KEY),
};

module.exports = {
  ...config,
  cleanEnvValue,
};
