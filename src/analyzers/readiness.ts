import { TestSignal, ReleaseReadiness, SignalType } from '../core/types';

const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  e2e: 0.25,
  api: 0.2,
  unit: 0.15,
  performance: 0.15,
  security: 0.1,
  accessibility: 0.05,
  contract: 0.1,
};

export function computeReadiness(signals: TestSignal[]): ReleaseReadiness {
  if (signals.length === 0) {
    return {
      score: 0,
      grade: 'F',
      signals: [],
      blockers: ['No test signals ingested'],
      ready: false,
    };
  }

  const signalResults: ReleaseReadiness['signals'] = [];
  const blockers: string[] = [];

  for (const signal of signals) {
    const total = signal.tests.length;
    const passed = signal.tests.filter((t) => t.status === 'passed').length;
    const passRate = total > 0 ? passed / total : 0;
    const weight = SIGNAL_WEIGHTS[signal.signalType] || 0.1;
    const contribution = passRate * weight;

    signalResults.push({
      type: signal.signalType,
      passRate: Math.round(passRate * 100),
      weight,
      contribution: Math.round(contribution * 100),
    });

    if (passRate < 0.9 && signal.signalType === 'e2e') {
      blockers.push(`E2E pass rate ${Math.round(passRate * 100)}% (need ≥90%)`);
    }
    if (passRate < 0.95 && signal.signalType === 'unit') {
      blockers.push(`Unit test pass rate ${Math.round(passRate * 100)}% (need ≥95%)`);
    }
    if (signal.signalType === 'security' && passRate < 1) {
      blockers.push(`Security findings detected (${total - passed} failures)`);
    }
  }

  const totalWeight = signalResults.reduce((s, r) => s + r.weight, 0);
  const score =
    totalWeight > 0
      ? Math.round(signalResults.reduce((s, r) => s + r.contribution, 0) / totalWeight)
      : 0;

  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

  return {
    score,
    grade,
    signals: signalResults,
    blockers,
    ready: blockers.length === 0 && score >= 80,
  };
}
