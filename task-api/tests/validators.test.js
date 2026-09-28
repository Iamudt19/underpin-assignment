/**
 * Unit Tests — validators.js
 *
 * Tests the validation functions used by the route layer.
 */

const { validateCreateTask, validateUpdateTask } = require('../src/utils/validators');

// ── validateCreateTask ────────────────────────────────────────────────────────

describe('validateCreateTask()', () => {
  test('returns null for a valid task with all fields', () => {
    const error = validateCreateTask({
      title: 'Valid',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-12-31T00:00:00.000Z',
    });
    expect(error).toBeNull();
  });

  test('returns null when only title is provided', () => {
    expect(validateCreateTask({ title: 'Just a title' })).toBeNull();
  });

  test('returns an error when title is missing', () => {
    expect(validateCreateTask({})).toMatch(/title/i);
  });

  test('returns an error when title is an empty string', () => {
    expect(validateCreateTask({ title: '' })).toMatch(/title/i);
  });

  test('returns an error when title is whitespace only', () => {
    expect(validateCreateTask({ title: '   ' })).toMatch(/title/i);
  });

  test('returns an error when title is not a string', () => {
    expect(validateCreateTask({ title: 123 })).toMatch(/title/i);
  });

  test('returns an error for an invalid status', () => {
    expect(validateCreateTask({ title: 'T', status: 'blocked' })).toMatch(/status/i);
  });

  test('returns an error for an invalid priority', () => {
    expect(validateCreateTask({ title: 'T', priority: 'urgent' })).toMatch(/priority/i);
  });

  test('returns an error for an invalid dueDate', () => {
    expect(validateCreateTask({ title: 'T', dueDate: 'not-a-date' })).toMatch(/dueDate/i);
  });

  test('accepts valid ISO dueDate string', () => {
    expect(validateCreateTask({ title: 'T', dueDate: '2026-06-15T10:00:00Z' })).toBeNull();
  });
});

// ── validateUpdateTask ────────────────────────────────────────────────────────

describe('validateUpdateTask()', () => {
  test('returns null when all fields are valid', () => {
    const error = validateUpdateTask({
      title: 'Updated',
      status: 'done',
      priority: 'low',
    });
    expect(error).toBeNull();
  });

  test('returns null when body is empty (no fields to update)', () => {
    expect(validateUpdateTask({})).toBeNull();
  });

  test('returns an error when title is an empty string', () => {
    expect(validateUpdateTask({ title: '' })).toMatch(/title/i);
  });

  test('returns an error when title is whitespace only', () => {
    expect(validateUpdateTask({ title: '   ' })).toMatch(/title/i);
  });

  test('returns an error for an invalid status', () => {
    expect(validateUpdateTask({ status: 'unknown' })).toMatch(/status/i);
  });

  test('returns an error for an invalid priority', () => {
    expect(validateUpdateTask({ priority: 'critical' })).toMatch(/priority/i);
  });

  test('returns an error for an invalid dueDate', () => {
    expect(validateUpdateTask({ dueDate: 'hello' })).toMatch(/dueDate/i);
  });
});
