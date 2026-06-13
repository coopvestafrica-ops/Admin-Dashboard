import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nyoauzqezpxeonmrxxgi.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b2F1enFlenB4ZW9ubXJ4eGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODI3MzUsImV4cCI6MjA4OTg1ODczNX0.5WfECoO2Xu5VfBzFbQd2CA8rIeBVnOkiKmnnbYRA8VU';

const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_ROLES = ['super_admin', 'admin', 'operator', 'viewer'];

function getAuthToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
}

function toAdmin(p: any) {
  return {
    id: p.id,
    name: p.name || p.email || 'Unknown',
    email: p.email || '',
    role: p.role || 'viewer',
    status: p.is_active ? 'active' : 'inactive',
    lastActive: p.updated_at,
    createdAt: p.created_at,
    customPermissions: p.custom_permissions || [],
  };
}

// GET /api/roles - Get admin staff
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, is_active, updated_at, created_at, custom_permissions')
      .in('role', ADMIN_ROLES)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ admins: (data ?? []).map(toAdmin) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}