/**
 * Integration Tests — API Routes (Supertest)
 *
 * Every endpoint is tested through the full HTTP stack with Supertest.
 * Happy paths + edge cases for each route.
 */

const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

// Reset the in-memory store between tests so they are fully isolated.
beforeEach(() => {
  taskService._reset();
});

// ── Helper ────────────────────────────────────────────────────────────────────

const samplePayload = (overrides = {}) => ({
  title: 'Integration Task',
  description: 'For testing',
  priority: 'high',
  ...overrides,
});

// ── POST /tasks ───────────────────────────────────────────────────────────────

describe('POST /tasks', () => {
  test('creates a task and returns 201', async () => {
    const res = await request(app)
      .post('/tasks')
      .send(samplePayload())
      .expect(201);

    expect(res.body).toMatchObject({
      title: 'Integration Task',
      description: 'For testing',
      priority: 'high',
      status: 'todo',
      completedAt: null,
    });
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });

  test('applies default values when optional fields are omitted', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Minimal' })
      .expect(201);

    expect(res.body.status).toBe('todo');
    expect(res.body.priority).toBe('medium');
    expect(res.body.dueDate).toBeNull();
  });

  test('rejects a request with no title (400)', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ description: 'no title here' })
      .expect(400);

    expect(res.body.error).toMatch(/title/i);
  });

  test('rejects a request with an empty title (400)', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: '   ' })
      .expect(400);

    expect(res.body.error).toMatch(/title/i);
  });

  test('rejects an invalid status value (400)', async () => {
    const res = await request(app)
      .post('/tasks')
      .send(samplePayload({ status: 'invalid_status' }))
      .expect(400);

    expect(res.body.error).toMatch(/status/i);
  });

  test('rejects an invalid priority value (400)', async () => {
    const res = await request(app)
      .post('/tasks')
      .send(samplePayload({ priority: 'urgent' }))
      .expect(400);

    expect(res.body.error).toMatch(/priority/i);
  });

  test('rejects an invalid dueDate (400)', async () => {
    const res = await request(app)
      .post('/tasks')
      .send(samplePayload({ dueDate: 'not-a-date' }))
      .expect(400);

    expect(res.body.error).toMatch(/dueDate/i);
  });
});

// ── GET /tasks ────────────────────────────────────────────────────────────────

describe('GET /tasks', () => {
  test('returns an empty array when no tasks exist', async () => {
    const res = await request(app).get('/tasks').expect(200);
    expect(res.body).toEqual([]);
  });

  test('returns all tasks', async () => {
    await request(app).post('/tasks').send(samplePayload({ title: 'A' }));
    await request(app).post('/tasks').send(samplePayload({ title: 'B' }));

    const res = await request(app).get('/tasks').expect(200);
    expect(res.body).toHaveLength(2);
  });
});

// ── GET /tasks?status=... ─────────────────────────────────────────────────────

describe('GET /tasks?status=<value>', () => {
  beforeEach(async () => {
    await request(app).post('/tasks').send(samplePayload({ title: 'Todo', status: 'todo' }));
    await request(app).post('/tasks').send(samplePayload({ title: 'Prog', status: 'in_progress' }));
    await request(app).post('/tasks').send(samplePayload({ title: 'Done', status: 'done' }));
  });

  test('filters tasks by status', async () => {
    const res = await request(app).get('/tasks?status=in_progress').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Prog');
  });

  test('returns empty array for a status that has no tasks', async () => {
    // Delete everything then add one
    taskService._reset();
    await request(app).post('/tasks').send(samplePayload({ status: 'todo' }));

    const res = await request(app).get('/tasks?status=done').expect(200);
    expect(res.body).toEqual([]);
  });
});

// ── GET /tasks?page=&limit= ──────────────────────────────────────────────────

describe('GET /tasks?page=&limit= (pagination)', () => {
  beforeEach(async () => {
    // Create 12 tasks
    for (let i = 1; i <= 12; i++) {
      await request(app).post('/tasks').send(samplePayload({ title: `T${i}` }));
    }
  });

  test('page 1, limit 5 returns the first 5 tasks', async () => {
    const res = await request(app).get('/tasks?page=1&limit=5').expect(200);
    expect(res.body).toHaveLength(5);
    expect(res.body[0].title).toBe('T1');
    expect(res.body[4].title).toBe('T5');
  });

  test('page 2, limit 5 returns the next 5 tasks', async () => {
    const res = await request(app).get('/tasks?page=2&limit=5').expect(200);
    expect(res.body).toHaveLength(5);
    expect(res.body[0].title).toBe('T6');
  });

  test('page 3, limit 5 returns the remaining 2 tasks', async () => {
    const res = await request(app).get('/tasks?page=3&limit=5').expect(200);
    expect(res.body).toHaveLength(2);
  });

  test('page beyond data returns an empty array', async () => {
    const res = await request(app).get('/tasks?page=100&limit=5').expect(200);
    expect(res.body).toEqual([]);
  });

  test('defaults to page 1 limit 10 when values are invalid', async () => {
    const res = await request(app).get('/tasks?page=abc&limit=xyz').expect(200);
    // parseInt('abc') => NaN => defaults to 1 for page, 10 for limit
    expect(res.body).toHaveLength(10);
  });
});

// ── PUT /tasks/:id ────────────────────────────────────────────────────────────

describe('PUT /tasks/:id', () => {
  let taskId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/tasks')
      .send(samplePayload({ title: 'Original', priority: 'low' }));
    taskId = res.body.id;
  });

  test('updates specific fields and returns the updated task', async () => {
    const res = await request(app)
      .put(`/tasks/${taskId}`)
      .send({ title: 'Updated Title' })
      .expect(200);

    expect(res.body.title).toBe('Updated Title');
    expect(res.body.priority).toBe('low'); // unchanged
  });

  test('returns 404 when the task does not exist', async () => {
    const res = await request(app)
      .put('/tasks/non-existent-id')
      .send({ title: 'X' })
      .expect(404);

    expect(res.body.error).toMatch(/not found/i);
  });

  test('rejects an empty title string (400)', async () => {
    await request(app)
      .put(`/tasks/${taskId}`)
      .send({ title: '' })
      .expect(400);
  });

  test('rejects an invalid status (400)', async () => {
    await request(app)
      .put(`/tasks/${taskId}`)
      .send({ status: 'blocked' })
      .expect(400);
  });
});

// ── DELETE /tasks/:id ─────────────────────────────────────────────────────────

describe('DELETE /tasks/:id', () => {
  test('deletes an existing task and returns 204', async () => {
    const created = await request(app).post('/tasks').send(samplePayload());
    await request(app)
      .delete(`/tasks/${created.body.id}`)
      .expect(204);

    // Verify it's gone
    const all = await request(app).get('/tasks').expect(200);
    expect(all.body).toHaveLength(0);
  });

  test('returns 404 when the task does not exist', async () => {
    await request(app).delete('/tasks/fake-id').expect(404);
  });
});

// ── PATCH /tasks/:id/complete ─────────────────────────────────────────────────

describe('PATCH /tasks/:id/complete', () => {
  test('marks a task as done with a completedAt timestamp', async () => {
    const created = await request(app)
      .post('/tasks')
      .send(samplePayload({ status: 'in_progress' }));

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/complete`)
      .expect(200);

    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).toBeDefined();
  });

  test('returns 404 for a non-existent task', async () => {
    await request(app).patch('/tasks/no-such-id/complete').expect(404);
  });

  /**
   * BUG: Completing a task silently resets the priority to "medium".
   * See taskService.test.js for the detailed explanation.
   */
  test('BUG — completing a high-priority task resets priority to medium', async () => {
    const created = await request(app)
      .post('/tasks')
      .send(samplePayload({ priority: 'high' }));

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/complete`)
      .expect(200);

    // Actual: priority becomes "medium" (bug)
    expect(res.body.priority).toBe('medium');
  });
});

// ── GET /tasks/stats ──────────────────────────────────────────────────────────

describe('GET /tasks/stats', () => {
  test('returns zeroed stats when there are no tasks', async () => {
    const res = await request(app).get('/tasks/stats').expect(200);
    expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  test('counts tasks correctly by status', async () => {
    await request(app).post('/tasks').send(samplePayload({ status: 'todo' }));
    await request(app).post('/tasks').send(samplePayload({ status: 'todo' }));
    await request(app).post('/tasks').send(samplePayload({ status: 'done' }));

    const res = await request(app).get('/tasks/stats').expect(200);
    expect(res.body.todo).toBe(2);
    expect(res.body.done).toBe(1);
    expect(res.body.in_progress).toBe(0);
  });

  test('counts overdue tasks', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    await request(app).post('/tasks').send(samplePayload({ status: 'todo', dueDate: pastDate }));

    const res = await request(app).get('/tasks/stats').expect(200);
    expect(res.body.overdue).toBe(1);
  });
});

// ── PATCH /tasks/:id/assign (NEW FEATURE) ─────────────────────────────────────

describe('PATCH /tasks/:id/assign', () => {
  let taskId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/tasks')
      .send(samplePayload({ title: 'Assignable' }));
    taskId = res.body.id;
  });

  test('assigns a person and returns the updated task', async () => {
    const res = await request(app)
      .patch(`/tasks/${taskId}/assign`)
      .send({ assignee: 'Alice' })
      .expect(200);

    expect(res.body.assignee).toBe('Alice');
    expect(res.body.title).toBe('Assignable'); // other fields preserved
  });

  test('trims whitespace from the assignee name', async () => {
    const res = await request(app)
      .patch(`/tasks/${taskId}/assign`)
      .send({ assignee: '  Bob  ' })
      .expect(200);

    expect(res.body.assignee).toBe('Bob');
  });

  test('allows re-assigning a task to a different person', async () => {
    await request(app)
      .patch(`/tasks/${taskId}/assign`)
      .send({ assignee: 'Alice' });

    const res = await request(app)
      .patch(`/tasks/${taskId}/assign`)
      .send({ assignee: 'Bob' })
      .expect(200);

    expect(res.body.assignee).toBe('Bob');
  });

  test('returns 404 when the task does not exist', async () => {
    await request(app)
      .patch('/tasks/no-such-id/assign')
      .send({ assignee: 'Eve' })
      .expect(404);
  });

  test('returns 400 when assignee is missing', async () => {
    const res = await request(app)
      .patch(`/tasks/${taskId}/assign`)
      .send({})
      .expect(400);

    expect(res.body.error).toMatch(/assignee/i);
  });

  test('returns 400 when assignee is an empty string', async () => {
    const res = await request(app)
      .patch(`/tasks/${taskId}/assign`)
      .send({ assignee: '' })
      .expect(400);

    expect(res.body.error).toMatch(/assignee/i);
  });

  test('returns 400 when assignee is whitespace-only', async () => {
    await request(app)
      .patch(`/tasks/${taskId}/assign`)
      .send({ assignee: '   ' })
      .expect(400);
  });

  test('returns 400 when assignee is not a string', async () => {
    await request(app)
      .patch(`/tasks/${taskId}/assign`)
      .send({ assignee: 12345 })
      .expect(400);
  });
});
