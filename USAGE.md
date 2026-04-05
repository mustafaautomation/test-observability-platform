## Real-World Use Cases

### 1. Release Gate in CI
```bash
npx testobs ingest playwright.json jest.json k6.json --json | jq ".readiness.ready"
# true → deploy, false → block
```

### 2. Multi-Framework Dashboard
```bash
npx testobs ingest \
  test-results/playwright.json \
  test-results/jest-results.json \
  test-results/junit.xml \
  test-results/k6-summary.json
# Shows unified pass rate, per-framework breakdown, release readiness grade
```

### 3. Flakiness Tracking
Feed multiple runs to detect tests that flip between pass/fail across runs.
