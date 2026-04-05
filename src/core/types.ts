export type TestStatus = 'passed' | 'failed' | 'skipped';
export type SignalType =
  | 'e2e'
  | 'api'
  | 'unit'
  | 'performance'
  | 'security'
  | 'accessibility'
  | 'contract';

export interface TestSignal {
  framework: string;
  signalType: SignalType;
  timestamp: string;
  tests: Array<{
    name: string;
    suite: string;
    status: TestStatus;
    duration: number;
    error?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface TrendPoint {
  date: string;
  passRate: number;
  total: number;
  failed: number;
  duration: number;
}

export interface FlakinessInfo {
  testName: string;
  flipCount: number;
  lastStatus: TestStatus;
  stabilityScore: number;
}

export interface ReleaseReadiness {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  signals: Array<{
    type: SignalType;
    passRate: number;
    weight: number;
    contribution: number;
  }>;
  blockers: string[];
  ready: boolean;
}

export interface ObservabilityReport {
  timestamp: string;
  signals: TestSignal[];
  totals: {
    tests: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    frameworks: number;
  };
  trends: TrendPoint[];
  flakiness: FlakinessInfo[];
  readiness: ReleaseReadiness;
}
