/**
 * Unit Tests — taskService.js
 *
 * Tests every exported function in the task service directly (no HTTP layer).
 * Discovered bugs are called out with "BUG:" comments where relevant.
 */

const taskService = require('../src/services/taskService');

// ── Helpers ───────────────────────────────────────────────────────────────────

// Reset the in-memory store before every test so they are fully isolated.
beforeEach(() => {
  taskService._reset();
});

// Quick helper to create a task with sensible defaults.
const createSampleTask = (overrides = {}) =>
  taskService.create({
    title: 'Sample Task',
    description: 'A test task',
    priority: 'high',
    ...overrides,
  });

// ── getAll ─────────────────────────────────────────────────────────────────────

describe('getAll()', () => {
  test('returns an empty array when no tasks exist', () => {
    expect(taskService.getAll()).toEqual([]);
  });

  test('returns all tasks that have been created', () => {
    createSampleTask({ title: 'Task 1' });
    createSampleTask({ title: 'Task 2' });

    const all = taskService.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].title).toBe('Task 1');
    expect(all[1].title).toBe('Task 2');
  });

  test('returns a shallow copy — mutating the returned array does not affect the store', () => {
    createSampleTask();
    const all = taskService.getAll();
    all.pop();
    expect(taskService.getAll()).toHaveLength(1);
  });
});

// ── findById ──────────────────────────────────────────────────────────────────

describe('findById()', () => {
  test('returns the correct task when it exists', () => {
    const task = createSampleTask({ title: 'Find Me' });
    const found = taskService.findById(task.id);
    expect(found).toBeDefined();
    expect(found.title).toBe('Find Me');
  });

  test('returns undefined for a non-existent id', () => {
    expect(taskService.findById('does-not-exist')).toBeUndefined();
  });
});

// ── getByStatus ───────────────────────────────────────────────────────────────

describe('getByStatus()', () => {
  test('filters tasks by exact status value', () => {
    createSampleTask({ title: 'A', status: 'todo' });
    createSampleTask({ title: 'B', status: 'in_progress' });
    createSampleTask({ title: 'C', status: 'done' });

    const todos = taskService.getByStatus('todo');
    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe('A');
  });

  test('returns an empty array when no task has the requested status', () => {
    createSampleTask({ status: 'todo' });
    expect(taskService.getByStatus('done')).toEqual([]);
  });

  /**
   * BUG: getByStatus uses String.includes() instead of strict equality (===).
   *
   * This means searching for "do" matches "done", and "in" matches "in_progress".
   * The test below documents this incorrect behaviour.
   *
   * Location: src/services/taskService.js, line 9
   * Root cause: `t.status.includes(status)` performs substring matching.
   * Fix: Replace `.includes(status)` with `=== status`.
   */
  test('BUG — substring matching: filtering by "do" incorrectly matches "done"', () => {
    createSampleTask({ title: 'Todo', status: 'todo' });
    createSampleTask({ title: 'Done', status: 'done' });

    const results = taskService.getByStatus('do');
    // Expected: 0 results (no status is literally "do")
    // Actual: 1 result ("done" contains "do")
    expect(results.length).toBeGreaterThan(0); // documents the bug
  });
});

// ── getPaginated ──────────────────────────────────────────────────────────────

describe('getPaginated()', () => {
  beforeEach(() => {
    for (let i = 1; i <= 15; i++) {
      createSampleTask({ title: `Task ${i}` });
    }
  });

  /**
   * BUG FIX APPLIED: The original code used `page * limit` which meant
   * page 1 would start at offset `limit` instead of 0, skipping the
   * first page of results entirely.
   *
   * Location: src/services/taskService.js, line 12 (now fixed)
   * Fix: Changed to `(page - 1) * limit`
   */
  test('page 1 returns the first `limit` tasks (FIX VERIFIED)', () => {
    const page1 = taskService.getPaginated(1, 5);
    expect(page1).toHaveLength(5);
    expect(page1[0].title).toBe('Task 1');
    expect(page1[4].title).toBe('Task 5');
  });

  test('page 2 returns the next set of tasks', () => {
    const page2 = taskService.getPaginated(2, 5);
    expect(page2).toHaveLength(5);
    expect(page2[0].title).toBe('Task 6');
  });

  test('last page may return fewer items than the limit', () => {
    const page3 = taskService.getPaginated(3, 5);
    expect(page3).toHaveLength(5);
    expect(page3[0].title).toBe('Task 11');
  });

  test('page beyond available data returns an empty array', () => {
    const page100 = taskService.getPaginated(100, 5);
    expect(page100).toEqual([]);
  });
});

// ── getStats ──────────────────────────────────────────────────────────────────

describe('getStats()', () => {
  test('returns zero counts when no tasks exist', () => {
    const stats = taskService.getStats();
    expect(stats).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  test('counts tasks by their status correctly', () => {
    createSampleTask({ status: 'todo' });
    createSampleTask({ status: 'todo' });
    createSampleTask({ status: 'in_progress' });
    createSampleTask({ status: 'done' });

    const stats = taskService.getStats();
    expect(stats.todo).toBe(2);
    expect(stats.in_progress).toBe(1);
    expect(stats.done).toBe(1);
  });

  test('counts overdue tasks (past dueDate + not done)', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    createSampleTask({ status: 'todo', dueDate: yesterday });

    expect(taskService.getStats().overdue).toBe(1);
  });

  test('completed tasks with past dueDate are NOT counted as overdue', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    createSampleTask({ status: 'done', dueDate: yesterday });

    expect(taskService.getStats().overdue).toBe(0);
  });

  test('tasks with future dueDate are NOT counted as overdue', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    createSampleTask({ status: 'todo', dueDate: tomorrow });

    expect(taskService.getStats().overdue).toBe(0);
  });
});

// ── create ────────────────────────────────────────────────────────────────────

describe('create()', () => {
  test('creates a task with all supplied fields', () => {
    const task = createSampleTask({
      title: 'New',
      description: 'desc',
      priority: 'low',
      status: 'in_progress',
      dueDate: '2026-12-31',
    });

    expect(task.title).toBe('New');
    expect(task.description).toBe('desc');
    expect(task.priority).toBe('low');
    expect(task.status).toBe('in_progress');
    expect(task.dueDate).toBe('2026-12-31');
    expect(task.completedAt).toBeNull();
    expect(task.id).toBeDefined();
    expect(task.createdAt).toBeDefined();
  });

  test('applies sensible defaults when optional fields are omitted', () => {
    const task = taskService.create({ title: 'Minimal' });

    expect(task.description).toBe('');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.dueDate).toBeNull();
  });

  test('generates a unique id for every new task', () => {
    const t1 = createSampleTask();
    const t2 = createSampleTask();
    expect(t1.id).not.toBe(t2.id);
  });
});

// ── update ────────────────────────────────────────────────────────────────────

describe('update()', () => {
  test('updates specific fields and preserves the rest', () => {
    const task = createSampleTask({ title: 'Original', priority: 'low' });
    const updated = taskService.update(task.id, { title: 'Updated' });

    expect(updated.title).toBe('Updated');
    expect(updated.priority).toBe('low'); // unchanged
  });

  test('returns null when the task id does not exist', () => {
    expect(taskService.update('nope', { title: 'X' })).toBeNull();
  });

  /**
   * BUG: update() allows overwriting system-managed fields like `id` and `createdAt`.
   *
   * Location: src/services/taskService.js, line 50
   * Root cause: `{ ...tasks[index], ...fields }` blindly merges all caller fields.
   * Fix: Destructure `fields` and omit `id`, `createdAt`, `completedAt`.
   */
  test('BUG — allows overwriting the task id via update', () => {
    const task = createSampleTask();
    const updated = taskService.update(task.id, { id: 'hacked-id' });
    // Expected: id should remain unchanged
    // Actual: id is overwritten
    expect(updated.id).toBe('hacked-id'); // documents the bug
  });
});

// ── remove ────────────────────────────────────────────────────────────────────

describe('remove()', () => {
  test('removes an existing task and returns true', () => {
    const task = createSampleTask();
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.getAll()).toHaveLength(0);
  });

  test('returns false when the task id does not exist', () => {
    expect(taskService.remove('nope')).toBe(false);
  });
});

// ── completeTask ──────────────────────────────────────────────────────────────

describe('completeTask()', () => {
  test('sets status to "done" and populates completedAt', () => {
    const task = createSampleTask({ status: 'in_progress' });
    const completed = taskService.completeTask(task.id);

    expect(completed.status).toBe('done');
    expect(completed.completedAt).toBeDefined();
    expect(new Date(completed.completedAt).getTime()).not.toBeNaN();
  });

  test('returns null for a non-existent id', () => {
    expect(taskService.completeTask('nope')).toBeNull();
  });

  /**
   * BUG: completeTask() silently resets `priority` to "medium".
   *
   * Location: src/services/taskService.js, line 69
   * Root cause: The spread literal includes `priority: 'medium'`.
   * Fix: Remove the `priority` key from the spread so the original
   *       priority is preserved.
   */
  test('BUG — completing a high-priority task resets priority to medium', () => {
    const task = createSampleTask({ priority: 'high' });
    const completed = taskService.completeTask(task.id);
    // Expected: priority should stay "high"
    // Actual: priority is overwritten to "medium"
    expect(completed.priority).toBe('medium'); // documents the bug
  });
});

// ── assignTask (NEW FEATURE) ─────────────────────────────────────────────────

describe('assignTask()', () => {
  test('assigns a person to an existing task', () => {
    const task = createSampleTask();
    const assigned = taskService.assignTask(task.id, 'Alice');

    expect(assigned.assignee).toBe('Alice');
    expect(assigned.id).toBe(task.id);
  });

  test('returns null for a non-existent task id', () => {
    expect(taskService.assignTask('nope', 'Bob')).toBeNull();
  });

  test('re-assigning overwrites the previous assignee', () => {
    const task = createSampleTask();
    taskService.assignTask(task.id, 'Alice');
    const reassigned = taskService.assignTask(task.id, 'Bob');

    expect(reassigned.assignee).toBe('Bob');
  });

  test('preserves all other task fields when assigning', () => {
    const task = createSampleTask({ title: 'Orig', priority: 'high', status: 'in_progress' });
    const assigned = taskService.assignTask(task.id, 'Carol');

    expect(assigned.title).toBe('Orig');
    expect(assigned.priority).toBe('high');
    expect(assigned.status).toBe('in_progress');
  });
});

// ── _reset ────────────────────────────────────────────────────────────────────

describe('_reset()', () => {
  test('clears all tasks from the store', () => {
    createSampleTask();
    createSampleTask();
    taskService._reset();

    expect(taskService.getAll()).toEqual([]);
  });
});
