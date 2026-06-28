# TimeBank Web Application Design

## 1. Purpose

TimeBank is a small self-hosted web application for two primary-school-aged
children. Each child records completed learning, reading, or household tasks
and immediately receives a configured amount of entertainment time. After
using entertainment time in daily life, the child returns to the application
and redeems the time from their balance.

The application runs on a family macOS or Windows computer and is accessed from
each child's dedicated iPad over the home LAN. It prioritizes simple touch
interaction, clear information, and a warm, playful visual style.

## 2. Product Principles

- A completed task is worth a fixed amount of entertainment time.
- Task completion credits the balance immediately; there is no parent approval
  step and no separate exchange action.
- Each child can view and operate only their own account.
- The web interface never edits configuration or transaction history.
- Parents manage tasks and repair data by editing local files while the service
  is stopped, then restarting it.
- Transaction history is the source of truth. Balances are always derived from
  history rather than stored independently.
- The first release stays focused on task check-ins, balances, redemption, and
  readable history.

## 3. Scope

### 3.1 Included

- Two or more YAML-configured child accounts with avatars and four-digit PINs.
- Tasks with a category, fixed duration, fixed entertainment reward, applicable
  children, enabled state, and per-child daily completion limit.
- Immediate task check-in and balance credit.
- Entertainment redemption using configured fixed-duration options.
- Personal transaction history with month and record-type filters.
- Long-lived login sessions suited to a dedicated iPad.
- iPad touch layouts in portrait and landscape.
- Home-screen icon and standalone-display metadata.
- macOS and Windows startup instructions and scripts.
- Local CSV data files that parents can inspect and repair.

### 3.2 Excluded

- Parent accounts or an administration interface.
- Web-based editing of configuration or transaction data.
- Approval workflows.
- Rankings, levels, badges, streaks, or competitive scoring.
- Entertainment categories, timers, notifications, or offline submissions.
- Multi-family tenancy, cloud synchronization, or remote internet access.
- Docker or desktop-application packaging as a required deployment path.
- Offline PWA behavior. Home-screen launch is supported, but the family computer
  and LAN must be available.

## 4. Technology and Architecture

The application uses a TypeScript monorepo-style project:

- React provides the browser user interface.
- Express provides authentication and business APIs.
- Shared TypeScript schemas and types define configuration, records, and API
  contracts.
- YAML stores configuration.
- One CSV file per child stores transactions.

The Express server serves both the production React assets and the JSON API, so
the family runs a single process and visits a single LAN address. The service
listens on a configurable host, defaulting to all local interfaces for LAN
access.

The server loads and validates all configuration and transaction files before
opening the business interface. It then derives each child's balance and daily
task counts from that child's complete transaction history.

## 5. Configuration

The default configuration file is `config/config.yaml`. It contains:

- `children`: stable ID, display name, avatar, four-digit PIN, and enabled state.
- `tasks`: stable ID, name, category, fixed task duration in minutes, reward in
  entertainment minutes, applicable child IDs or all children, daily limit,
  and enabled state.
- `redemptionOptions`: allowed fixed redemption amounts in minutes.
- `encouragements`: messages selected after successful task completion.
- `session`: sliding session lifetime, defaulting to 30 days.
- Optional server settings such as host and port.

PIN values may be stored directly in YAML because this is a low-risk home LAN
application. They must never be returned by APIs, stored in browser storage, or
printed in logs.

Configuration changes take effect only after restarting the service.

## 6. Transaction Data

Each child has an independent file:

```text
data/records/<child-id>.csv
```

The columns are:

```text
id,request_id,timestamp,child_id,record_type,task_id,task_name,task_minutes,entertainment_minutes,note
```

Supported `record_type` values are:

- `task_checkin`: a positive `entertainment_minutes` value.
- `entertainment_redeem`: a negative `entertainment_minutes` value.

Task records retain `task_name` and `task_minutes` snapshots so later YAML
changes do not alter the meaning of history. Redemption records leave task
fields empty. Timestamps use ISO 8601 with an explicit offset. `id` is a
server-generated stable record ID. `request_id` is the client-generated
idempotency key and must be unique within the child's file. Parent-authored
repair or adjustment rows may leave `request_id` empty.

A child's balance is the sum of `entertainment_minutes` across all rows in that
child's file. The service does not maintain a separate balance file.

Parents repair data by stopping the service, editing or deleting CSV rows, and
restarting. If repaired history produces a negative balance, the service loads
and displays it without silently changing it, but blocks further redemption
until the balance is non-negative.

## 7. Authentication and Authorization

The login page presents enabled child avatar cards. Selecting an avatar opens a
large numeric keypad. Entering four digits submits automatically.

Successful login creates a signed `HttpOnly`, `SameSite=Lax` cookie scoped to
the application. The cookie contains only the minimum session identity and
expiry data needed by the server; it contains no PIN. Its signing secret is a
local deployment setting and remains stable across ordinary service restarts.
The session uses a configurable sliding lifetime of 30 days by default. Each
authenticated request renews the expiry. Explicit logout invalidates the
session immediately in that browser.

Every API operation derives the child identity from the verified signed
session cookie. Clients cannot request another child's balance, task state,
history, check-in, or redemption. There is no cross-child view in the web
application.

Incorrect PIN entry causes a short visual shake and clears the keypad. The
server applies a modest per-IP and per-account attempt rate limit without
long-term account lockout.

## 8. Business Rules and Data Flow

### 8.1 Task Check-In

1. The client sends the selected task ID and a unique request ID.
2. The server verifies the session, task existence, enabled state, applicability
   to the current child, and the local-calendar daily completion limit.
3. The server rejects a previously processed request ID.
4. The server appends one `task_checkin` row to the child's CSV.
5. Only after the durable append succeeds does the API return the updated
   balance and task state.
6. The client shows a short confetti animation and a random encouragement.

Partial completion is not supported. A child checks in only after completing
the task's configured fixed duration.

### 8.2 Entertainment Redemption

1. The child opens the redemption panel.
2. The panel shows configured fixed amounts such as 15, 30, and 60 minutes.
3. Options greater than the current balance are disabled.
4. After confirmation, the client sends the amount and a unique request ID.
5. The server validates that the amount is configured and the balance is
   sufficient, then appends an `entertainment_redeem` row.
6. The API returns the updated balance and the client displays confirmation.

Redemption records only the child, time, and number of minutes. It does not
record an entertainment category.

### 8.3 Dates

Daily task limits use the family computer's configured local timezone and local
calendar date. The server is authoritative; the iPad clock is not used for
limits or transaction timestamps.

## 9. User Experience

### 9.1 Visual Direction

The approved direction is "Warm Card Playground":

- soft warm background colors;
- large rounded cards and controls;
- friendly category colors;
- strong contrast and large touch targets;
- playful illustrations and motion used sparingly;
- clear information hierarchy without game-like levels or rankings.

### 9.2 Login

- Child avatar cards are the primary choices.
- The selected child sees a large, touch-friendly PIN keypad.
- Error feedback is friendly and does not expose account details.

### 9.3 Personal Home

- Header: avatar, child name, and logout.
- Primary card: current entertainment balance in large type.
- Task cards grouped by categories such as learning, reading, and household
  chores.
- Each task card shows name, fixed duration, reward, and today's completion
  count versus limit.
- Selecting a task opens a confirmation sheet before check-in.
- A prominent redemption action opens the fixed-option panel.
- A secondary action opens personal transaction history.

### 9.4 Personal History

- Reverse chronological order.
- Clear visual distinction between task rewards and entertainment redemption.
- Each entry shows timestamp, task name where applicable, minute change, and
  resulting balance.
- Filters include month and record type.
- No edit or delete controls.

### 9.5 iPad Home Screen

The app supplies a web manifest, icons, theme color, Apple touch icon, and
standalone-display metadata. It supports being added to the iPad home screen
and opening without normal browser chrome where iPadOS permits. The service is
still online-only over the LAN; no transaction is queued while disconnected.

## 10. Reliability and Error Handling

- The server performs all authorization and business validation.
- Each child's CSV has its own in-process write queue. Writes for different
  children are isolated, while concurrent writes for the same child remain
  ordered.
- A record is fully serialized before append, and success is returned only
  after the append is flushed successfully.
- Unique request IDs make retries idempotent and protect against double taps.
- Buttons remain disabled while requests are in progress.
- A timestamped backup of each child CSV is created at application startup.
  The newest 10 startup backups per child are retained by default.
- Invalid YAML prevents the business service from starting and reports the
  exact configuration path.
- Invalid CSV reports the child file and row number. Duplicate IDs, malformed
  values, duplicate non-empty request IDs, mismatched child IDs, invalid record
  types, and unknown children are startup errors.
- When a request loses network connectivity, the UI states that the operation
  was not confirmed and asks the child to retry. The client does not queue
  offline writes.
- Unexpected API errors use friendly child-facing messages while technical
  details remain in the computer terminal.

## 11. File Ownership and Manual Editing

The service assumes exclusive write ownership of CSV files while running.
Documentation instructs parents to stop the service before editing YAML or CSV.
This avoids conflicts between spreadsheet editors and application writes.

CSV fields are quoted according to standard CSV rules, allowing names and notes
to contain commas. A sample configuration and initial header-only CSV files are
included.

## 12. Testing Strategy

### 12.1 Unit Tests

- Configuration and CSV schema validation.
- Balance derivation from transaction history.
- Task applicability and daily limits.
- Reward calculation from fixed task configuration.
- Fixed-option redemption and insufficient-balance rejection.
- Local-date boundary behavior.
- Request ID idempotency.

### 12.2 Service Integration Tests

- PIN login, sliding session renewal, expiry, and logout.
- Cross-child access rejection.
- Check-in and redemption file appends.
- Concurrent requests for one child are ordered and not lost.
- Different child files remain isolated.
- Startup behavior for malformed YAML and CSV.
- Negative repaired balances load but cannot be redeemed.

### 12.3 Frontend Tests

- Avatar and PIN login flow.
- Home balance and task-state rendering.
- Check-in confirmation, loading lock, success animation, and error feedback.
- Redemption option enablement and confirmation.
- Personal history filtering.

### 12.4 End-to-End Smoke Test

A browser-level test covers login, one task check-in, balance increase, one
redemption, history display, logout, and denial of another child's data.

## 13. Deployment and Operations

- Supported host systems: current macOS and Windows versions capable of running
  the selected Node.js LTS release.
- Development and production startup use documented package scripts.
- Platform launch scripts provide a simple entry point after initial dependency
  installation.
- On startup, the terminal prints local access URLs and the locations of loaded
  configuration and data files.
- The setup guide covers firewall permission, finding the host computer's LAN
  address, adding the site to the iPad home screen, stopping the service before
  file edits, and restoring a backup.
- The application has no required cloud service or runtime internet dependency.

## 14. Acceptance Criteria

The first release is complete when:

1. Each configured child can log in from their own iPad with avatar and PIN.
2. A child can see only their own balance, tasks, daily counts, and history.
3. A valid task check-in immediately appends a CSV row and credits the exact
   configured reward.
4. Daily limits are enforced by the server.
5. A child can redeem only configured fixed amounts that do not exceed balance.
6. Restarting after a parent CSV edit recalculates the displayed balance from
   the edited history.
7. Invalid configuration or transaction files fail with actionable file and
   row or field diagnostics.
8. Concurrent operations do not lose or duplicate confirmed records.
9. The interface is usable in iPad portrait and landscape and can be launched
   from a home-screen icon.
10. The documented setup works on both macOS and Windows without Docker or a
    cloud dependency.
