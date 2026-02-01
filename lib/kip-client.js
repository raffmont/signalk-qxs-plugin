'use strict';

/**
 * KIP client helper.
 * - GET /plugins/kip/displays -> list of displays (implementation depends on KIP; we treat it as opaque objects)
 * - Read dashboards from self.displays.<uuid>.screenIndex (Signal K data)
 * - Write active dashboard to self.displays.<uuid>.activeScreen (Signal K PUT)
 *
 * This file avoids strong assumptions about KIP internal structures.
 */

function buildBaseUrl(app) {
  // Best-effort for common Signal K server configs
  const port = (app?.config?.settings?.port) || 3000;
  const ssl = !!(app?.config?.settings?.ssl);
  const proto = ssl ? 'https' : 'http';
  return `${proto}://127.0.0.1:${port}`;
}

async function skFetch(app, url, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `JWT ${token}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${url} -> ${res.status} ${res.statusText} ${text}`.trim());
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

async function getKipDisplays(app, token) {
  const base = buildBaseUrl(app);
  const url = `${base}/plugins/kip/displays`;
  return skFetch(app, url, { token });
}

async function getSelfPathValue(app, skPath, token) {
  // Signal K v1 API self path:
  // /signalk/v1/api/vessels/self/<path>
  const base = buildBaseUrl(app);
  const url = `${base}/signalk/v1/api/vessels/self/${encodeURIComponent(skPath).replaceAll('%2F','/')}`;
  return skFetch(app, url, { token });
}

async function putSelfPathValue(app, skPath, value, token) {
  const base = buildBaseUrl(app);
  const url = `${base}/signalk/v1/api/vessels/self/${encodeURIComponent(skPath).replaceAll('%2F','/')}`;
  // Signal K PUT expects { value: ... }
  return skFetch(app, url, { token, method: 'PUT', body: { value } });
}

module.exports = {
  buildBaseUrl,
  getKipDisplays,
  getSelfPathValue,
  putSelfPathValue
};
