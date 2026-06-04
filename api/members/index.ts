import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Member, MembersListResponse, MemberStats } from '@workspace/api-client-react';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const API_BASE_URL = process.env.API_BASE_URL || process.env.VITE_API_BASE_URL;

  if (!API_BASE_URL) {
    console.error('API_BASE_URL not configured');
    res.status(500).json({ error: 'API server not configured' });
    return;
  }

  try {
    // Build query params
    const params = new URLSearchParams();
    if (req.query.status) params.append('status', req.query.status as string);
    if (req.query.search) params.append('search', req.query.search as string);
    if (req.query.page) params.append('page', req.query.page as string);
    if (req.query.limit) params.append('limit', req.query.limit as string);

    const queryString = params.toString();
    const fetchUrl = `${API_BASE_URL}/members${queryString ? `?${queryString}` : ''}`;
    console.log('Proxying members list request to:', fetchUrl);

    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || '',
      },
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ error: 'Bad Gateway', message: 'Unable to reach the API server' });
  }
}
