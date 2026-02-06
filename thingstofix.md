Fix GitHub token — generate a new PAT, update .env and Render env vars
Verify You.com API key works — currently returns mock data if key is missing/invalid
Verify Gemini API key works — test that synthesis actually runs
Test end-to-end pipeline locally — run test-full.js with all 3 APIs working
Redeploy to Render with working env vars — so the deployed API actually works
Build out Lovable dashboard — add mock data, radar chart, findings list, alternatives table, verdict section, agent status cards
Connect Lovable frontend to Render API — replace mock data with real fetch() calls + SSE
Integrate Plivo SDK — replace the console.log placeholder in server.js with actual plivo.Client call
Add Composio orchestration — or skip it and accept losing the $1,000 prize
Write Composio friction log — even if you didn't use Composio much, document the experience for AirPods prize
Record 3-minute demo video — required for Devpost
Submit to Devpost — project name, description, video, screenshots, GitHub link
Pre-cache 2-3 demo results — backup in case APIs fail during live demo