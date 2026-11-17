# Sync worker

Cloudflare Worker + KV that merges dose lists between devices.

```
cd worker
npx wrangler login
npx wrangler deploy
```

Wrangler prints a URL like `https://paracetamol-sync.<you>.workers.dev`.
Paste it into `SYNC_URL` near the top of the script in `../index.html`, then commit and push.

`ALLOWED_ORIGIN` in `wrangler.toml` must match the site that serves the app.
