import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = req.query.userId as string;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  
  // Get API URL from environment - Vercel uses VITE_ prefix for client-side vars
  // but serverless functions use directly
  const API_BASE_URL = process.env.API_BASE_URL || process.env.VITE_API_BASE_URL;
  
  if (!API_BASE_URL) {
    console.error('API_BASE_URL not configured');
    res.status(500).json({ error: 'API server not configured' });
    return;
  }
  
  try {
    const fetchUrl = `${API_BASE_URL}/members/user/${userId}`;
    console.log('Proxying request to:', fetchUrl);
    
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