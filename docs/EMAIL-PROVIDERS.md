# Email providers

Tortuga sends through one provider at a time, selected by
`newsletter.email.provider` (`resend` or `mailgun`). Both require a verified
sending domain for your `from.email` address. Delivery/bounce/complaint events
are recorded via signed webhooks.

> [!WARNING]
> The **webhook signing secret** is not the same as the **API key**. Resend's
> `RESEND_WEBHOOK_SECRET` and Mailgun's `MAILGUN_WEBHOOK_SIGNING_KEY` come from
> each provider's webhook settings, not the API-keys page. A missing or invalid
> signature causes the webhook endpoint to reject the request with `401`.

One Tortuga instance maps to one sending domain / provider. Running multiple
Plex servers means separate Tortuga instances (or separate domains).

---

## Resend

### 1. Verify your sending domain

In the Resend dashboard → **Domains** → add your domain and create the DNS
records it lists (SPF, DKIM, and a DMARC record). Wait for verification before
sending. `from.email` in `tortuga.yml` must be on this domain.

### 2. API key

Resend dashboard → **API Keys** → create a key with send permission. Set it as
`RESEND_API_KEY`.

### 3. Webhook (delivery events)

1. Resend dashboard → **Webhooks** → add an endpoint pointing at
   `https://YOUR_APP_URL/api/webhooks/resend`.
2. Subscribe to the events you care about (`email.delivered`, `email.bounced`,
   `email.complained`, `email.failed`).
3. Copy the endpoint's **signing secret** and set it as `RESEND_WEBHOOK_SECRET`.

Signature: Tortuga reads the `Resend-Signature` header (`t=<ts>,v1=<hmac>`),
checks the timestamp is within a 300s tolerance, and verifies an HMAC-SHA256 of
`<ts>.<body>` using the signing secret. Mapped event types:

| Resend type | Normalized |
|---|---|
| `email.delivered` | `delivered` |
| `email.bounced` | `bounced` |
| `email.complained` | `complained` |
| `email.failed` | `failed` |

Anything else is stored as `other`. Terminal types update the matching `sends`
row's status.

> The Resend webhook endpoint returns `404` if the deployed provider is not
> `resend`, and `401` if `RESEND_WEBHOOK_SECRET` is unset or the signature is
> invalid.

---

## Mailgun

### 1. Add and verify your domain

Mailgun dashboard → **Sending → Domains** → add your domain and create the
listed SPF/DKIM (and recommended DMARC) DNS records. Note which **region** your
account is in — `us` (default) or `eu`. Set both:

```yaml
# tortuga.yml
newsletter:
  email:
    provider: mailgun
    mailgun:
      domain: mg.yourdomain.com
      region: us   # or eu
```

`eu` routes API calls to `https://api.eu.mailgun.net`; `us` uses
`https://api.mailgun.net`.

### 2. API key and webhook signing key

- **API key**: Mailgun → **Settings → API keys** → your private API key →
  `MAILGUN_API_KEY`.
- **Webhook signing key**: Mailgun → **Settings → Webhooks** → the HTTP webhook
  signing key → `MAILGUN_WEBHOOK_SIGNING_KEY`. This is distinct from the API
  key.

The provider factory throws on startup if `provider=mailgun` and any of
`MAILGUN_API_KEY`, `MAILGUN_WEBHOOK_SIGNING_KEY`, or `mailgun.domain` is missing.

### 3. Webhook (delivery events)

Mailgun → **Sending → Webhooks** for your domain → point the relevant events
(delivered, permanent failure, complained, etc.) at
`https://YOUR_APP_URL/api/webhooks/mailgun`.

Signature: Mailgun embeds the signature inside the JSON body
(`signature: { timestamp, token, signature }`). Tortuga verifies an
HMAC-SHA256 of `<timestamp><token>` using the signing key.

> The Mailgun webhook endpoint returns `404` if the deployed provider is not
> `mailgun`, and `401` if `MAILGUN_WEBHOOK_SIGNING_KEY` is unset or the
> signature is invalid.

---

## Testing delivery

- In the admin UI: **Settings → Test connections** pings the configured provider
  and reports a per-service status. **Newsletter → Preview → Send test to me**
  sends the previewed digest to a single address.
- After a real send, webhook events land in the `send_events` table and update
  the matching `sends` row. Confirm the webhook is wired by checking that rows
  appear after a delivery.
- Set `LOG_LEVEL=debug` to see webhook receipt and verification logs. An unset
  signing secret logs a warning and the endpoint returns `401`.

### Smoke-test a webhook endpoint

A request with no/invalid signature should be rejected — useful to confirm the
route is reachable and signature-checked:

```bash
curl -i -X POST "$APP_URL/api/webhooks/resend" \
  -H "Content-Type: application/json" \
  -d '{"type":"email.delivered","data":{"email_id":"test"}}'
# expect: HTTP 401 (invalid/missing signature) — or 404 if provider != resend
```
