# Cercis Garden — Cloudflare Worker

This is the Cloudflare version of Cercis Garden. It keeps the bot's existing behavior but replaces long-running Python polling + local SQLite with a Cloudflare Worker webhook + D1 database.

## Required resources

- Cloudflare Worker
- Cloudflare D1 database named `cercis-garden`
- Telegram bot token
- Telegram admin numeric ID
- Optional webhook secret

## Deploy

From this directory:

```bash
npm install
npx wrangler d1 create cercis-garden
```

Put the returned D1 `database_id` into `wrangler.toml` if Wrangler did not update it automatically.

Set the Telegram credentials as Worker secrets:

```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put WEBHOOK_SECRET
```

Set `ADMIN_ID` in `wrangler.toml` or as a Worker variable.

Then:

```bash
npm run db:migrate
npx wrangler deploy
```

The deployed Worker URL will be similar to:

`https://cercis-garden.<your-subdomain>.workers.dev`

## Telegram webhook

After deployment, set the Telegram webhook to the Worker URL. If `WEBHOOK_SECRET` is configured, send the same value as Telegram's `secret_token` parameter.

Example:

```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https%3A%2F%2F<WORKER_URL>&secret_token=<WEBHOOK_SECRET>
```

Do not commit the bot token or webhook secret to GitHub.

## Database

D1 contains the same `tracks` fields used by the existing bot, plus a small `sessions` table so the admin add/edit/delete flow can survive between webhook requests.

The original `bot.py` is intentionally untouched. This branch is a separate Cloudflare implementation.
