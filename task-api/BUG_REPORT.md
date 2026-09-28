# 🐛 Bug Report

Bugs discovered through writing tests against the codebase. Each was found by
asserting expected behaviour in automated tests and observing the actual result.

---

## Bug 1 — `getByStatus()` uses substring matching instead of strict equality

| | |
|---|---|
| **File** | [`src/services/taskService.js`, line 9](src/services/taskService.js#L9) |
| **Severity** | Medium |
| **Discovered via** | Unit test `getByStatus() → BUG — substring matching` |

### Expected behaviour
`getByStatus('todo')` should return **only** tasks whose `status` is exactly `"todo"`.

### Actual behaviour
The implementation uses `t.status.includes(status)`, which performs **substring
matching**. This means:
- Searching for `"do"` incorrectly matches tasks with status `"done"`
- Searching for `"in"` incorrectly matches `"in_progress"`
- Searching for `"to"` incorrectly matches `"todo"`

### Root cause
```js
// Line 9 — current (buggy)
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```
`String.prototype.includes()` checks if the search string is a **substring**,
not an exact match.

### Suggested fix
```js
// Use strict equality
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

---

## Bug 2 — `getPaginated()` offset calculation skips page 1 ✅ FIXED

| | |
|---|---|
| **File** | [`src/services/taskService.js`, line 12](src/services/taskService.js#L12) |
| **Severity** | High |
| **Discovered via** | Unit test `getPaginated() → page 1 returns the first \`limit\` tasks` |

### Expected behaviour
Requesting `page=1, limit=5` should return items 1–5 (indices 0–4).

### Actual behaviour (before fix)
The original code calculated `offset = page * limit`, so page 1 started at
index **5** instead of **0**, effectively skipping the entire first page.

### Root cause
```js
// Original (buggy)
const offset = page * limit;   // page=1, limit=5 → offset=5 ❌
```

### Fix applied
```js
// Fixed
const offset = (page - 1) * limit;   // page=1, limit=5 → offset=0 ✅
```

This bug is now fixed and verified by both unit and integration tests.

---

## Bug 3 — `completeTask()` silently resets priority to `"medium"`

| | |
|---|---|
| **File** | [`src/services/taskService.js`, line 69](src/services/taskService.js#L69) |
| **Severity** | Medium |
| **Discovered via** | Unit test `completeTask() → BUG — completing a high-priority task resets priority to medium` |

### Expected behaviour
Completing a task should set `status` to `"done"` and populate `completedAt`.
All other fields (including `priority`) should remain unchanged.

### Actual behaviour
The priority is silently overwritten to `"medium"`, regardless of what it was
before. A `high`-priority task becomes `medium` after completion.

### Root cause
```js
// Line 67-72 — current (buggy)
const updated = {
  ...task,
  priority: 'medium',      // ← this line should not be here
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

### Suggested fix
Remove the `priority: 'medium'` line from the spread:
```js
const updated = {
  ...task,
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

---

## Bug 4 — `update()` allows overwriting system-managed fields (`id`, `createdAt`)

| | |
|---|---|
| **File** | [`src/services/taskService.js`, line 50](src/services/taskService.js#L50) |
| **Severity** | Medium-High |
| **Discovered via** | Unit test `update() → BUG — allows overwriting the task id via update` |

### Expected behaviour
Calling `update(id, { id: 'new-id' })` should **ignore** the `id` field (and
other immutable fields like `createdAt`). The API should not allow clients to
mutate system-generated identifiers.

### Actual behaviour
The implementation uses a blind spread (`{ ...tasks[index], ...fields }`) which
allows the caller to overwrite **any** field, including `id` and `createdAt`.

### Root cause
```js
// Line 50 — no field filtering
const updated = { ...tasks[index], ...fields };
```

### Suggested fix
Destructure only the fields that are allowed to be updated:
```js
const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  // Only allow safe fields to be updated
  const { title, description, status, priority, dueDate } = fields;
  const safeFields = {};
  if (title !== undefined) safeFields.title = title;
  if (description !== undefined) safeFields.description = description;
  if (status !== undefined) safeFields.status = status;
  if (priority !== undefined) safeFields.priority = priority;
  if (dueDate !== undefined) safeFields.dueDate = dueDate;

  const updated = { ...tasks[index], ...safeFields };
  tasks[index] = updated;
  return updated;
};
```
