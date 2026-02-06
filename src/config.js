require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,

  // API Keys
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  YOU_COM_API_KEY: process.env.YOU_COM_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY,

  // Plivo
  PLIVO_AUTH_ID: process.env.PLIVO_AUTH_ID,
  PLIVO_AUTH_TOKEN: process.env.PLIVO_AUTH_TOKEN,
  PLIVO_PHONE_NUMBER: process.env.PLIVO_PHONE_NUMBER,
};