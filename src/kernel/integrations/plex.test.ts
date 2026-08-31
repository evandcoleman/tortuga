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

const PENDING_INVITES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<MediaContainer size="2">
  <Invite id="555" createdAt="1700000000" email="friend@example.com" username="friend" friend="1" home="0" server="1">
    <Server name="Cerberus" numLibraries="2"/>
  </Invite>
  <Invite id="556" createdAt="1700000100" email="other@example.com" username="other" friend="0" home="1" server="1">
    <Server name="Cerberus" numLibraries="2"/>
  </Invite>
</MediaContainer>`;

describe('PlexClient.getPendingInvites', () => {
  it('parses the pending invites XML fixture from plex.tv/api/invites/requested', async () => {
    const fetcher = vi.fn().mockResolvedValue(xmlResponse(PENDING_INVITES_XML));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.getPendingInvites();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([
      { id: '555', invitedEmail: 'friend@example.com', friend: true, home: false, server: true },
      { id: '556', invitedEmail: 'other@example.com', friend: false, home: true, server: true },
    ]);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://plex.tv/api/invites/requested');
    expect(init.method).toBe('GET');
  });

  it('handles a single Invite with no siblings without collapsing the array', async () => {
    const singleInviteXml = `<MediaContainer size="1">
      <Invite id="555" createdAt="1700000000" email="friend@example.com" username="friend" friend="1" home="0" server="1">
        <Server name="Cerberus" numLibraries="2"/>
      </Invite>
    </MediaContainer>`;
    const fetcher = vi.fn().mockResolvedValue(xmlResponse(singleInviteXml));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.getPendingInvites();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([
      { id: '555', invitedEmail: 'friend@example.com', friend: true, home: false, server: true },
    ]);
  });

  it('returns an empty list when there are no pending invites', async () => {
    const fetcher = vi.fn().mockResolvedValue(xmlResponse('<MediaContainer size="0"/>'));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.getPendingInvites();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('returns a typed http error on a non-2xx response', async () => {
    const fetcher = vi.fn().mockResolvedValue(xmlResponse('unauthorized', 401));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.getPendingInvites();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('http');
    expect(result.error.status).toBe(401);
  });

  it('returns a typed invalid_response error when an Invite is missing required attributes', async () => {
    const missingEmailXml = `<MediaContainer size="1">
      <Invite id="555" createdAt="1700000000" username="friend" friend="1" home="0" server="1"/>
    </MediaContainer>`;
    const fetcher = vi.fn().mockResolvedValue(xmlResponse(missingEmailXml));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.getPendingInvites();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('invalid_response');
  });
});

describe('PlexClient.cancelInvite', () => {
  it('sends a DELETE with the invite id and friend/home/server flags in the query string', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.cancelInvite({ id: '555', invitedEmail: 'friend@example.com', friend: true, home: false, server: true });
    expect(result.ok).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://plex.tv/api/invites/requested/555?friend=1&home=0&server=1');
    expect(init.method).toBe('DELETE');
  });

  it('returns a typed http error when the delete fails', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const client = createPlexClient({ ...baseOpts, fetcher });
    const result = await client.cancelInvite({ id: '555', invitedEmail: 'friend@example.com', friend: true, home: false, server: true });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('http');
    expect(result.error.status).toBe(404);
  });
});
