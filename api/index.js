const https = require('https');

const API_URL = process.env.VITE_API_URL || process.env.VITE_API_BASE_URL || 'https://coopvest-api.onrender.com';

const FORWARD_HEADERS = [
  'authorization',
  'content-type',
  'x-service-token',
  'x-admin-id',
  'x-requested-with',
  'accept',
];

module.exports = (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(204);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Service-Token, X-Admin-ID, X-Requested-With, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.end();
    return;
  }

  let apiPath = req.url.split('?')[0];

  if (!apiPath.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found', path: apiPath });
    return;
  }

  // Forward the full path (including /api prefix) and query string to the backend
  const targetUrl = `${API_URL}${req.url}`;
  const url = new URL(targetUrl);

  const headers = { 'User-Agent': 'Coopvest-Admin-Vercel/1.0' };
  for (const h of FORWARD_HEADERS) {
    const v = req.headers[h];
    if (v) headers[h.charAt(0).toUpperCase() + h.slice(1)] = v;
  }
  if (!headers['Content-Type'] && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
    headers['Content-Type'] = 'application/json';
  }

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: req.method,
    headers,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    if (proxyRes.headers['content-type']) res.setHeader('Content-Type', proxyRes.headers['content-type']);
    if (proxyRes.headers['access-control-allow-origin']) res.setHeader('Access-Control-Allow-Origin', proxyRes.headers['access-control-allow-origin']);
    if (proxyRes.headers['access-control-allow-credentials']) res.setHeader('Access-Control-Allow-Credentials', proxyRes.headers['access-control-allow-credentials']);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Backend API unavailable', message: err.message });
  });

  // Collect and forward the request body for methods that have one (including DELETE with body)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      if (body.length > 0) proxyReq.write(body);
      proxyReq.end();
    });
  } else {
    proxyReq.end();
  }
};
