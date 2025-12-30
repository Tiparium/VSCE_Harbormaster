## Local “Working Memory” system (two files, stored in `.context/` at the wrapper root—outside the student repo)
* All important commands must be recorded in `.context/DOCUMENTS.md`.

### File 1: `PROJECT_STATE.md` (small, always read)

**Purpose:** Current working context that should be loaded at the start of every session/task.

**Hard rules:**

* Keep this file **short** (aim ~10–40 lines). It’s a snapshot, not a diary.
* The agent must **read this file before doing any work**.
* The agent should **update this file only when the project state changes** (goal/plan/constraints/etc.), not every message.

**Suggested sections (keep terse):**

* **Goal (current):** what we’re trying to accomplish right now
* **Constraints:** must-follow rules, naming conventions, environment notes
* **Current plan:** 3–7 bullet steps
* **Status:** what’s done / what’s next
* **Open questions:** unknowns blocking progress
* **Assumptions (active):** key assumptions currently being relied upon (bullets)

### File 2: `DECISIONS_LOG.md` (append-only)

**Purpose:** A durable record of important decisions so the project doesn’t “forget why.”

**Rules:**

* Append entries only when something is decided/changed that would matter later.
* Each entry should be short and include:

  * **Date**
  * **Decision**
  * **Reason**
  * **Impact / files touched** (paths if relevant)

**Format example:**

* `2025-12-15 — Decision: Use dual-file memory. Reason: state stays small; decisions stay traceable. Impact: added PROJECT_STATE.md and DECISIONS_LOG.md.`

---

## Required behavior: Assumptions must be surfaced

Whenever the agent takes an action **because of an assumption**, the agent must explicitly state it in its reply, e.g.:

* **Assumption used:** “We’re using Node 20 because the repo targets it.”
* **If unsure:** “This is an assumption—please confirm or correct.”

And if the assumption is new or changed, it must also be added/updated in:

* `PROJECT_STATE.md` → **Assumptions (active)**

---

## Operating loop

1. **Start of session/task:** read `PROJECT_STATE.md`, `PERSONALITY.md`, and `DOCUMENTS.md` (once per session unless you need to edit it or are explicitly told to reread).
2. Do the work.
3. If state changed: update `PROJECT_STATE.md` (keep it compact).
4. If a major notable decision was made (architecture/behavioral choices, not routine maintenance): append to `DECISIONS_LOG.md`.
5. In replies: always surface any **Assumption used** that influenced the work.
