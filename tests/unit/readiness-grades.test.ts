import { describe, it, expect } from 'vitest';
import { computeReadiness } from '../../src/analyzers/readiness';
import { TestSignal, SignalType } from '../../src/core/types';

/**
 * Helper: creates a signal with a specific pass rate.
 * `passCount` tests pass, `total - passCount` tests fail.
 */
function makeSignal(type: SignalType, passCount: number, total: number): TestSignal {
  const tests = Array.from({ length: total }, (_, i) => ({
    name: `test-${i}`,
    suite: 'suite',
    status: (i < passCount ? 'passed' : 'failed') as 'passed' | 'failed',
    duration: 10,
  }));
  return { framework: 'test', signalType: type, timestamp: '', tests };
}

describe('readiness grade boundaries', () => {
  it('should return grade A for score >= 90', () => {
    // Single signal, 100% pass rate → score 100
    const result = computeReadiness([makeSignal('e2e', 10, 10)]);
    expect(result.grade).toBe('A');
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('should return grade A at the 90 boundary', () => {
    // 90% pass rate on a single signal — rounding may nudge score slightly
    const result = computeReadiness([makeSignal('e2e', 9, 10)]);
    expect(result.grade).toBe('A');
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('should return grade B for score 80-89', () => {
    // 80% pass rate → score 80
    const result = computeReadiness([makeSignal('e2e', 8, 10)]);
    expect(result.grade).toBe('B');
    expect(result.score).toBe(80);
  });

  it('should return grade C for score 70-79', () => {
    // 70% pass rate — rounding may nudge score slightly above 70
    const result = computeReadiness([makeSignal('e2e', 7, 10)]);
    expect(result.grade).toBe('C');
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.score).toBeLessThan(80);
  });

  it('should return grade D for score 60-69', () => {
    // 60% pass rate → score 60
    const result = computeReadiness([makeSignal('e2e', 6, 10)]);
    expect(result.grade).toBe('D');
    expect(result.score).toBe(60);
  });

  it('should return grade F for score below 60', () => {
    // 50% pass rate — rounding may nudge score slightly above 50
    const result = computeReadiness([makeSignal('e2e', 5, 10)]);
    expect(result.grade).toBe('F');
    expect(result.score).toBeLessThan(60);
  });

  it('should return grade F with score 0 for empty signals', () => {
    const result = computeReadiness([]);
    expect(result.grade).toBe('F');
    expect(result.score).toBe(0);
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('No test signals ingested');
  });
});

describe('signal type weights', () => {
  it('should assign weight 0.25 to e2e signals', () => {
    const result = computeReadiness([makeSignal('e2e', 10, 10)]);
    const e2eSignal = result.signals.find((s) => s.type === 'e2e');
    expect(e2eSignal).toBeDefined();
    expect(e2eSignal!.weight).toBe(0.25);
  });

  it('should assign weight 0.15 to unit signals', () => {
    const result = computeReadiness([makeSignal('unit', 10, 10)]);
    const unitSignal = result.signals.find((s) => s.type === 'unit');
    expect(unitSignal).toBeDefined();
    expect(unitSignal!.weight).toBe(0.15);
  });

  it('should assign weight 0.1 to security signals', () => {
    const result = computeReadiness([makeSignal('security', 10, 10)]);
    const secSignal = result.signals.find((s) => s.type === 'security');
    expect(secSignal).toBeDefined();
    expect(secSignal!.weight).toBe(0.1);
  });

  it('should assign weight 0.15 to performance signals', () => {
    const result = computeReadiness([makeSignal('performance', 10, 10)]);
    const perfSignal = result.signals.find((s) => s.type === 'performance');
    expect(perfSignal).toBeDefined();
    expect(perfSignal!.weight).toBe(0.15);
  });

  it('should assign weight 0.1 to contract signals', () => {
    const result = computeReadiness([makeSignal('contract', 10, 10)]);
    const contractSignal = result.signals.find((s) => s.type === 'contract');
    expect(contractSignal).toBeDefined();
    expect(contractSignal!.weight).toBe(0.1);
  });

  it('should assign weight 0.2 to api signals', () => {
    const result = computeReadiness([makeSignal('api', 10, 10)]);
    const apiSignal = result.signals.find((s) => s.type === 'api');
    expect(apiSignal).toBeDefined();
    expect(apiSignal!.weight).toBe(0.2);
  });

  it('should assign weight 0.05 to accessibility signals', () => {
    const result = computeReadiness([makeSignal('accessibility', 10, 10)]);
    const a11ySignal = result.signals.find((s) => s.type === 'accessibility');
    expect(a11ySignal).toBeDefined();
    expect(a11ySignal!.weight).toBe(0.05);
  });
});

describe('readiness with mixed signals', () => {
  it('should compute weighted score across multiple signal types', () => {
    const signals: TestSignal[] = [
      makeSignal('e2e', 10, 10), // 100% × 0.25
      makeSignal('unit', 10, 10), // 100% × 0.15
      makeSignal('security', 10, 10), // 100% × 0.10
    ];
    const result = computeReadiness(signals);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('should mark not ready when score >= 80 but blockers exist', () => {
    // E2E at 80% triggers blocker (need >=90%), but weighted score could be high
    const signals: TestSignal[] = [makeSignal('e2e', 8, 10)];
    const result = computeReadiness(signals);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.ready).toBe(false);
  });

  it('should mark not ready when score < 80 even with no blockers', () => {
    // contract at 70% — no blocker rules for contract, but score < 80
    const signals: TestSignal[] = [makeSignal('contract', 7, 10)];
    const result = computeReadiness(signals);
    expect(result.score).toBe(70);
    expect(result.ready).toBe(false);
  });

  it('should add blocker for unit test pass rate below 95%', () => {
    const signals: TestSignal[] = [makeSignal('unit', 9, 10)];
    const result = computeReadiness(signals);
    expect(result.blockers.some((b) => b.includes('Unit test pass rate'))).toBe(true);
  });
});
