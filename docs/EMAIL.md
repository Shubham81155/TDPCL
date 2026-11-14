# Email

Outgoing mail (password reset, complaint confirmation, officer assignment, status updates, admin
notification) is sent by `src/services/notificationService.js`. Transport selection lives in
`src/services/mailTransport.js`. Delivery never blocks or fails a request: errors are logged and swallowed.

## Configuration

| Variable | Meaning |
| --- | --- |
| `EMAIL_SERVICE` | `gmail` (default), `sendgrid`, `smtp` or `none` |
| `EMAIL_FROM` | From address for all mail. Fallback: `EMAIL_USER`, then `no-reply@localhost` |
| `EMAIL_USER` / `EMAIL_PASSWORD` | Gmail (use an app password) |
| `SENDGRID_API_KEY` | SendGrid |
| `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_SECURE` (`true` for 465) | Generic SMTP |
| `SMTP_USER` / `SMTP_PASSWORD` | Optional. No authentication when `SMTP_USER` is empty |

Values that look like placeholders from `.env.example` (`your_...`, `..._here`) count as not configured.
When nothing usable is configured the app logs one `email disabled: ...` warning at startup and every
send returns quietly. In production, `EMAIL_SERVICE=smtp` requires `SMTP_HOST`.

Never commit real credentials; keep them in `.env` (git-ignored) or your secret store.

## Local capture server

```
node scripts/dev-smtp-sink.js      # SMTP 127.0.0.1:1025, HTTP 127.0.0.1:8025
```

Run the backend with `EMAIL_SERVICE=smtp SMTP_HOST=127.0.0.1 SMTP_PORT=1025 SMTP_SECURE=false`, then
`GET http://127.0.0.1:8025/messages` lists captured mail as JSON and `DELETE /messages` clears it.
Ports can be changed with `SINK_SMTP_PORT` / `SINK_HTTP_PORT`. Mailpit works equally well.

## End-to-end verification

```
node scripts/verify-email.js
```

Starts the sink and a second backend on port 5055 (SMTP overrides, your `.env` for the database), creates
tagged temporary users, then checks: password-reset mail and a working token, complaint confirmation /
officer / admin mails, HTML escaping, and that requests still succeed with the sink down. Everything it
creates is deleted afterwards and the leftover count is printed (must be 0). Exit code is non-zero on any
failure. Note that admin notification goes to every admin address in the database, but only to the local
sink, never to the real addresses.
