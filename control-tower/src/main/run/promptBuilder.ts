import { humanDuration } from '@shared/budget'
import { renderOpenTasks } from '@shared/tasks'
import type { IterationKind } from '@shared/types/run'
import type { TaskSummary } from '@shared/types/project'
import { journalTail } from './towerFiles'

export interface PromptContext {
  kind: IterationKind
  workdir: string
  iteration: number
  tasks: TaskSummary
  journal: string
  budgetTotalMs: number
  budgetRemainingMs: number
  /** Set when the previous iteration ran on a different provider. */
  previousProvider?: string
  currentProvider: string
  /** Set when the previous iteration failed, so the agent can react to it. */
  lastFailure?: string
  /** A warm resume keeps native context, so the orientation block is skipped. */
  warmResume: boolean
}

const PREAMBLE = (ctx: PromptContext): string => `You are an autonomous software engineer working INSIDE a single project directory.

ABSOLUTE RULES
1. Your working directory is: ${ctx.workdir}
   Never read, write or execute anything outside it. Never use sudo. Never touch
   global config, the user's shell profile, SSH keys, or anything in $HOME
   outside the working directory.
2. The directory .tower/ is shared memory between you and other AI agents that
   continue your work. Agents from DIFFERENT vendors take turns on this project.
   Assume the next iteration runs on a DIFFERENT model with NO memory of this
   conversation.
3. Before you finish this iteration you MUST:
   a. Update .tower/TASKS.md   (exact line format below — do not deviate)
   b. Append one block to .tower/JOURNAL.md
   c. Run: git add -A && git commit -m "<clear message>"
   Work that is not committed does not exist.
4. Never git push, never change remotes, never rewrite history
   (no rebase, no reset --hard, no force).
5. Do exactly ONE focused unit of work, then stop. Quality over volume.

TASKS.md LINE FORMAT (one task per line, IDs stable, never reused):
    - [ ] T001 | todo | Short imperative description
Status is one of: todo | doing | done | blocked

TIME BUDGET: ${humanDuration(ctx.budgetRemainingMs)} of ${humanDuration(ctx.budgetTotalMs)} remain.
Scope your ambition to what is left. If the budget is nearly spent, make what
already exists work rather than adding anything new.`

const ORIENT = `FIRST, orient yourself by reading, in this order:
  .tower/BRIEF.md    what the user wants — authoritative
  .tower/PLAN.md     the agreed approach
  .tower/TASKS.md    what is done and what is next
  .tower/JOURNAL.md  recent history — read the Summary and the last entries`

export function buildPrompt(ctx: PromptContext): string {
  const parts = [PREAMBLE(ctx), '']

  if (ctx.kind === 'plan') {
    parts.push(PLAN_BODY)
  } else if (ctx.kind === 'review') {
    parts.push(ctx.warmResume ? '' : ORIENT, '', REVIEW_BODY)
  } else {
    parts.push(handoffClause(ctx))
    if (!ctx.warmResume) parts.push('', ORIENT)
    parts.push(
      '',
      'Recent history:',
      journalTail(ctx.journal),
      '',
      'Open tasks:',
      renderOpenTasks(ctx.tasks),
      '',
      CONTINUE_BODY
    )
  }

  if (ctx.lastFailure) {
    parts.push('', `PREVIOUS ITERATION FAILED: ${ctx.lastFailure}`, 'Deal with that before anything else.')
  }

  return parts.filter((p) => p !== '').join('\n').trim()
}

function handoffClause(ctx: PromptContext): string {
  if (ctx.previousProvider && ctx.previousProvider !== ctx.currentProvider) {
    return `You are continuing work started by a previous agent — note that the previous
iteration ran on a DIFFERENT AI model (previous: ${ctx.previousProvider}, now:
${ctx.currentProvider}). You share no conversation history with it. Trust
.tower/ over any assumption you might carry.`
  }
  return 'You are continuing work started by a previous agent.'
}

const PLAN_BODY = `This is iteration 1. The project directory is empty or nearly empty.

Read .tower/BRIEF.md — it holds the user's full description of the application
they want, written by them.

Your job this iteration is ONLY to plan. Do not build the application yet.

1. Write .tower/PLAN.md containing:
   - The goal restated in 3-5 sentences
   - The chosen tech stack, one line of justification per choice
   - High-level architecture: the components and how they relate
   - Explicit non-goals — what is out of scope for this budget
   - Definition of done: observable acceptance criteria, each one something
     that can be checked by running a command
2. Write .tower/TASKS.md: 10-30 tasks in dependency order, in the exact line
   format above, all with status \`todo\`. The FIRST tasks must produce a
   runnable skeleton — project scaffolding, a build, and one passing test — so
   that every later iteration starts from a working baseline.
3. Create the project skeleton, but ONLY as far as: dependency manifest,
   directory structure, and a build/test command that actually runs.
4. Append your first JOURNAL.md block. Commit.

Do not implement features. Stop once the skeleton builds.`

const CONTINUE_BODY = `YOUR TURN:
1. Pick the next unblocked task from TASKS.md (normally the topmost \`todo\`).
   Mark it \`doing\`.
2. Implement it. Write or update tests where they are meaningful.
3. Run the project's build and test commands. If they fail, fix them — leaving
   the tree broken is worse than doing less.
4. Mark the task \`done\`, or \`blocked\` with the reason in its description if
   you genuinely cannot proceed (for example a credential only a human can
   supply).
5. Append to .tower/JOURNAL.md: what you did, the VERIFIED result (name the
   command you ran), what the next agent should do, and any blockers.
6. Commit.

If every task in TASKS.md is \`done\` and the definition of done in PLAN.md is
met, output this exact line on its own line in your final message:
PROJECT_COMPLETE`

const REVIEW_BODY = `This is a REVIEW-AND-REPAIR iteration. Do not add new features.

1. Read .tower/BRIEF.md and .tower/PLAN.md.
2. Get the project into a verified-working state:
   - install and build from clean, if that is cheap here
   - run the full test suite
   - run the linter and type checker
   Fix everything that is broken.
3. Audit honestly against the definition of done in PLAN.md. For each
   acceptance criterion state MET or NOT MET *with evidence*: the command you
   ran and its output. Do not claim something works without running it.
4. For every NOT MET item, add a task to .tower/TASKS.md.
5. Remove dead code, leftover scaffolding and stub TODOs you introduced.
6. Record the audit in .tower/JOURNAL.md. Commit.

Be skeptical of previous iterations, including your own. Agents frequently mark
tasks \`done\` that are not actually done. Verify by executing, not by reading.`
