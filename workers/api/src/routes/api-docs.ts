/**
 * @degenfeed/api-worker — API documentation routes
 *
 * Serves the OpenAPI 3.1 specification and a Swagger UI HTML page
 * for interactive API exploration.
 *
 * Endpoints:
 *   GET /api/docs/openapi.json  — OpenAPI 3.1 spec (versionless)
 *   GET /api/docs               — Swagger UI HTML (versionless)
 *   GET /v1/docs/openapi.json   — OpenAPI 3.1 spec (v1 path)
 *   GET /v1/docs                — Swagger UI HTML (v1 path)
 */

import openapiSpec from '../../openapi.json';
import type { Env } from '../index';

// ─── Swagger UI HTML template ──────────────────────────────────────
// Dark theme matching DegenFeed brand. Loads Swagger UI from CDN so
// no npm dependency is needed. The spec is fetched via a relative URL.

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="DegenFeed API — Interactive Documentation" />
  <title>DegenFeed API — Swagger UI</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e0e0e0; }
    .topbar { background: #111; border-bottom: 1px solid #222; padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
    .topbar h1 { font-size: 18px; font-weight: 600; color: #00ff41; }
    .topbar .subtitle { font-size: 13px; color: #888; }
    .topbar a { color: #00ff41; text-decoration: none; margin-left: auto; font-size: 13px; }
    .topbar a:hover { text-decoration: underline; }
    .version-badge { background: #00ff41; color: #000; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; }
    .swagger-ui { max-width: 1460px; margin: 0 auto; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #e0e0e0 !important; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .scheme-container { background: #151515 !important; box-shadow: none !important; border: 1px solid #222; border-radius: 8px; padding: 16px !important; margin: 16px 0; }
    .swagger-ui .opblock-tag { border-bottom: 1px solid #222 !important; }
    .swagger-ui .opblock-tag:hover { background: #151515 !important; }
    .swagger-ui .opblock { border-radius: 8px !important; border: 1px solid #222 !important; margin-bottom: 8px !important; }
    .swagger-ui .opblock .opblock-summary { border-radius: 8px !important; }
    .swagger-ui .opblock .opblock-summary-description { color: #aaa !important; }
    .swagger-ui .opblock.opblock-get { background: rgba(97, 175, 254, 0.06) !important; border-color: #61affe !important; }
    .swagger-ui .opblock.opblock-post { background: rgba(73, 204, 144, 0.06) !important; border-color: #49cc90 !important; }
    .swagger-ui .opblock.opblock-delete { background: rgba(249, 62, 62, 0.06) !important; border-color: #f93e3e !important; }
    .swagger-ui .opblock.opblock-put { background: rgba(252, 161, 48, 0.06) !important; border-color: #fca130 !important; }
    .swagger-ui .opblock.opblock-patch { background: rgba(80, 227, 194, 0.06) !important; border-color: #50e3c2 !important; }
    .swagger-ui .btn.authorize { background: #00ff41 !important; color: #000 !important; border-color: #00ff41 !important; font-weight: 600 !important; }
    .swagger-ui .btn.authorize svg { fill: #000 !important; }
    .swagger-ui input[type="text"] { background: #222 !important; color: #e0e0e0 !important; border-color: #333 !important; }
    .swagger-ui select { background: #222 !important; color: #e0e0e0 !important; border-color: #333 !important; }
    .swagger-ui .response-col_status { color: #e0e0e0 !important; }
    .swagger-ui .response-col_description { color: #ccc !important; }
    .swagger-ui .model-box { background: #151515 !important; }
    .swagger-ui .model { color: #e0e0e0 !important; }
    .swagger-ui .model-title { color: #e0e0e0 !important; }
    .swagger-ui .property-row { color: #ccc !important; }
    .swagger-ui .property-row .property-name { color: #aaa !important; }
    .swagger-ui .renderedMarkdown p { color: #ccc !important; }
    .swagger-ui .parameter__name { color: #e0e0e0 !important; }
    .swagger-ui .parameter__type { color: #888 !important; }
    .swagger-ui .parameters-col_description { color: #aaa !important; }
    .swagger-ui table thead tr td, .swagger-ui table thead tr th { border-bottom-color: #333 !important; color: #aaa !important; }
    .swagger-ui .loading-container { padding: 40px; text-align: center; color: #888; }
    .swagger-ui .errors { color: #f93e3e !important; }
    .swagger-ui .markdown p, .swagger-ui .markdown li { color: #ccc !important; }
    .swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5 { color: #e0e0e0 !important; }
    .swagger-ui .responses-inner .response-col_links { display: none; }
    footer { text-align: center; padding: 24px; color: #555; font-size: 12px; }
    footer a { color: #00ff41; text-decoration: none; }
  </style>
</head>
<body>
  <div class="topbar">
    <span class="version-badge">v1</span>
    <h1>DegenFeed API</h1>
    <span class="subtitle">Interactive Documentation</span>
    <a href="https://degenfeed.xyz/docs" target="_blank" rel="noopener">📖 Full Docs →</a>
  </div>
  <div id="swagger-ui"></div>
  <footer>
    Powered by <a href="https://swagger.io" target="_blank" rel="noopener">Swagger UI</a> ·
    <a href="$SPEC_URL" target="_blank">openapi.json</a> ·
    <a href="https://degenfeed.xyz" target="_blank" rel="noopener">DegenFeed</a>
  </footer>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function () {
      SwaggerUIBundle({
        url: window.location.pathname.replace(/\\/?$/, '') + '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset,
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl,
        ],
        layout: 'BaseLayout',
        docExpansion: 'list',
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        tryItOutEnabled: false,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        supportedSubmitMethods: [],
      });
    };
  </script>
</body>
</html>`;

// ─── Handler: serve OpenAPI spec JSON ─────────────────────────────

/**
 * GET /api/docs/openapi.json or GET /v1/docs/openapi.json
 *
 * Serves the static OpenAPI 3.1 specification from the bundled JSON
 * import. The spec is compiled into the worker bundle at build time
 * by esbuild (resolveJsonModule + bundler module resolution).
 */
export async function handleOpenApiJson(_request: Request, _env: Env): Promise<Response> {
  return new Response(JSON.stringify(openapiSpec, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600',
    },
  });
}

// ─── Handler: serve Swagger UI HTML ───────────────────────────────

/**
 * GET /api/docs or GET /v1/docs
 *
 * Returns an HTML page with Swagger UI pre-configured to load the
 * OpenAPI spec from the same path + /openapi.json.
 */
export async function handleApiDocs(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const specUrl = `${url.pathname.replace(/\/?$/, '')}/openapi.json`;
  const html = SWAGGER_HTML.replace('$SPEC_URL', specUrl);

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
