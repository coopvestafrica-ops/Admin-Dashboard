import { NextRequest, NextResponse } from 'next/server';

// Backend API URL - points to the Express API on Render
const API_BASE_URL = 'https://coopvest-api.onrender.com';

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
  
  // Forward the Authorization header (user's JWT token)
  const authHeader = request.headers.get('authorization');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers,
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
  
  // Forward the Authorization header (user's JWT token)
  const authHeader = request.headers.get('authorization');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
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
  
  // Forward the Authorization header (user's JWT token)
  const authHeader = request.headers.get('authorization');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  
  const response = await fetch(targetUrl, {
    method: 'PUT',
    headers,
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
  
  // Forward the Authorization header (user's JWT token)
  const authHeader = request.headers.get('authorization');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  
  const response = await fetch(targetUrl, {
    method: 'PATCH',
    headers,
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
  
  // Forward the Authorization header (user's JWT token)
  const authHeader = request.headers.get('authorization');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  
  const response = await fetch(targetUrl, {
    method: 'DELETE',
    headers,
  });
  
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}