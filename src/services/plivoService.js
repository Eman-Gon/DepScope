const axios = require('axios');
const config = require('../config');

const PLIVO_API_BASE = 'https://api.plivo.com/v1/Account';

function getPlivoAuth() {
  if (!config.PLIVO_AUTH_ID || !config.PLIVO_AUTH_TOKEN || 
      config.PLIVO_AUTH_ID.includes('your_')) {
    return null;
  }
  return {
    username: config.PLIVO_AUTH_ID,
    password: config.PLIVO_AUTH_TOKEN,
  };
}

async function makeCall(toNumber, answerUrl) {
  const auth = getPlivoAuth();
  if (!auth) {
    console.warn('[Plivo] Not configured — skipping call');
    return null;
  }

  try {
    const response = await axios.post(
      `${PLIVO_API_BASE}/${config.PLIVO_AUTH_ID}/Call/`,
      {
        from: config.PLIVO_PHONE_NUMBER,
        to: toNumber,
        answer_url: answerUrl,
        answer_method: 'GET',
      },
      { auth }
    );
    console.log(`[Plivo] Call initiated: ${response.data.request_uuid}`);
    return response.data;
  } catch (error) {
    console.error('[Plivo] Call failed:', error.response?.data || error.message);
    return null;
  }
}

async function sendSMS(toNumber, text) {
  const auth = getPlivoAuth();
  if (!auth) {
    console.warn('[Plivo] Not configured — skipping SMS');
    return null;
  }

  try {
    const response = await axios.post(
      `${PLIVO_API_BASE}/${config.PLIVO_AUTH_ID}/Message/`,
      {
        src: config.PLIVO_PHONE_NUMBER,
        dst: toNumber,
        text,
      },
      { auth }
    );
    console.log(`[Plivo] SMS sent: ${response.data.message_uuid}`);
    return response.data;
  } catch (error) {
    console.error('[Plivo] SMS failed:', error.response?.data || error.message);
    return null;
  }
}

async function triggerVoiceAlert(phoneNumber, analysisId) {
  const answerUrl = `${config.BASE_URL}/api/plivo/voice-xml/${analysisId}`;
  return makeCall(phoneNumber, answerUrl);
}

module.exports = { makeCall, sendSMS, triggerVoiceAlert };
