import { XMLParser } from 'fast-xml-parser';
import { TestSignal, TestStatus } from '../core/types';

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export function ingestFile(content: string, filename: string): TestSignal | null {
  if (filename.endsWith('.xml')) return ingestJunit(content);

  try {
    const data = JSON.parse(content);
    if (data.suites && Array.isArray(data.suites)) return ingestPlaywright(data);
    if (data.numTotalTests !== undefined) return ingestJest(data);
    if (data.metrics && data.root_group) return ingestK6(data);
    if (data.consumer && data.provider) return ingestPact(data);
    if (Array.isArray(data)) return ingestGeneric(data);
  } catch {
    return null;
  }

  return null;
}

function ingestJunit(content: string): TestSignal {
  const data = xmlParser.parse(content);
  const suites = toArray(data.testsuites?.testsuite || data.testsuite);
  const tests = suites.flatMap((s) =>
    toArray(s.testcase).map((tc) => ({
      name: tc['@_name'] || 'Unknown',
      suite: tc['@_classname'] || s['@_name'] || 'Unknown',
      status: (tc.failure || tc.error
        ? 'failed'
        : tc.skipped !== undefined
          ? 'skipped'
          : 'passed') as TestStatus,
      duration: Math.round(parseFloat(tc['@_time'] || '0') * 1000),
      error: tc.failure?.['@_message'] || tc.error?.['@_message'],
    })),
  );
  return { framework: 'junit', signalType: 'unit', timestamp: new Date().toISOString(), tests };
}

function ingestPlaywright(data: Record<string, unknown>): TestSignal {
  const tests: TestSignal['tests'] = [];
  function extract(spec: Record<string, unknown>, path: string): void {
    const suite = path ? `${path} > ${spec.title}` : String(spec.title || '');
    for (const t of (spec.tests || []) as Array<Record<string, unknown>>) {
      tests.push({
        name: String(t.title || ''),
        suite,
        status: mapStatus(String(t.status || 'passed')),
        duration: Number(t.duration || 0),
      });
    }
    for (const child of (spec.suites || []) as Array<Record<string, unknown>>)
      extract(child, suite);
  }
  for (const s of data.suites as Array<Record<string, unknown>>) extract(s, '');
  return { framework: 'playwright', signalType: 'e2e', timestamp: new Date().toISOString(), tests };
}

function ingestJest(data: Record<string, unknown>): TestSignal {
  const tests: TestSignal['tests'] = [];
  for (const file of data.testResults as Array<Record<string, unknown>>) {
    for (const t of (file.testResults || file.assertionResults || []) as Array<
      Record<string, unknown>
    >) {
      tests.push({
        name: String(t.title || ''),
        suite:
          ((t.ancestorTitles as string[]) || []).join(' > ') || String(file.testFilePath || ''),
        status: mapStatus(String(t.status || 'passed')),
        duration: Number(t.duration || 0),
      });
    }
  }
  return { framework: 'jest', signalType: 'unit', timestamp: new Date().toISOString(), tests };
}

function ingestK6(data: Record<string, unknown>): TestSignal {
  const metrics = data.metrics as Record<string, Record<string, unknown>>;
  const tests: TestSignal['tests'] = [];
  for (const [name, metric] of Object.entries(metrics)) {
    if ((metric as Record<string, unknown>).thresholds) {
      for (const [threshold, result] of Object.entries(
        (metric as Record<string, Record<string, unknown>>).thresholds || {},
      )) {
        tests.push({
          name: `${name}: ${threshold}`,
          suite: 'k6 Thresholds',
          status: (result as Record<string, boolean>).ok ? 'passed' : 'failed',
          duration: 0,
        });
      }
    }
  }
  return { framework: 'k6', signalType: 'performance', timestamp: new Date().toISOString(), tests };
}

function ingestPact(data: Record<string, unknown>): TestSignal {
  const consumer = (data.consumer as Record<string, string>)?.name || 'Unknown';
  const provider = (data.provider as Record<string, string>)?.name || 'Unknown';
  const interactions = (data.interactions || []) as Array<Record<string, string>>;
  const tests = interactions.map((i) => ({
    name: i.description || 'Interaction',
    suite: `${consumer} → ${provider}`,
    status: 'passed' as TestStatus,
    duration: 0,
  }));
  return { framework: 'pact', signalType: 'contract', timestamp: new Date().toISOString(), tests };
}

function ingestGeneric(data: Array<Record<string, unknown>>): TestSignal {
  const tests = data.map((t) => ({
    name: String(t.name || t.title || 'Unknown'),
    suite: String(t.suite || 'Unknown'),
    status: mapStatus(String(t.status || 'passed')),
    duration: Number(t.duration || 0),
    error: t.error ? String(t.error) : undefined,
  }));
  return { framework: 'custom', signalType: 'unit', timestamp: new Date().toISOString(), tests };
}

function mapStatus(s: string): TestStatus {
  if (['passed', 'expected'].includes(s)) return 'passed';
  if (['failed', 'unexpected', 'timedOut'].includes(s)) return 'failed';
  return 'skipped';
}

function toArray<T>(item: T | T[] | undefined): T[] {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}
