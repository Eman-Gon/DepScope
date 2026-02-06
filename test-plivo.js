/**
 * Plivo Integration Test
 * 
 * Tests Plivo voice calls and SMS independently of the main pipeline.
 * Run: node test-plivo.js
 * 
 * Prerequisites:
 *   - .env with PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, PLIVO_PHONE_NUMBER
 *   - A verified destination phone number in your Plivo trial account
 *   - BASE_URL set to a publicly reachable URL (Render) for voice calls
 * 
 * What this tests:
 *   1. SMS delivery — sends a plain text message
 *   2. Voice call — calls the phone, reads a mock DepScope alert
 *   3. Voice call with DTMF — press 1 to get an SMS follow-up
 */

require('dotenv').config();
const { makeCall, sendSMS } = require('./src/services/plivoService');
const config = require('./src/config');

const PHONE = process.argv[2] || '+15857975153';

async function testSMS() {
  console.log(`\n=== Test 1: SMS to ${PHONE} ===`);
  const result = await sendSMS(PHONE,
    'DepScope Alert: 2 monitored packages received grade F. ' +
    'lodash - critical CVE (prototype pollution), ' +
    'event-stream - supply chain attack detected. ' +
    'Review immediately at your DepScope dashboard.'
  );
  if (result) {
    console.log('✅ SMS sent:', result.message_uuid || result);
  } else {
    console.log('❌ SMS failed (check Plivo credentials and phone verification)');
  }
  return result;
}

async function testVoiceCall() {
  console.log(`\n=== Test 2: Voice call to ${PHONE} ===`);
  console.log(`Answer URL: ${config.BASE_URL}/api/plivo/test-voice`);
  console.log('NOTE: BASE_URL must be publicly reachable (Render) for voice to work.');
  console.log(`Current BASE_URL: ${config.BASE_URL}`);

  const answerUrl = `${config.BASE_URL}/api/plivo/test-voice`;
  const result = await makeCall(PHONE, answerUrl);
  if (result) {
    console.log('✅ Call initiated:', result.request_uuid || result);
    console.log('   Your phone should ring shortly...');
  } else {
    console.log('❌ Call failed (check Plivo credentials, phone verification, and BASE_URL)');
  }
  return result;
}

async function main() {
  console.log('=== Plivo Integration Test ===');
  console.log(`Target phone: ${PHONE}`);
  console.log(`Plivo number: ${config.PLIVO_PHONE_NUMBER}`);
  console.log(`Base URL: ${config.BASE_URL}`);
  console.log(`Auth ID: ${config.PLIVO_AUTH_ID?.substring(0, 8)}...`);

  if (!config.PLIVO_AUTH_ID || config.PLIVO_AUTH_ID.includes('your_')) {
    console.error('\n❌ Plivo not configured. Set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, PLIVO_PHONE_NUMBER in .env');
    process.exit(1);
  }

  const mode = process.argv[3] || 'both';

  if (mode === 'sms' || mode === 'both') {
    await testSMS();
  }

  if (mode === 'call' || mode === 'both') {
    await testVoiceCall();
  }

  console.log('\n=== Done ===');
  console.log('If SMS arrived but call failed, check that BASE_URL is publicly reachable.');
  console.log('Plivo trial accounts require phone numbers to be verified at:');
  console.log('  https://console.plivo.com/phone-numbers/sandbox-numbers/');
}

main().catch(console.error);
