# DepScope — Changelog (Copilot Enhancements)

**Branch:** `copilot-enhancements`  
**Date:** Feb 6, 2026

---

## New Files Created

### `src/services/composioService.js` (152 lines)
Composio SDK orchestration layer. Registers 3 custom tools with Composio (`DEPSCOPE_REPO_HEALTH`, `DEPSCOPE_RESEARCH`, `DEPSCOPE_RISK_SYNTHESIS`) and provides an `orchestrate()` function that runs Agents 1 & 2 in parallel, then Agent 3. Includes cached assessment fallback if Gemini fails.

### `src/services/plivoService.js` (73 lines)
Plivo REST API integration using axios (not the plivo npm package). Provides `makeCall()`, `sendSMS()`, and `triggerVoiceAlert()` functions. Uses HTTP Basic Auth with Plivo credentials.

### `src/services/demoCache.js` (141 lines)
Pre-cached analysis results for lodash, moment, and express. Used as fallback when APIs are unavailable. Each cache entry includes repoHealth, research (cves, sentiment, alternatives), and assessment (grade, scores, findings, verdict).

### `API_TEST_RESULTS.md`
Comprehensive test results for all 13 API endpoints with full output from 4 end-to-end analyses (lodash, express, moment, axios).

### `SPEC_GAP_ANALYSIS.md`
Line-by-line comparison of the hackathon spec vs implementation. Lists what's done, partially done, and missing.

---

## Modified Files

### `src/server.js`
**Major changes:**
- **Composio-first pipeline:** `runPipeline()` tries Composio orchestration first, falls back to direct `Promise.allSettled` execution if Composio fails
- **Parallel agents:** Agents 1 (GitHub) and 2 (You.com) now run concurrently instead of sequentially
- **Smart input parsing:** `parseInput()` handles GitHub URLs, owner/repo format, and bare npm package names. `resolvePackageToGitHub()` queries npm registry to find the GitHub repo URL.
- **Composio status endpoint:** `GET /api/composio/status` returns registered tools, orchestration mode, and recent analyses
- **Plivo integration:** Voice XML endpoint, DTMF handler, alert phone configuration, automatic CRITICAL alert triggering
- **Pattern aggregation:** `getPatternInsights()` computes riskFactors and safestCategories across all analyses
- **`orchestration` field:** Each analysis result includes whether it used `composio`, `direct`, or `direct-cached` execution
- **Error handling:** `withRetry()` helper with configurable retries and linear backoff
- **Composio tool registration on startup:** Tools are registered when the server starts if COMPOSIO_API_KEY is set

### `src/services/geminiService.js`
- **Model fallback chain:** Tries `gemini-2.0-flash` → `gemini-2.0-flash-lite` → `gemini-2.5-flash` (replaced dead `gemini-1.5-flash`)
- **Error preservation:** `_synthesize()` catch block now re-throws the original error (preserving `.status` property) instead of wrapping in a new Error, which fixes the model fallback detection
- **404 handling:** Model fallback now triggers on both 429 (rate limited) and 404 (model not found)
- **Auto-downgrades:** Added archived/deprecated repo → automatic F grade

### `src/services/githubService.js`
- Added `isArchived`, `isDeprecated`, `topics`, `description` fields to repo health output
- Deprecated detection checks repo description for "deprecated" keyword and topics for "deprecated"/"unmaintained"

### `src/services/youService.js`
- **`getResultText()` helper:** Concatenates title, description, and snippets array from You.com results for more comprehensive text parsing
- **Improved sentiment query:** Added more keywords (community, developer experience, complaints, praise, quality)
- **Rebuilt alternatives extraction:** Added `looksLikePackageName()` filter with minimum length (3), capitalized-word rejection, and comprehensive stop-word list (~80 words) to filter out English words that aren't package names

### `package.json`
- Added `@composio/core` as dependency
- Added `start`, `dev`, `test` scripts

### `claude.md`
- Updated architecture description to reflect Composio orchestration
- Added composioService.js to project structure
- Updated key design decisions (Composio-first, Gemini model fallback)
- Added `/api/composio/status` endpoint to docs
- Removed "Outstanding Work" section (replaced by thingstofix.md and SPEC_GAP_ANALYSIS.md)

### `thingstofix.md`
- Updated to show completed vs remaining items
