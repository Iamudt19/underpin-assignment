# Task Manager API — Submission Notes

**Candidate:** Udit  
**Date:** 2026-09-29

---

## 📁 Project Structure

```
task-api/
├── src/
│   ├── app.js                  # Express application setup
│   ├── routes/tasks.js         # HTTP route handlers
│   ├── services/taskService.js # Business logic (in-memory store)
│   └── utils/validators.js     # Request body validation
├── tests/
│   ├── taskService.test.js     # Unit tests — service layer
│   ├── api.test.js             # Integration tests — HTTP endpoints
│   └── validators.test.js      # Unit tests — validation functions
├── BUG_REPORT.md               # Detailed bug report for all 4 bugs found
├── SUBMISSION_NOTES.md         # This file
├── jest.config.js
└── package.json
```

---

## ✅ Test Coverage Summary

```
---------------------|---------|----------|---------|---------|---
File                 | % Stmts | % Branch | % Funcs | % Lines |
---------------------|---------|----------|---------|---------|---
All files            |     100 |    90.47 |     100 |     100 |
 src/app.js          |     100 |      100 |     100 |     100 |
 src/routes/tasks.js |     100 |      100 |     100 |     100 |
 src/services/       |     100 |    85.71 |     100 |     100 |
 src/utils/          |     100 |    86.36 |     100 |     100 |
---------------------|---------|----------|---------|---------|---
```

**83 tests | 3 test suites | 100% statement/line/function coverage | 90%+ branch coverage**

---

## 🐛 Bugs Found (4 total)

Full details in [`BUG_REPORT.md`](BUG_REPORT.md).

| # | Bug | Location | Severity | Fixed? |
|---|-----|----------|----------|--------|
| 1 | `getByStatus()` uses substring matching instead of `===` | `taskService.js:9` | Medium | ❌ Documented |
| 2 | `getPaginated()` offset skips page 1 (`page * limit` instead of `(page-1) * limit`) | `taskService.js:12` | **High** | ✅ Fixed |
| 3 | `completeTask()` silently resets priority to `"medium"` | `taskService.js:69` | Medium | ❌ Documented |
| 4 | `update()` allows overwriting `id` and `createdAt` via blind spread | `taskService.js:50` | Medium-High | ❌ Documented |

### Bug I chose to fix: **#2 — Pagination offset**

I chose this one because it's the highest severity — pagination being broken
means the first page of results is completely inaccessible, which would be a
showstopper for any client using the API. The fix was a one-line change
(`page * limit` → `(page - 1) * limit`), and both unit and integration tests
now verify the correct behavior.

---

## 🆕 New Feature: `PATCH /tasks/:id/assign`

### Endpoint

```
PATCH /tasks/:id/assign
Content-Type: application/json

{ "assignee": "Alice" }
```

### Design Decisions

1. **`assignee` is a simple string** — In a real system this might be a user ID or
   reference, but since the spec says "accepts a name (string)", I kept it as a
   plain string. This is the simplest thing that works.

2. **Whitespace trimming** — The assignee name is trimmed before storage. `"  Alice  "`
   becomes `"Alice"`. This prevents accidental whitespace issues.

3. **Empty/whitespace-only strings are rejected (400)** — An empty assignee is
   semantically meaningless, so the API rejects it rather than silently accepting it.

4. **Re-assignment is allowed** — If a task is already assigned, calling the endpoint
   again simply overwrites the assignee. I considered returning a 409 Conflict, but
   decided against it because:
   - The spec doesn't mention "un-assign" functionality
   - Overwrite is the simplest, least surprising behavior
   - Most real task managers allow reassignment freely

5. **Non-string values are rejected (400)** — Numbers, booleans, objects, etc. are
   all rejected to keep the data clean.

6. **Validation in the route layer, storage in the service layer** — Following the
   existing pattern in the codebase where routes handle validation and services
   handle business logic.

### Tests Written

- ✅ Happy path: assigns a person and returns the updated task
- ✅ Trims whitespace from assignee name
- ✅ Re-assigning overwrites the previous assignee
- ✅ Returns 404 for non-existent task
- ✅ Returns 400 for missing assignee
- ✅ Returns 400 for empty string
- ✅ Returns 400 for whitespace-only string
- ✅ Returns 400 for non-string value

---

## 🔮 What I'd Test Next (If I Had More Time)

1. **Concurrency / race conditions** — The in-memory store has no locking. Two
   simultaneous updates to the same task could produce inconsistent state.

2. **Request payload limits** — What happens with extremely long titles or
   descriptions? The API has no max-length validation.

3. **Invalid Content-Type headers** — Sending `text/plain` instead of
   `application/json` and verifying the error handling.

4. **Edge cases around `dueDate` timezone handling** — Dates near midnight in
   different timezones could cause the overdue logic to behave unexpectedly.

5. **Security tests** — Injection via task fields (XSS in title/description),
   prototype pollution via `update()` (e.g., `{ "__proto__": {...} }`).

6. **Performance/load testing** — The in-memory store uses `Array.findIndex()` and
   `Array.filter()` everywhere — O(n) on every operation. This would be a problem
   at scale.

---

## 😲 What Surprised Me

1. **`completeTask()` resetting priority** — This was the sneakiest bug. It's the
   kind of thing that looks correct at a glance (`...task` should preserve everything),
   but the extra `priority: 'medium'` line after the spread silently overwrites it.
   A code review might catch it, but only tests guarantee it.

2. **Substring matching in `getByStatus()`** — Using `.includes()` on a status string
   is a classic "it works until it doesn't" bug. It passes all normal tests
   (`"todo"` matches `"todo"`) but breaks with partial inputs. This is why I believe
   in testing edge cases, not just happy paths.

3. **No data validation on `update()`** — The fact that you can overwrite `id` and
   `createdAt` through the update endpoint surprised me. In production, this would
   be a serious integrity issue.

---

## ❓ Questions I'd Ask Before Shipping to Production

1. **Data persistence** — The in-memory store resets on every restart. Is there a
   plan for a database (Postgres, MongoDB, etc.)?

2. **Authentication & authorization** — Who can create/update/delete tasks? Should
   there be user accounts? Role-based access?

3. **Rate limiting** — Should we add rate limiting to prevent abuse?

4. **Input sanitization** — Are task titles/descriptions ever rendered in a frontend?
   If so, we need XSS protection.

5. **API versioning** — Should we prefix routes with `/api/v1/tasks` for future
   backward compatibility?

6. **Error monitoring** — What observability tools are in place? The error handler
   logs to `console.error`, but production needs structured logging and alerting.

7. **Pagination metadata** — Should paginated responses include `totalCount`,
   `totalPages`, `hasNext` etc.? Most API consumers expect this.
