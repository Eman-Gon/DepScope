# DepScope Integrations

## Runtime Integrations

| Integration | Required env | Used for | Notes |
|---|---:|---|---|
| GitHub REST API | `GITHUB_TOKEN` recommended | Repository health, contributors, releases, write access, `DEPSCOPE.md` publishing | Unauthenticated requests work for small demos but hit rate limits quickly. |
| npm registry | none | Bare package resolution, package metadata, latest version, deprecation, maintainers | Also feeds the external research payload for Gemini. |
| OSV.dev | none | Authoritative vulnerability lookup for npm packages | Queried before Tavily so security findings are not based on generic search snippets. |
| GitHub Security Advisories | `GITHUB_TOKEN` optional | GHSA/CVE metadata, severity, affected ranges, patched versions, CVSS/CWE/EPSS | Public data can be fetched without a token, but the token improves rate limits. |
| Tavily Search | `TAVILY_API_KEY` | Community sentiment, alternatives, supplemental security context | Contextual web research only; it should not override OSV/GHSA data. |
| Gemini API | `GEMINI_API_KEY` | Final risk synthesis, scoring, findings, alternatives, verdict | Fallback chain currently tries `gemini-3-flash-preview`, then `gemini-2.5-flash`. |
| Composio | `COMPOSIO_API_KEY` optional | Optional custom-tool orchestration for the three-agent flow | Direct execution remains the fallback path. |
| Render | `PORT`, service env vars | Single container hosting frontend and backend | Express serves `Frontend/dist` and API routes from the same process. |

## Removed Integrations

Plivo phone and SMS alerts have been removed. Watchlist failures are now reported through scan history and the dashboard/API only.

You.com search has been replaced by the research stack above.
