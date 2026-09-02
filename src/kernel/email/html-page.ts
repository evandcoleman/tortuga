/**
 * Shared dark-card layout for the small standalone HTML pages served outside
 * the admin app (unsubscribe confirmation, preferences form). Keeping this
 * in one place means the two pages stay visually consistent without either
 * one importing from the other.
 */
export function htmlPage(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font-family:system-ui,sans-serif;background:#0f1115;color:#e7e9ee;min-height:100vh;display:grid;place-items:center;padding:24px}
  .card{max-width:480px;background:#181c25;border-radius:12px;padding:32px}
  h1{margin:0 0 12px 0;font-size:22px}
  p{line-height:1.5}
  a{color:#8ab4ff}
  label{display:block;margin:12px 0;font-size:15px}
  input[type=checkbox]{margin-right:8px}
  form{margin-top:12px}
  button{font:inherit;margin-top:20px;padding:10px 20px;border-radius:8px;border:none;background:#4f7cff;color:#fff;font-size:15px;cursor:pointer}
  button:hover{background:#3d63d6}
  .saved{color:#7fd88f;font-size:14px;margin-top:0}</style></head>
  <body><div class="card"><h1>${title}</h1>${bodyHtml}</div></body></html>`;
}
