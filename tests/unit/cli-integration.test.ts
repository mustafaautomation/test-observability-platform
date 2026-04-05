import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(ROOT, 'dist/cli.js');
const PLAYWRIGHT_FIXTURE = path.join(ROOT, 'examples/playwright-results.json');
const JUNIT_FIXTURE = path.join(ROOT, 'examples/junit-results.xml');

describe('CLI integration', () => {
  beforeAll(() => {
    // Build the project so dist/cli.js is available
    execSync('npm run build', { cwd: ROOT, stdio: 'pipe' });
  }, 30_000);

  it('should ingest playwright and junit files and produce a report', () => {
    // The CLI exits with code 1 when readiness is not ready (blockers present),
    // so we catch the error and inspect stdout anyway.
    let output: string;
    try {
      output = execSync(`node ${CLI} ingest ${PLAYWRIGHT_FIXTURE} ${JUNIT_FIXTURE}`, {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: unknown) {
      // Non-zero exit is expected when there are blockers
      output = (err as { stdout: string }).stdout || '';
    }

    expect(output).toContain('Ingested');
    expect(output).toContain('Release Readiness');
    expect(output).toContain('Signal Breakdown');
  });

  it('should show ingestion count for each file', () => {
    let output: string;
    try {
      output = execSync(`node ${CLI} ingest ${PLAYWRIGHT_FIXTURE} ${JUNIT_FIXTURE}`, {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: unknown) {
      output = (err as { stdout: string }).stdout || '';
    }

    // Playwright has 6 tests across 2 suites, JUnit has 4 tests
    expect(output).toContain('playwright');
    expect(output).toContain('junit');
    expect(output).toContain('6 tests');
    expect(output).toContain('4 tests');
  });

  it('should output valid JSON with --json flag', () => {
    let output: string;
    try {
      output = execSync(`node ${CLI} ingest --json ${PLAYWRIGHT_FIXTURE} ${JUNIT_FIXTURE}`, {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: unknown) {
      output = (err as { stdout: string }).stdout || '';
    }

    // Strip the "Ingested:" lines to get the JSON part
    const jsonStart = output.indexOf('{');
    expect(jsonStart).toBeGreaterThanOrEqual(0);
    const json = output.slice(jsonStart);
    const report = JSON.parse(json);

    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('signals');
    expect(report).toHaveProperty('totals');
    expect(report).toHaveProperty('readiness');
    expect(report.totals.tests).toBe(10);
    expect(report.readiness).toHaveProperty('grade');
  });

  it('should report an error for missing files', () => {
    let stderr = '';
    try {
      execSync(`node ${CLI} ingest nonexistent.json`, {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: unknown) {
      stderr = (err as { stderr: string }).stderr || '';
    }

    expect(stderr).toContain('Not found');
  });
});
