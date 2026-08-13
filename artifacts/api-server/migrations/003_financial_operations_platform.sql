-- 003_financial_operations_platform.sql
-- Adds the remaining governance modules for the Coopvest Africa financial-
-- operations platform:
--   * Loan approval matrix (tiered approval limits)
--   * Emergency control center (kill switches)
--   * Member document vault
--   * System-wide search index view
--   * Contribution rules engine
--   * Immutable audit log enforcement
-- Idempotent: safe to run multiple times.

-- ============================================================================
-- 1. LOAN APPROVAL MATRIX (Module 7)
--    Tiered approval limits so a loan officer can't approve unlimited amounts.
-- ============================================================================
create table if not exists public.loan_approval_limits (
  id              uuid primary key default gen_random_uuid(),
  approval_level  integer not null unique,
  level_name      text    not null,
  min_amount      numeric(18,2) not null default 0,
  max_amount      numeric(18,2) not null,
  required_roles  text[]  not null default array['operator'],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (max_amount > min_amount),
  check (approval_level > 0)
);

create index if not exists idx_loan_approval_limits_level
  on public.loan_approval_limits (approval_level);

comment on table public.loan_approval_limits is
  'Loan Approval Matrix: maps loan amount tiers to the minimum role(s) that may approve them.';

-- Seed sensible defaults (NGN). Operators: 0–250k, senior officers:
-- 250k–1m, super admin: 1m+. Update via dashboard.
insert into public.loan_approval_limits (approval_level, level_name, min_amount, max_amount, required_roles)
values
  (1, 'Loan Officer',      0,        250000,  array['operator']),
  (2, 'Senior Officer',    250000,   1000000, array['admin','super_admin']),
  (3, 'Super Admin',       1000000, 100000000, array['super_admin'])
on conflict (approval_level) do nothing;

-- ============================================================================
-- 2. EMERGENCY CONTROL CENTER (Module 10)
--    Kill switches + maintenance mode. Each flag is a single row keyed by name.
-- ============================================================================
create table if not exists public.system_emergency_controls (
  id            uuid primary key default gen_random_uuid(),
  control_key   text not null unique,
  label         text not null,
  description   text not null default '',
  is_active     boolean not null default false,
  activated_by  uuid,
  activated_at  timestamptz,
  deactivated_by uuid,
  deactivated_at timestamptz,
  reason        text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.system_emergency_controls is
  'Emergency / kill-switch controls: freezing loans, withdrawals, registration, forcing admin logout, read-only mode.';

-- Seed the known kill switches (all inactive).
insert into public.system_emergency_controls (control_key, label, description, is_active)
values
  ('freeze_new_loans',           'Freeze New Loan Applications', 'Block all new loan applications.', false),
  ('freeze_withdrawals',         'Freeze Withdrawals',           'Block all withdrawal requests.', false),
  ('freeze_contribution_adjust', 'Freeze Contribution Adjustments', 'Block manual contribution/balance adjustments.', false),
  ('disable_registration',       'Disable Registration',        'Block new member sign-ups.', false),
  ('force_admin_logout',         'Force All Admins Logout',     'Revoke all active admin sessions.', false),
  ('disable_compromised_admin',  'Disable Compromised Admin',   'Generic flag for admin account lockout workflow.', false),
  ('read_only_mode',             'Financial Read-Only Mode',   'Put the financial system into read-only mode.', false),
  ('maintenance_mode',           'Maintenance Mode',            'Temporarily disable a service without full outage.', false)
on conflict (control_key) do nothing;

-- ============================================================================
-- 3. MEMBER DOCUMENT VAULT (Module 13)
--    Permission-controlled document storage with view/download audit.
-- ============================================================================
create table if not exists public.member_documents (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null,
  document_type   text not null,                       -- id_card, loan_agreement, guarantor_agreement, receipt, etc.
  title           text not null,
  file_url        text not null,                       -- Supabase Storage path
  file_size       bigint,
  mime_type       text,
  uploaded_by     uuid not null,
  access_roles    text[] not null default array['super_admin','admin'],
  is_confidential boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists idx_member_documents_member
  on public.member_documents (member_id);
create index if not exists idx_member_documents_type
  on public.member_documents (document_type);

create table if not exists public.document_access_log (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.member_documents(id) on delete cascade,
  accessed_by   uuid not null,
  access_type   text not null check (access_type in ('view','download')),
  ip_address    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_document_access_log_doc
  on public.document_access_log (document_id);

comment on table public.member_documents is
  'Secure document vault: identity docs, loan/guarantor agreements, receipts. Access is role-controlled and every view/download is logged.';

-- ============================================================================
-- 4. SYSTEM-WIDE SEARCH (Module 17)
--    A unified view that unions searchable entities for one search bar.
-- ============================================================================
create or replace view public.system_search_index as
  select p.id as entity_id, 'member'::text as entity_type,
         p.name as title, p.email as subtitle, p.phone as extra
    from public.profiles p
  union all
  select t.id::text, 'transaction',
         ('TXN ' || coalesce(t.reference, t.id::text)),
         ('₦' || coalesce(t.amount::text,'0')),
         t.type
    from public.transactions t
  union all
  select l.id::text, 'loan',
         ('Loan ' || l.id::text),
         ('₦' || coalesce(l.amount::text,'0')),
         l.status
    from public.loans l
  union all
  select tk.id::text, 'ticket',
         ('Ticket ' || coalesce(tk.ticket_number, tk.id::text)),
         tk.subject,
         tk.status
    from public.tickets tk
  union all
  select o.id::text, 'organization', o.name, o.status, null
    from public.organizations o;

comment on view public.system_search_index is
  'Unified search index across members, transactions, loans, tickets, organizations for the system-wide search bar.';

-- ============================================================================
-- 5. CONTRIBUTION RULES ENGINE (Module 8)
--    Configurable contribution/payment policy instead of hard-coded values.
-- ============================================================================
create table if not exists public.system_rules (
  id              uuid primary key default gen_random_uuid(),
  rule_key        text not null unique,
  label           text not null,
  description     text not null default '',
  value_numeric   numeric(18,2),
  value_text      text,
  value_boolean   boolean,
  value_json      jsonb,
  data_type       text not null check (data_type in ('numeric','text','boolean','json')),
  is_editable     boolean not null default true,
  updated_by      uuid,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

comment on table public.system_rules is
  'Configurable financial policy: registration fee, minimum/default contribution, due date, grace period, late charge, salary deduction toggle.';

insert into public.system_rules (rule_key, label, description, value_numeric, value_text, value_boolean, data_type)
values
  ('registration_fee',         'Registration Fee',                'One-time registration fee.',               5000,  null, null, 'numeric'),
  ('minimum_monthly_contribution', 'Minimum Monthly Contribution', 'Lowest accepted monthly contribution.',  5000,  null, null, 'numeric'),
  ('default_monthly_contribution', 'Default Monthly Contribution',  'Default contribution for new members.',  10000, null, null, 'numeric'),
  ('contribution_due_date',    'Contribution Due Date',           'Day of month contributions are due.',     null, '28', null, 'text'),
  ('contribution_grace_days',  'Contribution Grace Period (days)','Grace days before a contribution is late.', 3,   null, null, 'numeric'),
  ('late_loan_repayment_charge','Late Loan Repayment Charge',      'Charge applied on late loan repayment.',   3000, null, null, 'numeric'),
  ('salary_deduction_enabled', 'Salary Deduction Available',      'Whether salary-based deduction is offered.', null, null, false, 'boolean'),
  ('contribution_methods',     'Contribution Methods',            'Accepted contribution methods.',           null, null, null, 'json')
on conflict (rule_key) do nothing;

-- ============================================================================
-- 6. IMMUTABLE AUDIT LOG ENFORCEMENT (Module 18)
--    Audit records must be append-only. Block UPDATE and DELETE on audit_logs
--    at the database layer so no admin (not even super_admin) can rewrite or
--    erase their own activity history.
-- ============================================================================
-- Block updates and deletes on audit_logs entirely.
create or replace function public.block_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit logs are immutable: % operations are not permitted on audit_logs.', TG_OP;
end;
$$;

drop trigger if exists trg_audit_log_no_update on public.audit_logs;
drop trigger if exists trg_audit_log_no_delete on public.audit_logs;
create trigger trg_audit_log_no_update
  before update on public.audit_logs
  for each row execute function public.block_audit_log_mutation();
create trigger trg_audit_log_no_delete
  before delete on public.audit_logs
  for each row execute function public.block_audit_log_mutation();

-- Also protect the maker-checker audit table the same way.
create or replace function public.block_maker_checker_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Maker-checker audit logs are immutable: % operations are not permitted.', TG_OP;
end;
$$;

drop trigger if exists trg_admin_audit_logs_no_update on public.admin_audit_logs;
drop trigger if exists trg_admin_audit_logs_no_delete on public.admin_audit_logs;
create trigger trg_admin_audit_logs_no_update
  before update on public.admin_audit_logs
  for each row execute function public.block_maker_checker_audit_mutation();
create trigger trg_admin_audit_logs_no_delete
  before delete on public.admin_audit_logs
  for each row execute function public.block_maker_checker_audit_mutation();

-- ============================================================================
-- 7. EMERGENCY CONTROL CHANGE AUDIT
--    Every kill-switch activation/deactivation is a high-priority audit event.
-- ============================================================================
create or replace function public.log_emergency_control_change()
returns trigger
language plpgsql
as $$
begin
  insert into public.admin_audit_logs
    (action, request_type, performed_by, details, created_at)
  values (
    case when new.is_active then 'EMERGENCY_CONTROL_ACTIVATED' else 'EMERGENCY_CONTROL_DEACTIVATED' end,
    'emergency_controls',
    coalesce(new.activated_by, new.deactivated_by),
    jsonb_build_object('control_key', new.control_key, 'label', new.label, 'reason', new.reason),
    now()
  );
  return new;
end;
$$;

drop trigger if exists trg_emergency_control_audit on public.system_emergency_controls;
create trigger trg_emergency_control_audit
  after update on public.system_emergency_controls
  for each row
  when (old.is_active is distinct from new.is_active)
  execute function public.log_emergency_control_change();
