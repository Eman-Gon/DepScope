## DepScope — Things to Fix / Remaining Work

### ✅ DONE
1. ~~Fix GitHub token~~ — GITHUB_TOKEN works, getting live data (61K stars for lodash)
2. ~~Verify You.com API key works~~ — Live CVE search, sentiment, alternatives all working
3. ~~Verify Gemini API key works~~ — Paid key, synthesis runs live (no more 429s)
4. ~~Test end-to-end pipeline locally~~ — All 4 packages tested: lodash C, express B, moment C, axios B
5. ~~Remove Plivo phone alerts~~ — Watchlist failures now stay in dashboard/API scan history
6. ~~Add Composio orchestration~~ — 3 custom tools registered, parallel execution, cached fallback
7. ~~Pre-cache 2-3 demo results~~ — lodash, moment, express cached in demoCache.js

### 🔲 REMAINING
8. Redeploy to Render with working env vars — so the deployed API actually works
9. Build out Lovable dashboard — connect to backend SSE + result endpoints
10. Connect Lovable frontend to Render API — replace mock data with real fetch() calls + SSE
11. Test Plivo with a real phone call — configure a real phone number and trigger CRITICAL analysis
12. Write Composio friction log — document zod version mismatch, inputParams vs inputParameters, etc.
13. Record 3-minute demo video — required for Devpost
14. Submit to Devpost — project name, description, video, screenshots, GitHub link
