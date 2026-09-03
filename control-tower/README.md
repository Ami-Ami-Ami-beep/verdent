# Control Tower

A desktop app that drives several AI coding CLIs to build software autonomously.

You describe an app, give it a time budget ("you have 10 hours"), and press Start.
Control Tower runs your coding CLIs in a loop until the work is done — and when the
preferred one runs out of quota, it moves to the next and comes back automatically
once the limit resets. Several projects can run at once.

- **Provider failover.** Claude Code first; on quota exhaustion it switches to the
  next CLI in the chain, and re-promotes the preferred one when its window reopens.
- **Time budget.** Only working time is billed — pauses and time queued behind
  another project are free.
- **Live view.** Task list, streaming log, iteration timeline, and which provider
  is running right now.
- **Everything is committed.** Every iteration ends in a git commit, so any state
  can be recovered and inspected.

## Requirements

- Node 20+ (developed on 22)
- git
- At least one agent CLI installed and logged in (`claude`, and optionally others)

## Running it

```bash
npm install
npm run dev      # start the app
npm test         # 60 tests, none of which spend any quota
npm run build    # typecheck + production build
```

## First run

1. **Settings → verify a provider.** `claude` ships with a working argv template;
   press **Verify**. That resolves the binary, records the version, shows the CLI's
   own `--help`, and does a real dry run in a scratch directory. A provider that has
   not been verified cannot be started — finding a wrong flag ten hours into a
   budget is exactly the failure this prevents.
2. `gemini` and `codex` ship as **unverified placeholders with no argv template**,
   because their flags were not verified when this was written. Run `gemini --help`,
   fill the template in beside it, and verify.
3. **New project.** Name, folder, a detailed brief, a budget, and the autonomy
   confirmation. Start it.

## How continuity survives a provider switch

Every CLI invocation is a fresh process with no memory of the last one — and the
next one may be a different vendor's model entirely. So the working state lives in
files inside the project, not in a chat history:

```
<project>/.tower/
  BRIEF.md      your request and budget; written once, read-only for agents
  PLAN.md       architecture and approach, written in the planning iteration
  TASKS.md      the work breakdown, in a strict parseable format
  JOURNAL.md    one appended block per iteration
  STATE.json    machine-readable pointer, written by the app
```

Every prompt starts by telling the agent to read those. Where a CLI supports it
(`claude --resume`), the same provider keeps its native context as a fast path, but
`.tower/` stays authoritative and a cold restart is forced every 10 iterations.

## Quota detection, and the trap it avoids

An agent that is *building* a rate-limited API will legitimately print "rate limit",
"quota" and "429". Reading that as exhaustion would park a healthy provider for
hours. Four layers prevent it:

1. Only the error channel is classified — structured error events, or the tail of
   stderr. Assistant prose never reaches the classifier.
2. A pattern hit needs a corroborating failure signal (non-zero exit, or a
   structured error).
3. A run longer than two minutes that also used tools is downgraded to a task
   failure. Quota rejections come back in seconds.
4. Every decision is logged with the pattern that matched, so a wrong call leaves
   evidence.

The patterns are editable in Settings, next to a box where you can paste a real
error message and see how it would be judged. Expect to tune them after the first
genuine limit — reproducing one otherwise means exhausting your plan.

## Safety

- The workdir must sit inside your projects root. An existing git repository the
  app did not create is refused, so an agent can never be aimed at your real work.
- Autonomy is off until you confirm it per project. Two levels: an allowlist of
  commands (default), or full command access inside the folder.
- The child environment is built from an allowlist, so unrelated tokens in your
  shell do not leak into a third-party CLI.
- Agents run as their own process group; Stop reaps the entire tree, and pids are
  recorded to disk so a crash of the app itself cannot leave orphans behind.

**Not solved:** the agent has network access and installs packages of its choosing.
Confining it to a folder does not protect you from a malicious dependency. Running
this inside a container or VM is the real fix and is the first thing worth adding.

## Testing without spending quota

`tools/mock-agent/mock-agent.js` is registered like any other provider and behaves
like a real agent — it reads `.tower/`, ticks a task, writes a file, and commits —
with per-iteration behaviour driven by a scenario file. The suite uses it to cover
failover and cooldown, the "prose that mentions 429" false-positive case, an agent
that claims success without committing, timeouts, auth failures, budget exhaustion,
and that a killed agent takes its own child processes with it.
