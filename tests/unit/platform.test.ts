import { describe, it, expect } from 'vitest';
import { ingestFile } from '../../src/ingestors/ingestor';
import { computeReadiness } from '../../src/analyzers/readiness';
import { detectFlakiness } from '../../src/analyzers/flakiness';
import { TestSignal } from '../../src/core/types';

describe('ingestFile', () => {
  it('should ingest JUnit XML', () => {
    const xml = `<?xml version="1.0"?>
    <testsuites><testsuite name="Auth" tests="2">
      <testcase name="login" classname="auth" time="0.5"/>
      <testcase name="logout" classname="auth" time="0.3"><failure message="fail"/></testcase>
    </testsuite></testsuites>`;
    const signal = ingestFile(xml, 'result.xml');
    expect(signal).not.toBeNull();
    expect(signal!.framework).toBe('junit');
    expect(signal!.tests).toHaveLength(2);
    expect(signal!.tests[0].status).toBe('passed');
    expect(signal!.tests[1].status).toBe('failed');
  });

  it('should ingest Playwright JSON', () => {
    const json = JSON.stringify({
      suites: [
        { title: 'Auth', tests: [{ title: 'login', status: 'passed', duration: 500 }], suites: [] },
      ],
    });
    const signal = ingestFile(json, 'pw.json');
    expect(signal!.framework).toBe('playwright');
    expect(signal!.signalType).toBe('e2e');
  });

  it('should ingest Jest JSON', () => {
    const json = JSON.stringify({
      numTotalTests: 1,
      testResults: [
        {
          testFilePath: 'a.test.ts',
          testResults: [
            { title: 'works', ancestorTitles: ['Suite'], status: 'passed', duration: 10 },
          ],
        },
      ],
    });
    const signal = ingestFile(json, 'jest.json');
    expect(signal!.framework).toBe('jest');
  });

  it('should return null for unparseable content', () => {
    expect(ingestFile('garbage', 'bad.txt')).toBeNull();
  });
});

describe('computeReadiness', () => {
  it('should compute high readiness for all-passing signals', () => {
    const signals: TestSignal[] = [
      {
        framework: 'playwright',
        signalType: 'e2e',
        timestamp: '',
        tests: [
          { name: 'a', suite: 's', status: 'passed', duration: 100 },
          { name: 'b', suite: 's', status: 'passed', duration: 100 },
        ],
      },
      {
        framework: 'jest',
        signalType: 'unit',
        timestamp: '',
        tests: [{ name: 'c', suite: 's', status: 'passed', duration: 10 }],
      },
    ];
    const readiness = computeReadiness(signals);
    expect(readiness.score).toBeGreaterThanOrEqual(90);
    expect(readiness.grade).toBe('A');
    expect(readiness.ready).toBe(true);
  });

  it('should block on low E2E pass rate', () => {
    const signals: TestSignal[] = [
      {
        framework: 'pw',
        signalType: 'e2e',
        timestamp: '',
        tests: [
          { name: 'a', suite: 's', status: 'passed', duration: 0 },
          { name: 'b', suite: 's', status: 'failed', duration: 0 },
        ],
      },
    ];
    const readiness = computeReadiness(signals);
    expect(readiness.blockers.length).toBeGreaterThan(0);
    expect(readiness.ready).toBe(false);
  });

  it('should block on security failures', () => {
    const signals: TestSignal[] = [
      {
        framework: 'sec',
        signalType: 'security',
        timestamp: '',
        tests: [{ name: 'vuln', suite: 'scan', status: 'failed', duration: 0 }],
      },
    ];
    const readiness = computeReadiness(signals);
    expect(readiness.blockers.some((b) => b.includes('Security'))).toBe(true);
  });

  it('should handle empty signals', () => {
    const readiness = computeReadiness([]);
    expect(readiness.score).toBe(0);
    expect(readiness.grade).toBe('F');
    expect(readiness.ready).toBe(false);
  });
});

describe('detectFlakiness', () => {
  it('should detect flipping tests', () => {
    const signals: TestSignal[] = [
      {
        framework: 'pw',
        signalType: 'e2e',
        timestamp: '',
        tests: [{ name: 'flaky', suite: 's', status: 'passed', duration: 0 }],
      },
      {
        framework: 'pw',
        signalType: 'e2e',
        timestamp: '',
        tests: [{ name: 'flaky', suite: 's', status: 'failed', duration: 0 }],
      },
    ];
    const flaky = detectFlakiness(signals);
    expect(flaky).toHaveLength(1);
    expect(flaky[0].flipCount).toBe(1);
  });

  it('should not flag consistent tests', () => {
    const signals: TestSignal[] = [
      {
        framework: 'pw',
        signalType: 'e2e',
        timestamp: '',
        tests: [{ name: 'stable', suite: 's', status: 'passed', duration: 0 }],
      },
      {
        framework: 'pw',
        signalType: 'e2e',
        timestamp: '',
        tests: [{ name: 'stable', suite: 's', status: 'passed', duration: 0 }],
      },
    ];
    expect(detectFlakiness(signals)).toHaveLength(0);
  });
});
