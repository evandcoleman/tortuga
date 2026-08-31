import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression guard for a prod outage: a `'use server'` file that contained a
 * type-only re-export (`export type { Foo };`) evaluated fine under
 * plain tsc/esbuild (which erase type-only exports), but Next's Server
 * Actions bundler for that file statically re-exports every top-level
 * `export` name — type or not — into the generated actions-loader module.
 * Because the identifier was erased from the compiled module body, the
 * loader's `export { Foo } from '...'` line threw
 * `ReferenceError: Foo is not defined` at MODULE EVALUATION time. That
 * failure happens before any specific action runs, so every action
 * exported from the same file returned an identical 500/digest regardless
 * of which action was invoked or with what arguments.
 *
 * Fix: never re-export types from a `'use server'` file. Import the type
 * directly from its origin module instead.
 */

const SRC_ROOT = join(__dirname, '..');

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      collectFiles(full, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('use server files never type-re-export', () => {
  it('contains no `export type { ... }` re-exports in any "use server" module', () => {
    const offenders: string[] = [];

    for (const file of collectFiles(SRC_ROOT)) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      const content = readFileSync(file, 'utf8');
      const firstStatement = content.trimStart().split('\n')[0]?.trim();
      const isUseServer = firstStatement === "'use server';" || firstStatement === '"use server";';
      if (!isUseServer) continue;

      if (/^export type \{/m.test(content)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
