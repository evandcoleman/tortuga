export interface TemplateVariables {
  /** Known recipient name, when available. */
  name: string | null;
  email: string;
  serverName: string;
}

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function emailLocalPart(email: string): string | null {
  const [local] = email.split('@');
  return local && local.length > 0 ? local : null;
}

function resolveName(vars: TemplateVariables): string | null {
  const trimmed = vars.name?.trim();
  if (trimmed) return trimmed;
  return emailLocalPart(vars.email);
}

/**
 * Replaces {{name}}, {{email}}, {{server_name}} with the given values.
 * {{name}} falls back to the email's local part when no name is known.
 * Any other {{...}} token (unknown variable) is left as-is — never throws.
 */
export function substituteVariables(input: string, vars: TemplateVariables): string {
  const known: Record<string, string | null> = {
    name: resolveName(vars),
    email: vars.email,
    server_name: vars.serverName,
  };

  return input.replace(VARIABLE_PATTERN, (match, key: string) => {
    const value = known[key];
    return value !== undefined && value !== null ? value : match;
  });
}
