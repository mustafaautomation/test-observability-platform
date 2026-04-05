# Integration Guide — How Quvantic Tools Work Together

This platform is the **central hub** that connects all other Quvantic testing tools.

## Full Pipeline Example

```
1. Generate tests      → ai-test-orchestrator
2. Run E2E tests       → playwright-enterprise-framework
3. Run API tests       → api-testing-suite
4. Run performance     → performance-testing-k6
5. Check contracts     → contract-testing-pact
6. Security scan       → security-testing-pipeline
7. Aggregate results   → test-observability-platform  ← YOU ARE HERE
8. Check readiness     → release gate (pass/fail)
9. Report to Slack     → n8n-enterprise-workflows
```

## Step-by-Step Integration

### 1. After Playwright Tests

```bash
# Playwright outputs JSON
npx playwright test --reporter=json > results/playwright.json

# Feed to observability platform
npx testobs ingest results/playwright.json
```

### 2. After Jest Unit Tests

```bash
npx jest --json --outputFile=results/jest.json
npx testobs ingest results/jest.json
```

### 3. After k6 Performance Tests

```bash
k6 run --summary-export=results/k6.json tests/load.test.js
npx testobs ingest results/k6.json
```

### 4. Combined Release Gate

```bash
# Ingest ALL results at once
npx testobs ingest \
  results/playwright.json \
  results/jest.json \
  results/k6.json \
  results/junit.xml

# Exit 1 if not release-ready
# Grade A (≥90%) = ready, anything less = blocked
```

### 5. Notify via n8n

Post results to Slack using the n8n test-results-router workflow:

```bash
curl -X POST http://n8n:5678/webhook/test-results \
  -H "Content-Type: application/json" \
  -d "$(npx testobs ingest results/*.json --json)"
```

## CI/CD Pipeline YAML

```yaml
jobs:
  test:
    steps:
      - run: npx playwright test --reporter=json > results/pw.json
      - run: npx jest --json --outputFile=results/jest.json
      - run: npx testobs ingest results/*.json results/*.xml
        # Blocks deploy if not ready
```

## Related Quvantic Tools

| Tool | Role in Pipeline |
|------|-----------------|
| [ai-test-orchestrator](https://github.com/mustafaautomation/ai-test-orchestrator) | Generate tests from requirements |
| [playwright-enterprise-framework](https://github.com/mustafaautomation/playwright-enterprise-framework) | E2E browser tests |
| [api-testing-suite](https://github.com/mustafaautomation/api-testing-suite) | API tests |
| [performance-testing-k6](https://github.com/mustafaautomation/performance-testing-k6) | Load/stress tests |
| [security-testing-pipeline](https://github.com/mustafaautomation/security-testing-pipeline) | SAST + dependency + secrets |
| [flaky-test-detective](https://github.com/mustafaautomation/flaky-test-detective) | Detect and quarantine flaky tests |
| [n8n-enterprise-workflows](https://github.com/mustafaautomation/n8n-enterprise-workflows) | Notify Slack/Jira |
| [chaos-testing-toolkit](https://github.com/mustafaautomation/chaos-testing-toolkit) | Inject faults for resilience |
