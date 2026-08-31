import { z } from 'zod';
import { XMLParser } from 'fast-xml-parser';

import { PlexError } from './errors';
import { fetchWithRetry } from './http';

/**
 * Stable per-install identifier plex.tv requires on every request. Any
 * non-empty string is accepted for a server-to-server integration like this
 * one — it does not need to match a real Plex app registration.
 */
const CLIENT_IDENTIFIER = 'tortuga-app';

const PLEX_API_BASE = 'https://plex.tv';

export interface PlexOpts {
  token: string;
  /** The server's machineIdentifier — reused from `newsletter.plex.server_id` config. */
  machineId: string;
  fetcher?: typeof fetch;
}

export interface PlexSection {
  /** The plex.tv GLOBAL library section id — the only id valid for `librarySectionIds` on an invite. */
  id: string;
  /** The server-local section key. Not valid for invites; kept for reference/debugging only. */
  key: string;
  title: string;
  type: string;
}

export interface PlexPendingInvite {
  id: string;
  invitedEmail: string;
  /** Flags plex.tv assigns per invite; required verbatim on the cancel request's query string. */
  friend: boolean;
  home: boolean;
  server: boolean;
}

export type PlexClientError =
  | { type: 'duplicate'; message: string }
  | { type: 'http'; status: number; message: string }
  | { type: 'network'; message: string }
  | { type: 'invalid_response'; message: string };

export type PlexResult<T> = { ok: true; data: T } | { ok: false; error: PlexClientError };

function authHeaders(opts: PlexOpts): Record<string, string> {
  return {
    'X-Plex-Token': opts.token,
    'X-Plex-Client-Identifier': CLIENT_IDENTIFIER,
    Accept: 'application/json',
  };
}

function httpError(status: number, message: string): PlexClientError {
  return { type: 'http', status, message };
}

/**
 * `fetchWithRetry` retries 5xx responses itself and throws the last error
 * once retries are exhausted (see `http.ts`), with a message of the shape
 * `HTTP 503`. Recover the status code from that message so a 5xx still
 * surfaces as a typed `http` error rather than an opaque `network` one.
 */
function mapFetchError(err: unknown): PlexClientError {
  const message = err instanceof Error ? err.message : 'network request failed';
  const statusMatch = /^HTTP (\d{3})$/.exec(message);
  if (statusMatch) {
    return httpError(Number(statusMatch[1]), `plex.tv returned ${message}`);
  }
  return { type: 'network', message };
}

function invalidResponseError(err: unknown): PlexClientError {
  return {
    type: 'invalid_response',
    message: err instanceof Error ? err.message : 'response did not match the expected shape',
  };
}

const sectionAttrSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  key: z.union([z.string(), z.number()]).transform(String),
  title: z.string(),
  type: z.string(),
});

/** Normalizes fast-xml-parser's "single element vs. array" ambiguity into always-an-array. */
function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseSectionsXml(xml: string): PlexSection[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const container = doc.MediaContainer as Record<string, unknown> | undefined;
  if (!container) throw new Error('missing MediaContainer element');

  const servers = asArray(container.Server as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const sections = servers.flatMap(server => asArray(server.Section as unknown as Record<string, unknown>[]));

  return sections.map(raw => {
    const parsed = sectionAttrSchema.parse(raw);
    return { id: parsed.id, key: parsed.key, title: parsed.title, type: parsed.type };
  });
}

const plexBooleanSchema = z.union([z.string(), z.number(), z.boolean()]).transform(v => String(v) === '1' || v === true);

const inviteAttrSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  email: z.string(),
  friend: plexBooleanSchema.default(false),
  home: plexBooleanSchema.default(false),
  server: plexBooleanSchema.default(false),
});

function parsePendingInvitesXml(xml: string): PlexPendingInvite[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const container = doc.MediaContainer as Record<string, unknown> | undefined;
  if (!container) throw new Error('missing MediaContainer element');

  const invites = asArray(container.Invite as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return invites.map(raw => {
    const parsed = inviteAttrSchema.parse(raw);
    return { id: parsed.id, invitedEmail: parsed.email, friend: parsed.friend, home: parsed.home, server: parsed.server };
  });
}

export function createPlexClient(opts: PlexOpts) {
  const fetcher = opts.fetcher ?? fetch;

  async function getSections(signal?: AbortSignal): Promise<PlexResult<PlexSection[]>> {
    let res: Response;
    try {
      res = await fetchWithRetry(
        `${PLEX_API_BASE}/api/servers/${opts.machineId}`,
        { method: 'GET', headers: authHeaders(opts) },
        { fetcher, signal },
      );
    } catch (err) {
      return { ok: false, error: mapFetchError(err) };
    }
    if (!res.ok) {
      return { ok: false, error: httpError(res.status, `plex.tv returned HTTP ${res.status}`) };
    }
    try {
      const xml = await res.text();
      return { ok: true, data: parseSectionsXml(xml) };
    } catch (err) {
      return { ok: false, error: invalidResponseError(err) };
    }
  }

  async function invite(email: string, sectionIds: string[], signal?: AbortSignal): Promise<PlexResult<{ id: string }>> {
    let res: Response;
    try {
      res = await fetchWithRetry(
        `${PLEX_API_BASE}/api/v2/shared_servers`,
        {
          method: 'POST',
          headers: { ...authHeaders(opts), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            machineIdentifier: opts.machineId,
            librarySectionIds: sectionIds,
            invitedEmail: email,
          }),
        },
        { fetcher, signal },
      );
    } catch (err) {
      return { ok: false, error: mapFetchError(err) };
    }
    if (res.status === 422) {
      return {
        ok: false,
        error: { type: 'duplicate', message: `${email} has already been invited or has access to this server` },
      };
    }
    if (!res.ok) {
      return { ok: false, error: httpError(res.status, `plex.tv returned HTTP ${res.status}`) };
    }
    try {
      const body = (await res.json()) as { id: string | number };
      return { ok: true, data: { id: String(body.id) } };
    } catch (err) {
      return { ok: false, error: invalidResponseError(err) };
    }
  }

  async function getPendingInvites(signal?: AbortSignal): Promise<PlexResult<PlexPendingInvite[]>> {
    let res: Response;
    try {
      res = await fetchWithRetry(
        `${PLEX_API_BASE}/api/invites/requested`,
        { method: 'GET', headers: authHeaders(opts) },
        { fetcher, signal },
      );
    } catch (err) {
      return { ok: false, error: mapFetchError(err) };
    }
    if (!res.ok) {
      return { ok: false, error: httpError(res.status, `plex.tv returned HTTP ${res.status}`) };
    }
    try {
      const xml = await res.text();
      return { ok: true, data: parsePendingInvitesXml(xml) };
    } catch (err) {
      return { ok: false, error: invalidResponseError(err) };
    }
  }

  async function cancelInvite(invite: PlexPendingInvite, signal?: AbortSignal): Promise<PlexResult<void>> {
    const query = new URLSearchParams({
      friend: invite.friend ? '1' : '0',
      home: invite.home ? '1' : '0',
      server: invite.server ? '1' : '0',
    });
    let res: Response;
    try {
      res = await fetchWithRetry(
        `${PLEX_API_BASE}/api/invites/requested/${invite.id}?${query.toString()}`,
        { method: 'DELETE', headers: authHeaders(opts) },
        { fetcher, signal },
      );
    } catch (err) {
      return { ok: false, error: mapFetchError(err) };
    }
    if (!res.ok) {
      return { ok: false, error: httpError(res.status, `plex.tv returned HTTP ${res.status}`) };
    }
    return { ok: true, data: undefined };
  }

  return { getSections, invite, getPendingInvites, cancelInvite };
}

export type PlexClient = ReturnType<typeof createPlexClient>;

// Re-exported for callers that want to log/throw a real Error alongside a
// typed result (e.g. surfacing an unexpected `network` failure to Sentry).
export { PlexError };
