import { HOME_308 } from './identity.js';
import {
  aiTxt,
  bagHtml,
  llmsFullTxt,
  llmsTxt,
  robotsTxt,
  sitemapXml,
  whichHtml,
  workerHomeHtml,
} from './pages.js';
import { rewriteHome } from './rewrite.js';

export { HOME_308 } from './identity.js';
export { rewriteHome, stripHomeOtherCoinWarning } from './rewrite.js';
export {
  bagHtml,
  whichHtml,
  llmsTxt,
  llmsFullTxt,
  robotsTxt,
  sitemapXml,
  workerHomeHtml,
} from './pages.js';

const HTML_SECURITY = {
  'content-security-policy': "frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000',
};

function normalizePath(pathname) {
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function edgeHeaders(kind, type, extra) {
  const headers = new Headers({
    'content-type': type,
    'cache-control': 'public, max-age=300',
    'x-dasha-edge': kind,
    ...HTML_SECURITY,
    ...extra,
  });
  if (type.includes('text/html')) {
    headers.append('link', '</llms.txt>; rel="describedby"');
    headers.append('link', '</llms-full.txt>; rel="describedby"');
  }
  return headers;
}

function textResponse(body, kind, type) {
  return new Response(body, {
    status: 200,
    headers: edgeHeaders(kind, type),
  });
}

function htmlResponse(body, kind) {
  return new Response(body, {
    status: 200,
    headers: edgeHeaders(kind, 'text/html; charset=utf-8'),
  });
}

function redirectHome(request) {
  const url = new URL(request.url);
  return new Response(null, {
    status: 308,
    headers: { location: `${url.origin}/${url.search}` },
  });
}

function notFound() {
  return new Response('Not found', {
    status: 404,
    headers: edgeHeaders('html-404', 'text/html; charset=utf-8', {
      'x-robots-tag': 'noindex, nofollow',
    }),
  });
}

async function originHome(request, env) {
  const origin = env && typeof env.ORIGIN === 'string' ? env.ORIGIN.trim() : '';
  if (!origin) return workerHomeHtml();
  try {
    const incoming = new URL(request.url);
    const target = new URL(incoming.pathname + incoming.search, origin);
    const res = await fetch(target.toString(), {
      headers: { 'user-agent': request.headers.get('user-agent') || 'getdasha-worker' },
      redirect: 'follow',
    });
    if (!res.ok) return workerHomeHtml();
    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/html')) return workerHomeHtml();
    return await res.text();
  } catch {
    return workerHomeHtml();
  }
}

export async function handleRequest(request, env = {}) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  const url = new URL(request.url);
  const path = normalizePath(url.pathname);

  let response;
  if (HOME_308.includes(path)) {
    response = redirectHome(request);
  } else if (path === '/') {
    const html = rewriteHome(await originHome(request, env));
    response = htmlResponse(html, 'html-security');
  } else if (path === '/bag') {
    response = htmlResponse(bagHtml(), 'bag');
  } else if (path === '/which') {
    response = htmlResponse(whichHtml(), 'which');
  } else if (path === '/llms.txt') {
    response = textResponse(llmsTxt(), 'llms', 'text/plain; charset=utf-8');
  } else if (path === '/llms-full.txt') {
    response = textResponse(llmsFullTxt(), 'llms-full', 'text/plain; charset=utf-8');
  } else if (path === '/ai.txt') {
    response = textResponse(aiTxt(), 'ai', 'text/plain; charset=utf-8');
  } else if (path === '/sitemap.xml') {
    response = textResponse(sitemapXml(), 'sitemap', 'application/xml; charset=utf-8');
  } else if (path === '/robots.txt') {
    response = textResponse(robotsTxt(), 'robots', 'text/plain; charset=utf-8');
  } else {
    response = notFound();
  }

  if (request.method === 'HEAD') {
    return new Response(null, { status: response.status, headers: response.headers });
  }
  return response;
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
