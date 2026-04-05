import { describe, it, expect } from 'vitest';
import { ingestFile } from '../../src/ingestors/ingestor';

describe('ingestFile — k6 performance results', () => {
  it('should ingest k6 JSON with thresholds', () => {
    const k6 = JSON.stringify({
      metrics: {
        http_req_duration: {
          thresholds: {
            'p(95)<500': { ok: true },
            'p(99)<1000': { ok: false },
          },
        },
        http_req_failed: {
          thresholds: {
            'rate<0.01': { ok: true },
          },
        },
      },
      root_group: { name: 'load test' },
    });

    const signal = ingestFile(k6, 'k6-results.json');
    expect(signal).not.toBeNull();
    expect(signal!.framework).toBe('k6');
    expect(signal!.signalType).toBe('performance');
    expect(signal!.tests).toHaveLength(3);
    expect(signal!.tests.filter((t) => t.status === 'passed')).toHaveLength(2);
    expect(signal!.tests.filter((t) => t.status === 'failed')).toHaveLength(1);
  });

  it('should handle k6 results with no failing thresholds', () => {
    const k6 = JSON.stringify({
      metrics: {
        http_req_duration: {
          thresholds: { 'p(95)<500': { ok: true } },
        },
      },
      root_group: { name: 'smoke' },
    });

    const signal = ingestFile(k6, 'k6.json');
    expect(signal!.tests).toHaveLength(1);
    expect(signal!.tests[0].status).toBe('passed');
    expect(signal!.tests[0].suite).toBe('k6 Thresholds');
  });
});

describe('ingestFile — Pact contract results', () => {
  it('should ingest Pact contract JSON', () => {
    const pact = JSON.stringify({
      consumer: { name: 'frontend' },
      provider: { name: 'api-service' },
      interactions: [
        { description: 'GET /users returns list' },
        { description: 'POST /users creates user' },
        { description: 'GET /users/:id returns user' },
      ],
    });

    const signal = ingestFile(pact, 'pact.json');
    expect(signal).not.toBeNull();
    expect(signal!.framework).toBe('pact');
    expect(signal!.signalType).toBe('contract');
    expect(signal!.tests).toHaveLength(3);
    expect(signal!.tests[0].suite).toBe('frontend → api-service');
    expect(signal!.tests.every((t) => t.status === 'passed')).toBe(true);
  });
});

describe('ingestFile — generic JSON array', () => {
  it('should ingest custom test array', () => {
    const json = JSON.stringify([
      { name: 'test1', status: 'passed', duration: 100, suite: 'custom' },
      { name: 'test2', status: 'failed', duration: 50, suite: 'custom', error: 'assertion failed' },
    ]);

    const signal = ingestFile(json, 'custom.json');
    expect(signal!.framework).toBe('custom');
    expect(signal!.tests).toHaveLength(2);
    expect(signal!.tests[1].error).toBe('assertion failed');
  });

  it('should handle status normalization', () => {
    const json = JSON.stringify([
      { name: 'a', status: 'expected' },
      { name: 'b', status: 'unexpected' },
      { name: 'c', status: 'timedOut' },
      { name: 'd', status: 'pending' },
    ]);

    const signal = ingestFile(json, 'normalized.json');
    expect(signal!.tests[0].status).toBe('passed');
    expect(signal!.tests[1].status).toBe('failed');
    expect(signal!.tests[2].status).toBe('failed');
    expect(signal!.tests[3].status).toBe('skipped');
  });
});

describe('ingestFile — JUnit edge cases', () => {
  it('should handle skipped test cases', () => {
    const xml = `<?xml version="1.0"?>
    <testsuites><testsuite name="Suite" tests="3">
      <testcase name="a" classname="s" time="0.1"/>
      <testcase name="b" classname="s" time="0"><skipped/></testcase>
      <testcase name="c" classname="s" time="0.2"><error message="NPE"/></testcase>
    </testsuite></testsuites>`;

    const signal = ingestFile(xml, 'junit.xml');
    expect(signal!.tests).toHaveLength(3);
    expect(signal!.tests[0].status).toBe('passed');
    expect(signal!.tests[1].status).toBe('skipped');
    expect(signal!.tests[2].status).toBe('failed');
  });

  it('should parse duration in milliseconds', () => {
    const xml = `<?xml version="1.0"?>
    <testsuite name="Suite" tests="1">
      <testcase name="fast" classname="s" time="1.234"/>
    </testsuite>`;

    const signal = ingestFile(xml, 'result.xml');
    expect(signal!.tests[0].duration).toBe(1234);
  });
});

describe('ingestFile — Playwright nested suites', () => {
  it('should handle nested suite hierarchy', () => {
    const json = JSON.stringify({
      suites: [
        {
          title: 'Auth',
          tests: [{ title: 'login', status: 'passed', duration: 500 }],
          suites: [
            {
              title: 'OAuth',
              tests: [{ title: 'google sso', status: 'passed', duration: 800 }],
              suites: [],
            },
          ],
        },
      ],
    });

    const signal = ingestFile(json, 'pw.json');
    expect(signal!.tests).toHaveLength(2);
    expect(signal!.tests[1].suite).toContain('OAuth');
  });
});
