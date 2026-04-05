import { TestSignal, FlakinessInfo, TestStatus } from '../core/types';

export function detectFlakiness(signals: TestSignal[]): FlakinessInfo[] {
  const testHistory = new Map<string, TestStatus[]>();

  for (const signal of signals) {
    for (const test of signal.tests) {
      const key = `${test.suite}::${test.name}`;
      const history = testHistory.get(key) || [];
      history.push(test.status);
      testHistory.set(key, history);
    }
  }

  const flaky: FlakinessInfo[] = [];

  for (const [key, statuses] of testHistory) {
    if (statuses.length < 2) continue;

    let flipCount = 0;
    for (let i = 1; i < statuses.length; i++) {
      if (statuses[i] !== statuses[i - 1]) flipCount++;
    }

    if (flipCount > 0) {
      const passed = statuses.filter((s) => s === 'passed').length;
      const stabilityScore = Math.round((passed / statuses.length) * 100);

      flaky.push({
        testName: key,
        flipCount,
        lastStatus: statuses[statuses.length - 1],
        stabilityScore,
      });
    }
  }

  return flaky.sort((a, b) => a.stabilityScore - b.stabilityScore);
}
