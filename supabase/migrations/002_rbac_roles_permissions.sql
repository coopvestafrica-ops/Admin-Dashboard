-- ═══════════════════════════════════════════════════════════════════════════════
-- CoopVest Africa — Role-Based Access Control (RBAC) Migration
-- Run this in your Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. admin_roles table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key    text          UNIQUE NOT NULL,
  label       text          NOT NULL,
  description text,
  color       text          DEFAULT '#6b7280',
  icon        text          DEFAULT 'shield',
  hierarchy   integer       NOT NULL DEFAULT 1,
  is_active   boolean      DEFAULT true,
  created_at  timestamptz   DEFAULT now()
);

-- ── 2. admin_permissions table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  perm_key    text          UNIQUE NOT NULL,
  label       text          NOT NULL,
  description text,
  category    text          NOT NULL,
  icon        text          DEFAULT 'key',
  is_active   boolean      DEFAULT true,
  created_at  timestamptz   DEFAULT now()
);

-- ── 3. role_permissions table (many-to-many) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       uuid          REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  permission_id uuid          REFERENCES public.admin_permissions(id) ON DELETE CASCADE,
  created_at    timestamptz   DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- ── 4. Add custom_permissions column to profiles ─────────────────────────────
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS custom_permissions text[] DEFAULT '{}';

-- ── 5. Seed default roles ─────────────────────────────────────────────────────
INSERT INTO public.admin_roles (role_key, label, description, color, icon, hierarchy) VALUES
  ('super_admin', 'Super Admin', 'Full system access. Can create staff, assign roles, manage all settings.', '#7c3aed', 'shield-check', 100),
  ('admin', 'Admin', 'Full operational access to most features except system settings.', '#2563eb', 'shield', 80),
  ('operator', 'Operator', 'Can process loans, contributions, and manage day-to-day operations.', '#16a34a', 'settings', 60),
  ('viewer', 'Viewer', 'Read-only access to dashboard and reports.', '#6b7280', 'eye', 40)
ON CONFLICT (role_key) DO NOTHING;

-- ── 6. Seed default permissions ────────────────────────────────────────────────
INSERT INTO public.admin_permissions (perm_key, label, description, category, icon) VALUES
  -- User Management
  ('users.view', 'View Members', 'View member list and profiles', 'User Management', 'users'),
  ('users.edit', 'Edit Member Details', 'Edit member information', 'User Management', 'user-cog'),
  ('users.suspend', 'Suspend/Freeze Users', 'Suspend or freeze member accounts', 'User Management', 'ban'),
  ('users.verify', 'Verify KYC', 'Approve or reject KYC documents', 'User Management', 'check-circle'),
  ('users.create', 'Create Members', 'Manually create member accounts', 'User Management', 'user-plus'),
  -- Finance
  ('finance.view', 'View Financial Data', 'View contributions, investments, wallets', 'Finance', 'bar-chart-3'),
  ('finance.approve', 'Approve Payments', 'Approve withdrawals and disbursements', 'Finance', 'check-circle'),
  ('finance.reverse', 'Reverse Transactions', 'Reverse failed or incorrect transactions', 'Finance', 'rotate-ccw'),
  ('finance.adjust', 'Adjust Balances', 'Manually adjust member balances', 'Finance', 'sliders'),
  ('finance.contributions', 'Manage Contributions', 'Process and manage contributions', 'Finance', 'dollar-sign'),
  ('finance.investments', 'Manage Investments', 'Create and manage investment products', 'Finance', 'trending-up'),
  -- Loans
  ('loans.view', 'View Loans', 'View loan applications and history', 'Loans', 'credit-card'),
  ('loans.approve', 'Approve/Reject Loans', 'Approve or reject loan applications', 'Loans', 'check-circle'),
  ('loans.manage', 'Freeze / Penalties', 'Apply penalties or freeze loans', 'Loans', 'lock'),
  ('loans.restructure', 'Restructure Loans', 'Modify loan terms and schedules', 'Loans', 'refresh-cw'),
  ('loans.guarantors', 'Manage Guarantors', 'View and manage loan guarantors', 'Loans', 'users'),
  -- Organizations
  ('orgs.view', 'View Organizations', 'View employer organizations', 'Organizations', 'building-2'),
  ('orgs.manage', 'Manage Organizations', 'Create and manage employer organizations', 'Organizations', 'building'),
  ('orgs.payroll', 'Manage Payroll', 'Upload and process payroll data', 'Organizations', 'file-spreadsheet'),
  -- Reports
  ('reports.view', 'View Reports', 'Access standard reports', 'Reports', 'file-text'),
  ('reports.export', 'Export Reports', 'Export reports to Excel/PDF', 'Reports', 'download'),
  ('reports.custom', 'Custom Reports', 'Create and save custom reports', 'Reports', 'bar-chart'),
  -- System
  ('system.settings', 'System Settings', 'Access system configuration', 'System', 'settings'),
  ('system.audit', 'View Audit Logs', 'View admin activity logs', 'System', 'shield'),
  ('system.roles', 'Manage Roles & Staff', 'Create admins and assign roles', 'System', 'user-cog'),
  ('system.security', 'Security Controls', 'Manage 2FA, session controls', 'System', 'shield-check'),
  ('system.features', 'Toggle Features', 'Enable/disable app features', 'System', 'toggle-left'),
  ('system.backup', 'Backup & Export', 'Download database backups', 'System', 'database'),
  -- Support
  ('support.view', 'View Support Tickets', 'View member support requests', 'Support', 'life-buoy'),
  ('support.manage', 'Manage Support Tickets', 'Reply and resolve tickets', 'Support', 'message-circle'),
  -- Compliance
  ('compliance.view', 'View Compliance', 'View compliance reports', 'Compliance', 'clipboard-check'),
  ('compliance.manage', 'Manage Compliance', 'Handle compliance violations', 'Compliance', 'alert-triangle'),
  -- Notifications
  ('notifications.view', 'View Notifications', 'View sent notifications', 'Notifications', 'bell'),
  ('notifications.send', 'Send Notifications', 'Send bulk notifications', 'Notifications', 'send'),
  ('notifications.templates', 'Manage Templates', 'Create notification templates', 'Notifications', 'mail')
ON CONFLICT (perm_key) DO NOTHING;

-- ── 7. Seed default role_permissions ────────────────────────────────────────
-- Get role IDs
DO $$
DECLARE
  super_admin_id uuid;
  admin_id uuid;
  operator_id uuid;
  viewer_id uuid;
BEGIN
  SELECT id INTO super_admin_id FROM public.admin_roles WHERE role_key = 'super_admin';
  SELECT id INTO admin_id FROM public.admin_roles WHERE role_key = 'admin';
  SELECT id INTO operator_id FROM public.admin_roles WHERE role_key = 'operator';
  SELECT id INTO viewer_id FROM public.admin_roles WHERE role_key = 'viewer';
  
  -- Super Admin gets ALL permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT super_admin_id, id FROM public.admin_permissions
  ON CONFLICT DO NOTHING;
  
  -- Admin gets most permissions except system.backup
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT admin_id, id FROM public.admin_permissions
  WHERE perm_key != 'system.backup'
  ON CONFLICT DO NOTHING;
  
  -- Operator gets operational permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT operator_id, id FROM public.admin_permissions
  WHERE perm_key IN (
    'users.view', 'users.verify', 'users.edit',
    'finance.view', 'finance.approve', 'finance.contributions',
    'loans.view', 'loans.approve', 'loans.manage', 'loans.restructure', 'loans.guarantors',
    'orgs.view', 'orgs.payroll',
    'reports.view', 'reports.export',
    'support.view', 'support.manage',
    'compliance.view',
    'notifications.view', 'notifications.send'
  )
  ON CONFLICT DO NOTHING;
  
  -- Viewer gets read-only permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT viewer_id, id FROM public.admin_permissions
  WHERE perm_key IN (
    'users.view',
    'finance.view',
    'loans.view',
    'orgs.view',
    'reports.view',
    'support.view',
    'compliance.view',
    'notifications.view'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ── 8. Create indexes for performance ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);

-- ── 9. RLS policies ───────────────────────────────────────────────────────────
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS
DROP POLICY IF EXISTS "service_role_all_admin_roles" ON public.admin_roles;
CREATE POLICY "service_role_all_admin_roles" ON public.admin_roles FOR ALL USING (true);
DROP POLICY IF EXISTS "service_role_all_admin_permissions" ON public.admin_permissions;
CREATE POLICY "service_role_all_admin_permissions" ON public.admin_permissions FOR ALL USING (true);
DROP POLICY IF EXISTS "service_role_all_role_permissions" ON public.role_permissions;
CREATE POLICY "service_role_all_role_permissions" ON public.role_permissions FOR ALL USING (true);

-- Profiles RLS for custom_permissions
ALTER TABLE public.profiles DROP POLICY IF EXISTS "service_role_all_profiles" ON public.profiles;
CREATE POLICY "service_role_all_profiles" ON public.profiles FOR ALL USING (true);

-- ── 10. Function to get user's effective permissions ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_profile_id uuid)
RETURNS text[] AS $$
DECLARE
  v_role text;
  v_custom_perms text[];
  v_role_perms text[];
BEGIN
  -- Get user's role
  SELECT role INTO v_role FROM public.profiles WHERE id = p_profile_id;
  
  -- Get custom permissions (if any)
  SELECT custom_permissions INTO v_custom_perms FROM public.profiles WHERE id = p_profile_id;
  v_custom_perms := COALESCE(v_custom_perms, '{}');
  
  -- Get role-based permissions
  SELECT ARRAY_AGG(ap.perm_key)
  INTO v_role_perms
  FROM public.role_permissions rp
  JOIN public.admin_roles ar ON ar.id = rp.role_id
  JOIN public.admin_permissions ap ON ap.id = rp.permission_id
  WHERE ar.role_key = v_role;
  
  -- Union of custom and role permissions (custom overrides role)
  RETURN ARRAY(SELECT DISTINCT unnest(COALESCE(v_role_perms, '{}') || v_custom_perms));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 11. Function to check specific permission ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_permission(p_profile_id uuid, p_permission text)
RETURNS boolean AS $$
DECLARE
  v_perms text[];
BEGIN
  v_perms := public.get_user_permissions(p_profile_id);
  RETURN p_permission = ANY(v_perms) OR 'super_admin' = (SELECT role FROM public.profiles WHERE id = p_profile_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done! The RBAC system is now ready.