import { describe, it, expect, vi } from 'vitest';
import { createPlexClient } from './plex';

const baseOpts = { token: 'plex-token-123', machineId: 'abc123machine' };

const SECTIONS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<MediaContainer size="1">
  <Server name="Cerberus" address="1.2.3.4" port="32400" machineIdentifier="abc123machine" owned="1">
    <Section id="1001" key="1" title="Movies" type="movie" shared="0"/>
    <Section id="1002" key="2" title="TV Shows" type="show" shared="0"/>
  </Server>
</MediaContainer>`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function xmlResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'application/xml' } });
}

describe('PlexClient.getSections', () => {
  it('parses the plex.tv global section ids from the XML fixture, not the local keys', async () => {
    const fetcher = vi.fn().mockResolvedValue(xmlResponse(SECTIONS_XML));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.getSections();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([
      { id: '1001', key: '1', title: 'Movies', type: 'movie' },
      { id: '1002', key: '2', title: 'TV Shows', type: 'show' },
    ]);
  });

  it('sends the auth headers', async () => {
    const fetcher = vi.fn().mockResolvedValue(xmlResponse(SECTIONS_XML));
    const client = createPlexClient({ ...baseOpts, fetcher });
    await client.getSections();
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://plex.tv/api/servers/abc123machine');
    const headers = new Headers(init.headers);
    expect(headers.get('X-Plex-Token')).toBe('plex-token-123');
    expect(headers.get('X-Plex-Client-Identifier')).toBeTruthy();
  });

  it('handles a single Section with no siblings without collapsing the array', async () => {
    const singleSectionXml = `<MediaContainer>
      <Server machineIdentifier="abc123machine">
        <Section id="1001" key="1" title="Movies" type="movie" shared="0"/>
      </Server>
    </MediaContainer>`;
    const fetcher = vi.fn().mockResolvedValue(xmlResponse(singleSectionXml));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.getSections();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([{ id: '1001', key: '1', title: 'Movies', type: 'movie' }]);
  });

  it('returns a typed http error on a non-2xx response', async () => {
    const fetcher = vi.fn().mockResolvedValue(xmlResponse('unauthorized', 401));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.getSections();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('http');
    expect(result.error.status).toBe(401);
  });

  it('returns a typed invalid_response error when a Section is missing required attributes', async () => {
    const missingIdXml = `<MediaContainer>
      <Server machineIdentifier="abc123machine">
        <Section key="1" title="Movies" type="movie" shared="0"/>
      </Server>
    </MediaContainer>`;
    const fetcher = vi.fn().mockResolvedValue(xmlResponse(missingIdXml, 200));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.getSections();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('invalid_response');
  });

  it('returns a typed invalid_response error when MediaContainer is missing entirely', async () => {
    const fetcher = vi.fn().mockResolvedValue(xmlResponse('<NotAMediaContainer/>', 200));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.getSections();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('invalid_response');
  });
});

describe('PlexClient.invite', () => {
  it('posts the invite with machineIdentifier, librarySectionIds, and invitedEmail', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: 555, invitedEmail: 'friend@example.com' }));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.invite('friend@example.com', ['1001', '1002']);
    expect(result.ok).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://plex.tv/api/v2/shared_servers');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      machineIdentifier: 'abc123machine',
      librarySectionIds: ['1001', '1002'],
      invitedEmail: 'friend@example.com',
    });
  });

  it('treats HTTP 422 as an already-invited duplicate, not a generic failure', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ errors: [{ message: 'already shared' }] }, 422));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.invite('friend@example.com', ['1001']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('duplicate');
  });

  it('returns a typed http error on other non-2xx statuses', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 500));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.invite('friend@example.com', ['1001']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('http');
  });
});

describe('PlexClient.getPendingInvites', () => {
  it('parses the pending invites fixture', async () => {
    const fixture = [
      { id: 555, invitedEmail: 'friend@example.com', librarySectionIds: ['1001'], acceptedAt: null },
      { id: 556, invitedEmail: 'other@example.com', librarySectionIds: ['1001', '1002'], acceptedAt: null },
    ];
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(fixture));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.getPendingInvites();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([
      { id: '555', invitedEmail: 'friend@example.com', librarySectionIds: ['1001'] },
      { id: '556', invitedEmail: 'other@example.com', librarySectionIds: ['1001', '1002'] },
    ]);
  });

  it('excludes already-accepted shares', async () => {
    const fixture = [
      { id: 555, invitedEmail: 'friend@example.com', librarySectionIds: ['1001'], acceptedAt: null },
      { id: 557, invitedEmail: 'accepted@example.com', librarySectionIds: ['1001'], acceptedAt: '2026-01-01T00:00:00Z' },
    ];
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(fixture));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.getPendingInvites();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map(i => i.id)).toEqual(['555']);
  });
});

describe('PlexClient.cancelInvite', () => {
  it('sends a DELETE for the given id', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.cancelInvite('555');
    expect(result.ok).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://plex.tv/api/v2/shared_servers/555');
    expect(init.method).toBe('DELETE');
  });

  it('returns a typed http error when the delete fails', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.cancelInvite('555');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('http');
    expect(result.error.status).toBe(404);
  });
});
