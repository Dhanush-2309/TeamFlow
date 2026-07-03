# TeamFlow -- Design Decisions

This document covers the domain model, architecture, business rules, and a decisions log with alternatives considered, tradeoffs, and rationale, as required by the assignment brief.

## 1. Domain model

Five primary aggregates: **Projects**, **Tasks**, **Root Cause Analyses (RCAs)**, **Notifications**, and **Users**. Full entity list and purposes are in the schema comments (`server/db/schema.sql`).

Key modelling decisions:

- **Cross-project dependencies.** `task_relations` links `task_id` and `related_task_id` with no constraint that they share a `project_id`. This is what lets a task in Project A block a task in Project B -- the alternative (scoping relations to a single project) would have been simpler to query but would not satisfy the requirement to track tasks "across more than one project."
- **Subtasks vs. dependencies are separate concepts.** `tasks.parent_task_id` models hierarchy (a task belongs to a parent), while `task_relations` models ordering/blocking. Conflating the two (e.g. treating "subtask" as a relation type) would make dependency-conflict queries harder to reason about, since a parent-child link and a blocking link have different semantics for when a task is "ready."
- **RCA sections are rows, not JSON columns.** `rca_sections` has one row per `(rca_id, section_type)` rather than a single JSON blob on `rcas`. This keeps each section independently editable/timestamped and lets the four required sections (timeline, contributing factors, corrective actions, preventive measures) be seeded consistently at RCA creation.
- **Comments and attachments are shared entities.** Both tables use a `CHECK (num_nonnulls(...) = 1)` constraint so a row belongs to exactly one of a task or an RCA, instead of two separate tables per parent type. This directly implements "teams never need to leave the platform for context."
- **Reviews are assignment rows, not a status enum on the RCA.** Each assigned reviewer gets a row in `reviews` with a nullable `decision`. An RCA cannot leave `in_review` while any row has a null decision -- this is the mechanism, not just a business-logic promise, behind "an investigation cannot close until all assigned reviewers have decided."
- **Activity log is append-only and generic.** `activity_log(entity_type, entity_id, actor_id, action, context jsonb)` covers tasks and RCAs (and is extensible to any future entity) with one table instead of a per-entity audit table, since queries against "history for this entity" are the common case and a single indexed table serves that well.

## 2. Architecture

**Monolith over microservices.** A single Express API and single React frontend, backed by one PostgreSQL database. At the scale of "a software engineering team's internal tool," the coordination overhead of independently deployable services (network calls between them, distributed transactions for things like "submit RCA -> assign reviewers -> notify") outweighs the benefit. The codebase is still organised by domain (one route file per resource, one service per cross-cutting concern) so it could be split later if a specific piece -- most plausibly notifications -- needed to scale independently.

**SQL over NoSQL.** The domain is heavily relational: tasks reference projects and users, dependencies are many-to-many between tasks, RCAs reference reviewers with a uniqueness constraint per reviewer, and reporting aggregates across all of this. PostgreSQL's foreign keys, `CHECK` constraints, and `UNIQUE` constraints are used directly to enforce invariants (e.g. "a comment belongs to exactly one parent," "a reviewer can only be assigned once per RCA") at the database layer rather than only in application code -- this is deliberate, since it makes the invariant hold even if a future service bypasses the API layer (e.g. a batch job).

**Synchronous over event-driven, with one explicit internal pipeline.** Most API operations (create task, update status, submit RCA) are synchronous request/response -- there is no message broker. The one place an "event pipeline" exists is `services/notificationService.js`, which is an in-process function, not a separate service. This was a deliberate scope decision: a real event bus (Kafka/SQS) would help if notification volume or delivery retries became a bottleneck, but for the stated scale it adds operational complexity (a broker to run, monitor, and reason about) without a corresponding benefit. The notification function is written so a future move to an actual queue only requires swapping what happens after the `INSERT ... ON CONFLICT DO NOTHING` dedupe check.

**File storage.** Attachments are stored on local disk in development (`server/src/services/storage.js`), addressed only by an opaque `storageKey`. No other module touches the filesystem directly. In a production deployment this module would be swapped for an S3/GCS client with the same two functions (`saveBuffer`, `readBuffer`); nothing in the routes or schema would change, since `attachments.storage_path` already stores an opaque key rather than a local path assumption.

## 3. Business rules and functional thinking

**Task status transitions** follow a fixed state machine (`services/taskRules.js`): `backlog -> in_progress -> review -> done`, with `done -> in_progress` allowed to reopen work. Attempting an invalid transition (e.g. `backlog -> done`) returns `422` and is rejected -- every status change that succeeds is logged with `{from, to}` in `activity_log`, so project history is trustworthy rather than reconstructed after the fact.

**Dependency conflicts and assignee overload** are computed on every task write and returned as `warnings` in the API response, but never block the write. This was an explicit product choice: blocking on "you have too many active tasks" or "this task is still blocked" would fight how teams actually work under deadline pressure, so the system surfaces the signal instead of enforcing it.

**Reviewer unavailable / review process incomplete.** If a reviewer cannot complete a review, an owner resubmits the RCA with an updated reviewer list; this clears prior review rows and re-assigns from scratch, so a stalled review doesn't require any special "skip" logic. An RCA that receives at least one `rejected` decision (once **all** reviewers have decided) moves to `rejected`, not `closed` -- the author must revise sections and resubmit, ensuring no RCA can be waved through by a majority vote while a documented objection exists.

**Notification behaviour.** Every event (`task_assigned`, `task_status_changed`, `rca_submitted`, `rca_review_decision`, `mention`) is written to `notifications` with a dedupe key before dispatch. The `UNIQUE` constraint on `dedupe_key` makes duplicate suppression atomic even if the same event is processed twice. Per-user `email_opt_out` is checked before the email channel is attempted, but the in-app channel is always created -- alerts should not vanish entirely just because a user turned off email.

**Permissions.** Every project-scoped route (`requireProjectMember`) checks the caller is a member of the target project before doing anything else; only an `owner` can add members. Reviewer assignment for RCAs is intentionally left open to any project member being selectable as a reviewer, rather than a separate reviewer role, since the brief scoped roles at the "owner / member" level.

## 4. Design decisions log

| Decision | Alternatives considered | Tradeoff | Rationale |
| --- | --- | --- | --- |
| Task progression via a fixed state machine, enforced server-side | (a) Fully free-form status field with no transition rules; (b) A configurable workflow engine per project | (a) is more flexible but produces unreliable history; (b) is more powerful but is significant added scope for a first release | Chose the fixed machine: less ad-hoc flexibility, but project history stays trustworthy and the rule is simple enough to unit test exhaustively |
| Notifications logged before dispatch, deduped via a unique key | (a) Dispatch first, log for audit after; (b) At-least-once delivery with client-side dedup | (a) risks a crash between dispatch and log producing an untracked send; (b) pushes complexity to every client | Log-then-dispatch with a DB-enforced unique constraint gives a short delivery delay in exchange for a guarantee users never see the same alert twice |
| RCA cannot close until all assigned reviewers decide | (a) Majority-vote auto-resolve; (b) First-decision-wins | Both are faster to resolve but let a documented dissent be overridden | Resolution may take longer, but no RCA can be dismissed without every assigned reviewer's documented sign-off |
| Dashboard figures computed live per request | (a) Precomputed/cached aggregates refreshed on a schedule; (b) Separate analytics database | Both are faster at scale but introduce staleness or infrastructure the brief's scale doesn't yet justify | Always current, at the cost of slower loads on very large projects -- acceptable now, flagged as a future improvement |
| Comments/attachments as shared tables with a single-parent CHECK constraint | Separate `task_comments` / `rca_comments` tables | Separate tables avoid a nullable-column CHECK but duplicate the comment/attachment logic (and any future feature like reactions or edits) twice | One shared implementation keeps comments and attachments available on tasks and investigations "from day one" without duplicated code paths |
| All three views (Kanban/calendar/list) read the same `GET /tasks` response | Per-view endpoints with view-specific shaping | Per-view endpoints could be leaner payloads, but risk the views drifting out of sync (e.g. a filter applied in one view not reflected in another) | Slightly heavier client-side transitions, but every view always reflects the same state with no separate sync path |
| Local disk storage behind an opaque `storageKey`, swappable for object storage | (a) Store files directly in Postgres as `bytea`; (b) Integrate S3 directly now | (a) bloats the primary database and complicates backups; (b) adds a cloud dependency and credentials to manage for a local dev/demo setup | Disk storage behind a two-function interface gets working attachments immediately while keeping the swap to real object storage a one-file change |
| Monolithic Express API + single Postgres database | Microservices split by domain (tasks service, RCA service, notification service) | Microservices scale and deploy independently but add network calls, distributed transactions, and operational overhead | At this scale, a well-organised monolith (one route/service file per domain) delivers the same separation of concerns without the distributed-systems tax |

## 5. Future improvements (carried over from the product brief)

- **Collaboration:** presence indicators; threaded comment replies.
- **Planning:** drag-adjustable timeline/Gantt view; workload forecasting; recurring tasks.
- **Governance:** configurable multi-tier RCA approval chains; policy-based task routing; scheduled compliance reports.
- **Intelligence:** anomaly detection on delivery patterns; cross-project trend analysis; predictive due-date recommendations.
