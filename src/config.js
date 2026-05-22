require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  BASE_URL: process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`,

  // API Keys
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  TAVILY_API_KEY: process.env.TAVILY_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY,
};
