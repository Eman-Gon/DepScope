# Plivo Integration Guide — DepScope

## Overview

DepScope uses Plivo for two things:
1. **Voice calls** — automated phone alerts when critical/failing dependencies are detected
2. **SMS** — follow-up text messages with report details

## Setup

### 1. Plivo Account
- Sign up at [plivo.com](https://www.plivo.com)
- Get your **Auth ID** and **Auth Token** from the dashboard
- Buy a phone number (or use the sandbox number for testing)

### 2. Environment Variables
```
PLIVO_AUTH_ID=your_auth_id
PLIVO_AUTH_TOKEN=your_auth_token
PLIVO_PHONE_NUMBER=your_plivo_number  # include country code, no +
```

### 3. Phone Verification (Trial Accounts)
Trial accounts can only call/text **verified numbers**. Add your phone at:
https://console.plivo.com/phone-numbers/sandbox-numbers/

### 4. 10DLC Registration (SMS Only)
US long codes require 10DLC campaign registration for SMS. Voice calls work without it.
Follow: https://www.plivo.com/docs/sms/a2p-10dlc/quickstart

## How It Works

### Voice Call Flow
```
DepScope detects F grade
  → POST to Plivo /Call/ API
  → Plivo calls user's phone
  → Plivo fetches answer_url from our server (GET /api/plivo/voice-xml/:id)
  → Server returns XML with <Speak> and <GetDigits>
  → User hears the alert, presses 1 or 2
  → Plivo POSTs to /api/plivo/handle-input/:id (includes the caller number in `From`)
  → If 1: send SMS with report link to the caller number (fallback to configured alert phone)
  → If 2: dismiss
```

### Plivo XML Format
Plivo uses XML responses to control call behavior:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="Polly.Matthew" language="en-US">
    Your alert message here.
  </Speak>
  <GetDigits action="https://your-url.com/handle-input/123"
             method="POST" timeout="10" numDigits="1">
    <Speak>Press 1 or 2.</Speak>
  </GetDigits>
</Response>
```

### Key Plivo REST API Endpoints
Base URL: `https://api.plivo.com/v1/Account/{auth_id}/`

| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| Make call | POST | `/Call/` | `{ from, to, answer_url, answer_method }` |
| Send SMS | POST | `/Message/` | `{ src, dst, text }` |

Auth: HTTP Basic with `auth_id:auth_token`

## DepScope Endpoints

### Single Analysis Alerts
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/alert/configure` | POST | Register phone: `{"phone": "+1234567890"}` |
| `/api/plivo/voice-xml/:analysisId` | GET | Voice XML for single analysis alerts |
| `/api/plivo/handle-input/:analysisId` | POST | DTMF handler (1=SMS, 2=dismiss) |

### Watchlist Alerts
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/watchlist/voice-xml/:scanId` | GET | Voice XML for watchlist scan alerts |
| `/api/watchlist/handle-input/:scanId` | POST | DTMF handler for watchlist alerts |

### Test Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/plivo/test-voice` | GET | Mock voice XML for testing |
| `/api/plivo/test-input` | POST | Mock DTMF handler for testing |

## Testing

### Quick SMS + Call Test
```bash
node test-plivo.js "+15857975153"        # both SMS and call
node test-plivo.js "+15857975153" sms    # SMS only
node test-plivo.js "+15857975153" call   # call only
```

### Watchlist Flow Test
```bash
# 1. Configure alert phone
curl -X POST http://localhost:3000/api/alert/configure \
  -H 'Content-Type: application/json' \
  -d '{"phone": "+15857975153"}'

# 2. Add repos to watchlist
curl -X POST http://localhost:3000/api/watchlist \
  -H 'Content-Type: application/json' \
  -d '{"input": "lodash"}'

# 3. Trigger scan (will call if any repo gets F)
curl -X POST http://localhost:3000/api/watchlist/scan

# 4. Start cron (scans every 60 minutes)
curl -X POST http://localhost:3000/api/watchlist/cron \
  -H 'Content-Type: application/json' \
  -d '{"action": "start", "intervalMinutes": 60}'
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| SMS: "10DLC campaign" error | Register at plivo.com/docs/sms/a2p-10dlc/quickstart |
| Call: phone doesn't ring | Verify number at console.plivo.com sandbox numbers |
| Call: no audio | Check BASE_URL is publicly reachable (use Render URL) |
| Call: "analysis not found" | The analysisId/scanId doesn't exist in memory |

## Important Notes
- **BASE_URL must be public** — Plivo's servers need to fetch the voice XML from your server. `localhost` won't work for voice calls. Use your Render URL.
- **Trial limitations** — Trial accounts prefix calls with "This is a Plivo trial account" and can only reach verified numbers.
- **In-memory storage** — Analysis data is lost on server restart. For demo, run the analysis first, then trigger the alert.
