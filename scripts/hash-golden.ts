import { readFileSync, writeFileSync } from 'node:fs';
import { hashOf } from '../src/core/canonical';

const path = 'fixtures/golden/ccpa-2018/source.json';
const source = JSON.parse(readFileSync(path, 'utf8')) as { spans: unknown; sha256: string };
const sha256 = hashOf(source.spans);
const updated = { ...source, sha256 };
writeFileSync(path, `${JSON.stringify(updated, null, 2)}\n`);
console.log(`wrote sha256 ${sha256} to ${path}`);
process.exit(0);
