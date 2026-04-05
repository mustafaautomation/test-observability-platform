# Test Observability Platform

[![CI](https://github.com/mustafaautomation/test-observability-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/mustafaautomation/test-observability-platform/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

Unified test intelligence platform — ingest results from Playwright, Jest, JUnit, k6, Pact into one view. Release readiness scoring, flakiness detection, signal-weighted quality gates.

---

## The Problem

Your team runs 5 different test frameworks. Results are scattered across CI jobs. No one knows if the release is ready.

## The Solution

```bash
npx testobs ingest playwright.json jest.json results.xml k6-summary.json pact.json
```

One command → unified report with release readiness grade.

---

## Supported Frameworks

| Framework | Signal Type | Auto-Detection |
|-----------|------------|----------------|
| Playwright | E2E | `suites` array |
| Jest | Unit | `numTotalTests` |
| JUnit XML | Unit/Integration | `<testsuites>` |
| k6 | Performance | `metrics` + `root_group` |
| Pact | Contract | `consumer` + `provider` |
| Custom JSON | Any | Array of `{name, status}` |

---

## Release Readiness

Weighted scoring across all test signals:

| Signal | Weight | Threshold |
|--------|--------|-----------|
| E2E | 25% | ≥90% pass rate |
| API | 20% | — |
| Unit | 15% | ≥95% pass rate |
| Performance | 15% | — |
| Security | 10% | 100% (any failure blocks) |
| Contract | 10% | — |
| Accessibility | 5% | — |

Grade A (≥90) → Ready to ship. Grade F (<60) → Blocked.

---

## Flakiness Detection

Cross-run analysis identifies tests that flip between pass/fail:

```
~ auth::login test (3 flips, 50% stable)
~ cart::add item (1 flip, 75% stable)
```

---

## Project Structure

```
test-observability-platform/
├── src/
│   ├── core/types.ts           # TestSignal, ReleaseReadiness, ObservabilityReport
│   ├── ingestors/ingestor.ts   # Auto-detect + parse 6 frameworks
│   ├── analyzers/
│   │   ├── readiness.ts        # Weighted release readiness scoring
│   │   └── flakiness.ts        # Cross-run flip detection
│   ├── cli.ts
│   └── index.ts
├── tests/unit/
│   └── platform.test.ts        # 10 tests — ingestors, readiness, flakiness
└── .github/workflows/ci.yml
```

---

## License

MIT

---

Built by [Quvantic](https://quvantic.com)
