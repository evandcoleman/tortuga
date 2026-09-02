/** Minimal styled HTML confirmation/error page shared by the unsubscribe and resubscribe routes. */
export function htmlPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font-family:system-ui,sans-serif;background:#0f1115;color:#e7e9ee;min-height:100vh;display:grid;place-items:center;padding:24px}
  .card{max-width:480px;background:#181c25;border-radius:12px;padding:32px}
  h1{margin:0 0 12px 0;font-size:22px}
  p{line-height:1.5}
  a{color:#8ab4ff}
  form{margin-top:12px}
  button{font:inherit;background:#2a3040;color:#e7e9ee;border:1px solid #3a4155;border-radius:8px;padding:8px 14px;cursor:pointer}
  button:hover{background:#333a4d}</style></head>
  <body><div class="card"><h1>${title}</h1>${body}</div></body></html>`;
}
