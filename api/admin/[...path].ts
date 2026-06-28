import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://coopvest-api-v3.onrender.com';

// Supabase service role key - used for backend authentication
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b2F1enFlenB4ZW9ubXJ4eGdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4MjczNSwiZXhwIjoyMDg5ODU4NzM1fQ.zCX5ZMW42kwjszRmT6HREZOCjTs5z7ZlXidK4BM-coM';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join('/');
  const url = new URL(request.url);
  const queryString = url.search || '';
  
  const targetUrl = `${API_BASE_URL}/api/${apiPath}${queryString}`;
  
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join('/');
  const body = await request.json();
  
  const targetUrl = `${API_BASE_URL}/api/${apiPath}`;
  
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join('/');
  const body = await request.json();
  
  const targetUrl = `${API_BASE_URL}/api/${apiPath}`;
  
  const response = await fetch(targetUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join('/');
  const body = await request.json();
  
  const targetUrl = `${API_BASE_URL}/api/${apiPath}`;
  
  const response = await fetch(targetUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join('/');
  
  const targetUrl = `${API_BASE_URL}/api/${apiPath}`;
  
  const response = await fetch(targetUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}