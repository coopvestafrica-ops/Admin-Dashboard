/**
 * Role-Based Access Control (RBAC) Configuration
 * 
 * Defines which pages each role can access.
 * Roles hierarchy: superadmin > admin > staff
 */

// Page identifiers - must match route paths
export const PAGES = {
  // Core Operations
  DASHBOARD: 'dashboard',
  MEMBERS: 'members',
  MEMBER_PROFILE: 'member_profile',
  LOANS: 'loans',
  CONTRIBUTIONS: 'contributions',
  PAYROLL: 'payroll',
  EXCEL_MANAGER: 'excel_manager',
  INVESTMENTS: 'investments',
  
  // Financial Control
  FINANCIAL_DASHBOARD: 'financial_dashboard',
  WALLET_MANAGEMENT: 'wallet_management',
  DEPOSIT_VERIFICATION: 'deposit_verification',
  WITHDRAWAL_MANAGEMENT: 'withdrawal_management',
  GUARANTOR_SYSTEM: 'guarantor_system',
  INTEREST_RATES: 'interest_rates',
  RECONCILIATION: 'reconciliation',
  
  // Operations
  SYSTEM_SETTINGS: 'system_settings',
  REPORTS: 'reports',
  BULK_OPERATIONS: 'bulk_operations',
  SESSION_MANAGEMENT: 'sessions',
  LOGIN_HISTORY: 'login_history',
  
  // Platform Control
  MOBILE_FEATURE_CONTROLS: 'mobile_feature_controls',
  ROLE_MANAGEMENT: 'role_management',
  SECURITY_ACCESS: 'security_access',
  ORGANIZATIONS: 'organizations',
  REFERRAL_PROGRAM: 'referral_program',
  
  // Analytics & Risk
  PLATFORM_ANALYTICS: 'platform_analytics',
  FRAUD_DETECTION: 'fraud_detection',
  RISK_SCORING: 'risk_scoring',
  KYC_VERIFICATION: 'kyc_verification',
  
  // Governance
  COMPLIANCE: 'compliance',
  AUDIT_LOGS: 'audit_logs',
  
  // Support
  NOTIFICATIONS: 'notifications',
  SUPPORT_TICKETS: 'support_tickets',
  
  // Settings
  SETTINGS: 'settings',
  PROFILE: 'profile',
} as const;

export type PageKey = typeof PAGES[keyof typeof PAGES];
export type Role = 'superadmin' | 'admin' | 'staff';

// Role hierarchy - higher roles inherit permissions from lower roles
export const ROLE_HIERARCHY: Record<Role, number> = {
  superadmin: 3,
  admin: 2,
  staff: 1,
};

// Page permissions by role
export const ROLE_PERMISSIONS: Record<Role, PageKey[]> = {
  superadmin: Object.values(PAGES), // Full access
  
  admin: [
    // Core Operations
    PAGES.DASHBOARD,
    PAGES.MEMBERS,
    PAGES.MEMBER_PROFILE,
    PAGES.LOANS,
    PAGES.CONTRIBUTIONS,
    PAGES.PAYROLL,
    PAGES.EXCEL_MANAGER,
    PAGES.INVESTMENTS,
    
    // Financial Control
    PAGES.FINANCIAL_DASHBOARD,
    PAGES.WALLET_MANAGEMENT,
    PAGES.DEPOSIT_VERIFICATION,
    PAGES.WITHDRAWAL_MANAGEMENT,
    PAGES.GUARANTOR_SYSTEM,
    PAGES.INTEREST_RATES,
    PAGES.RECONCILIATION,
    
    // Operations
    PAGES.REPORTS,
    PAGES.SESSION_MANAGEMENT,
    PAGES.LOGIN_HISTORY,
    
    // Platform Control
    PAGES.MOBILE_FEATURE_CONTROLS,
    PAGES.ORGANIZATIONS,
    PAGES.REFERRAL_PROGRAM,
    
    // Analytics & Risk
    PAGES.PLATFORM_ANALYTICS,
    PAGES.FRAUD_DETECTION,
    PAGES.RISK_SCORING,
    PAGES.KYC_VERIFICATION,
    
    // Governance
    PAGES.COMPLIANCE,
    PAGES.AUDIT_LOGS,
    
    // Support
    PAGES.NOTIFICATIONS,
    PAGES.SUPPORT_TICKETS,
    
    // Settings
    PAGES.SETTINGS,
    PAGES.PROFILE,
  ],
  
  staff: [
    // Core Operations - limited
    PAGES.DASHBOARD,
    PAGES.MEMBERS,
    PAGES.MEMBER_PROFILE,
    PAGES.LOANS,
    PAGES.CONTRIBUTIONS,
    
    // Financial Control - view only for some
    PAGES.WALLET_MANAGEMENT,
    PAGES.DEPOSIT_VERIFICATION,
    
    // Support
    PAGES.SUPPORT_TICKETS,
    PAGES.NOTIFICATIONS,
    
    // Settings
    PAGES.SETTINGS,
    PAGES.PROFILE,
  ],
};

// Map route paths to page keys
export const ROUTE_TO_PAGE: Record<string, PageKey> = {
  '/dashboard': PAGES.DASHBOARD,
  '/members': PAGES.MEMBERS,
  '/members/:id': PAGES.MEMBER_PROFILE,
  '/loans': PAGES.LOANS,
  '/contributions': PAGES.CONTRIBUTIONS,
  '/payroll': PAGES.PAYROLL,
  '/excel-manager': PAGES.EXCEL_MANAGER,
  '/investments': PAGES.INVESTMENTS,
  
  '/financial-dashboard': PAGES.FINANCIAL_DASHBOARD,
  '/wallet-management': PAGES.WALLET_MANAGEMENT,
  '/deposit-verification': PAGES.DEPOSIT_VERIFICATION,
  '/withdrawal-management': PAGES.WITHDRAWAL_MANAGEMENT,
  '/guarantor-system': PAGES.GUARANTOR_SYSTEM,
  '/interest-rates': PAGES.INTEREST_RATES,
  '/reconciliation': PAGES.RECONCILIATION,
  
  '/system-settings': PAGES.SYSTEM_SETTINGS,
  '/reports': PAGES.REPORTS,
  '/bulk-operations': PAGES.BULK_OPERATIONS,
  '/sessions': PAGES.SESSION_MANAGEMENT,
  '/login-history': PAGES.LOGIN_HISTORY,
  
  '/mobile-feature-controls': PAGES.MOBILE_FEATURE_CONTROLS,
  '/role-management': PAGES.ROLE_MANAGEMENT,
  '/security-access': PAGES.SECURITY_ACCESS,
  '/organizations': PAGES.ORGANIZATIONS,
  '/referral-program': PAGES.REFERRAL_PROGRAM,
  
  '/platform-analytics': PAGES.PLATFORM_ANALYTICS,
  '/fraud-detection': PAGES.FRAUD_DETECTION,
  '/risk-scoring': PAGES.RISK_SCORING,
  '/user-verification': PAGES.KYC_VERIFICATION,
  
  '/compliance': PAGES.COMPLIANCE,
  '/audit-logs': PAGES.AUDIT_LOGS,
  
  '/notifications': PAGES.NOTIFICATIONS,
  '/support': PAGES.SUPPORT_TICKETS,
  
  '/settings': PAGES.SETTINGS,
  '/settings/profile': PAGES.PROFILE,
};

/**
 * Check if a role has permission to access a page
 */
export function hasPermission(role: Role | null | undefined, pageKey: PageKey): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(pageKey) ?? false;
}

/**
 * Get all pages a role can access
 */
export function getAccessiblePages(role: Role | null | undefined): PageKey[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check if role A has higher or equal privilege than role B
 */
export function hasPrivilege(roleA: Role, roleB: Role): boolean {
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB];
}

/**
 * Valid admin roles
 */
export const VALID_ADMIN_ROLES: Role[] = ['superadmin', 'admin', 'staff'];

/**
 * Check if a role is a valid admin role
 */
export function isValidAdminRole(role: string | null | undefined): role is Role {
  return !!role && VALID_ADMIN_ROLES.includes(role as Role);
}
