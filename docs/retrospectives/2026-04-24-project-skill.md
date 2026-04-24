# From Stale Docs to a Living Project Skill

DepScope already had plenty of words around it. What it did not have was one place I could trust. The repo summary in `claude.md` still described a sequential pipeline, some roadmap notes still implied the frontend was not wired to live APIs, and the implementation had clearly moved on.

This session was about turning that drift into something future agents and developers can actually lean on: a project skill that describes the code as it exists now, explains why it is shaped that way, and points straight at the owning files.

## The Starting Point

The first thing I did was resist the temptation to write the skill from the nearest doc. That is how stale documentation gets copied forward.

Instead, I started with the local skill tooling in `.claude/skills/skill-creator/`, then traced the smallest set of files that actually control behavior:

- `src/server.js` for orchestration, routes, SSE, reports, Plivo, and watchlist flow
- `src/services/composioService.js` for the Composio-first path
- `src/services/geminiService.js` for scoring and downgrade rules
- `Frontend/src/lib/api.ts` and `Frontend/src/hooks/useAnalysis.ts` for the real frontend/backend contract
- `PROJECT_OVERVIEW.md` and `workflow.md` for rationale that the code alone would not explain

That immediately surfaced the core mismatch: the docs were describing an earlier architecture than the one the code was running.

```js
const cached = getCachedData(packageName);
const useComposio = !!process.env.COMPOSIO_API_KEY;

if (useComposio) {
  try {
    const { repoHealth, research, assessment } = await orchestrate(...);
    Object.assign(entry, { orchestration: 'composio', ...assessment });
    return;
  } catch (composioErr) {
    broadcastSSE(analysisId, { agent: 'system', status: 'warning', ... });
  }
}
```

That snippet from `src/server.js` tells a more important story than any summary paragraph: DepScope is not a simple sequential three-step script anymore. It is a Composio-first pipeline with a direct fallback path and cached demo data behind that.

## Step 1: Trace the Truth Back to the Owning Files

My goal was not to write a comprehensive architecture book. It was to create the shortest possible path from a future change request to the right code.

That pushed me toward a simple rule: every important statement in the new skill had to be justified either by code that currently runs or by a product/rationale document that still matches that code.

That led to a few useful corrections:

- `claude.md` said the agents were sequential; the code runs Agent 1 and Agent 2 in parallel.
- older docs mentioned older Gemini models; `src/services/geminiService.js` now falls back from `gemini-3-flash-preview` to `gemini-2.5-flash`.
- the frontend was no longer a mock shell; it was already using `fetch()` and SSE against the live backend.

None of those are cosmetic mismatches. They change how you debug latency, how you reason about failures, and where you go to modify behavior.

## Step 2: Design the Skill Around How Future Work Actually Starts

The easiest mistake with a project skill is turning it into a giant README with a new filename. That sounds helpful until another agent has to load the whole thing just to answer, "where do I change the watchlist scan flow?"

I split the skill into four pieces instead:

- `SKILL.md` for the operating rules, routing guidance, and validation commands
- `references/architecture.md` for current behavior and the why behind it
- `references/code-map.md` for file ownership
- `references/gotchas.md` for the traps that are easy to reintroduce

The interesting part is not the split itself. It is why the split matters: most future tasks will need one of those views, not all of them.

```md
## Start Here

1. Read `references/architecture.md` before changing backend flow, scoring, alerts, environment variables, or deployment behavior.
2. Read `references/code-map.md` to jump to the owning file for the surface you are touching.
3. Read `references/gotchas.md` before changing Composio orchestration, docs, watchlist behavior, or the frontend/backend contract.
4. Update this skill in the same change whenever you add, remove, or rename services, routes, models, env vars, or design constraints.
```

That is the part I care about most. It turns the skill from passive documentation into active workflow guidance.

## The Gotcha: A Project Skill Can Drift on Day One if You Do Not Validate It

I used the repo's own `init_skill.py` to create the scaffold instead of hand-rolling the folder. That gave me the right structure, but it also generated placeholder files and directories that were not useful for DepScope. I deleted the placeholder script and asset, replaced the sample reference doc with real references, and then ran the repo's packager as the first real check.

That mattered for two reasons.

First, it proved the frontmatter and file layout were actually acceptable to the skill tooling. Documentation that cannot be loaded is just dead weight.

Second, the packaging step created a `.skill` artifact at the repo root. That is a small thing, but it is exactly the kind of artifact that quietly pollutes a working tree if you do not clean it up after validation.

The more important gotcha was conceptual: if I added the project skill without also updating `claude.md`, I would have created two sources of truth on the same day. One new, one stale. That is worse than having only one stale doc.

## Step 3: Update the Short Summary Too

I treated `claude.md` as the repo's fast path. Some sessions and tools will read that file before they ever load a repo skill, so it needed to stop contradicting the code.

I updated it to reflect:

- Composio-first orchestration
- parallel Agent 1 and Agent 2 execution
- report generation and publish endpoints
- watchlist routes and alert flow
- the existence of the new `.claude/skills/depscope-project` skill as the deeper source of truth

This is one of those boring changes that saves a surprising amount of debugging later. A concise summary only helps if it is true.

## What I Would Fix Next

Two follow-ups are worth doing while the architecture is fresh in mind.

The first is the `/debug` endpoint mismatch. `src/server.js` reports `youConfigured` from `YOU_API_KEY`, but the actual configured variable is `YOU_COM_API_KEY` in both `src/config.js` and `src/services/youService.js`. That is the kind of tiny inconsistency that wastes time during deployment debugging.

The second is broader doc cleanup. `ROADMAP.md` and a few other files still mix future intent with old implementation assumptions. The new project skill makes future work safer, but it does not eliminate the need to retire stale prose elsewhere.

## What's Next

The new skill is only valuable if it keeps moving with the code. The next meaningful backend or frontend change should update it in the same commit, especially if it changes:

- orchestration mode
- service ownership
- model choice
- API routes or payloads
- environment variables
- persistence assumptions

That is the real lesson from this session: the hardest part of project documentation is not writing it. It is deciding which file future you is supposed to believe.

---

The best project memory is not the longest doc. It is the one the next engineer can trust enough to stop guessing.