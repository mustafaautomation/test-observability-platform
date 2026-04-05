#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import { ingestFile } from './ingestors/ingestor';
import { computeReadiness } from './analyzers/readiness';
import { detectFlakiness } from './analyzers/flakiness';
import { TestSignal, ObservabilityReport } from './core/types';

const R = '\x1b[0m',
  B = '\x1b[1m',
  D = '\x1b[2m';
const RED = '\x1b[31m',
  GRN = '\x1b[32m',
  YEL = '\x1b[33m',
  CYN = '\x1b[36m';

const program = new Command();
program.name('testobs').description('Test Observability Platform').version('1.0.0');

program
  .command('ingest')
  .description('Ingest test results from multiple frameworks')
  .argument('<files...>', 'Result files (JSON, XML)')
  .option('--json', 'JSON output')
  .action((files: string[], options) => {
    const signals: TestSignal[] = [];

    for (const file of files) {
      if (!fs.existsSync(file)) {
        console.error(`Not found: ${file}`);
        continue;
      }
      const content = fs.readFileSync(file, 'utf-8');
      const signal = ingestFile(content, file);
      if (signal) {
        signals.push(signal);
        console.log(`Ingested: ${file} (${signal.framework}, ${signal.tests.length} tests)`);
      } else {
        console.error(`Could not parse: ${file}`);
      }
    }

    const allTests = signals.flatMap((s) => s.tests);
    const passed = allTests.filter((t) => t.status === 'passed').length;
    const readiness = computeReadiness(signals);
    const flakiness = detectFlakiness(signals);

    const report: ObservabilityReport = {
      timestamp: new Date().toISOString(),
      signals,
      totals: {
        tests: allTests.length,
        passed,
        failed: allTests.filter((t) => t.status === 'failed').length,
        skipped: allTests.filter((t) => t.status === 'skipped').length,
        passRate: allTests.length > 0 ? Math.round((passed / allTests.length) * 1000) / 10 : 0,
        frameworks: signals.length,
      },
      trends: [],
      flakiness,
      readiness,
    };

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printReport(report);
    }

    if (!readiness.ready) process.exit(1);
  });

function printReport(report: ObservabilityReport): void {
  const r = report.readiness;
  const gradeColor = r.grade <= 'B' ? GRN : r.grade <= 'C' ? YEL : RED;

  console.log();
  console.log(`${B}${CYN}Test Observability Report${R}`);
  console.log();
  console.log(
    `  ${B}Release Readiness:${R} ${gradeColor}${B}${r.grade}${R} (${r.score}%) ${r.ready ? `${GRN}READY` : `${RED}NOT READY`}${R}`,
  );
  console.log(
    `  ${B}Tests:${R} ${report.totals.tests} across ${report.totals.frameworks} frameworks`,
  );
  console.log(
    `  ${GRN}${report.totals.passed} passed${R}  ${RED}${report.totals.failed} failed${R}  ${D}${report.totals.skipped} skipped${R}  Pass rate: ${report.totals.passRate}%`,
  );
  console.log();

  console.log(`  ${B}Signal Breakdown:${R}`);
  for (const s of r.signals) {
    const color = s.passRate >= 90 ? GRN : s.passRate >= 70 ? YEL : RED;
    console.log(
      `    ${s.type.padEnd(15)} ${color}${s.passRate}%${R}  weight: ${(s.weight * 100).toFixed(0)}%`,
    );
  }

  if (r.blockers.length > 0) {
    console.log();
    console.log(`  ${B}${RED}Blockers:${R}`);
    for (const b of r.blockers) console.log(`    ${RED}✗ ${b}${R}`);
  }

  if (report.flakiness.length > 0) {
    console.log();
    console.log(`  ${B}${YEL}Flaky Tests (${report.flakiness.length}):${R}`);
    for (const f of report.flakiness.slice(0, 5)) {
      console.log(
        `    ${YEL}~ ${f.testName}${R} ${D}(${f.flipCount} flips, ${f.stabilityScore}% stable)${R}`,
      );
    }
  }
  console.log();
}

program.parse();
