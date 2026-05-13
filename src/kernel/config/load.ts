import { readFileSync, existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { EnvSchema, YamlConfigSchema, type Env, type YamlConfig } from './schema';

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

export function loadYamlConfig(path: string): YamlConfig {
  if (!existsSync(path)) {
    throw new Error(`tortuga.yml not found at ${path}; required for v1`);
  }
  const raw = parseYaml(readFileSync(path, 'utf8'));
  const parsed = YamlConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid tortuga.yml: ${issues}`);
  }
  return parsed.data;
}
