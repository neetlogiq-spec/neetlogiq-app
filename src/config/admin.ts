/**
 * Admin Configuration for NeetLogIQ
 * 
 * This file defines who has admin access to the system.
 * Only these specific Google accounts can access admin features.
 */

// List of admin email addresses (only these can access admin features)
export const ADMIN_EMAILS = [
  'kashyap0071232000@gmail.com',   // Super Admin
  'neetlogiq@gmail.com',           // Super Admin
  'kashyap2k007@gmail.com',        // Super Admin
];

// Admin roles and permissions
export const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator'
} as const;

// Admin permissions
export const ADMIN_PERMISSIONS = {
  // User Management
  VIEW_USERS: 'view_users',
  EDIT_USERS: 'edit_users',
  DELETE_USERS: 'delete_users',
  SUSPEND_USERS: 'suspend_users',
  PROMOTE_USERS: 'promote_users',
  
  // Data Management
  UPLOAD_DATA: 'upload_data',
  EDIT_DATA: 'edit_data',
  DELETE_DATA: 'delete_data',
  VIEW_ANALYTICS: 'view_analytics',
  
  // System Management
  VIEW_SYSTEM_INFO: 'view_system_info',
  MODIFY_SETTINGS: 'modify_settings',
  ACCESS_LOGS: 'access_logs',
  BACKUP_DATA: 'backup_data'
} as const;

// Role-based permissions mapping
export const ROLE_PERMISSIONS = {
  [ADMIN_ROLES.SUPER_ADMIN]: [
    // Super admin has all permissions
    ...Object.values(ADMIN_PERMISSIONS)
  ],
  [ADMIN_ROLES.ADMIN]: [
    ADMIN_PERMISSIONS.VIEW_USERS,
    ADMIN_PERMISSIONS.EDIT_USERS,
    ADMIN_PERMISSIONS.SUSPEND_USERS,
    ADMIN_PERMISSIONS.UPLOAD_DATA,
    ADMIN_PERMISSIONS.EDIT_DATA,
    ADMIN_PERMISSIONS.VIEW_ANALYTICS,
    ADMIN_PERMISSIONS.VIEW_SYSTEM_INFO
  ],
  [ADMIN_ROLES.MODERATOR]: [
    ADMIN_PERMISSIONS.VIEW_USERS,
    ADMIN_PERMISSIONS.SUSPEND_USERS,
    ADMIN_PERMISSIONS.VIEW_ANALYTICS
  ]
};

// Admin configuration by email (customize roles per admin)
export const ADMIN_CONFIG: Record<string, {
  role: string;
  permissions?: string[];
  displayName?: string;
}> = {
  'kashyap0071232000@gmail.com': {
    role: ADMIN_ROLES.SUPER_ADMIN,
    displayName: 'Kashyap Anand (Super Admin)'
  },
  'neetlogiq@gmail.com': {
    role: ADMIN_ROLES.SUPER_ADMIN,
    displayName: 'NeetLogIQ (Super Admin)'
  },
  'kashyap2k007@gmail.com': {
    role: ADMIN_ROLES.SUPER_ADMIN,
    displayName: 'Kashyap Developer (Super Admin)'
  }
};

/**
 * Check if an email address is authorized as an admin
 */
export const isAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

/**
 * Get admin role for a given email
 */
export const getAdminRole = (email: string | null | undefined): string | null => {
  if (!email || !isAdminEmail(email)) return null;
  return ADMIN_CONFIG[email.toLowerCase()]?.role || ADMIN_ROLES.ADMIN;
};

/**
 * Check if admin has specific permission
 */
export const hasPermission = (email: string | null | undefined, permission: string): boolean => {
  const role = getAdminRole(email);
  if (!role) return false;
  
  const rolePermissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || [];
  const customPermissions = ADMIN_CONFIG[email!.toLowerCase()]?.permissions || [];
  
  return rolePermissions.includes(permission) || customPermissions.includes(permission);
};

/**
 * Get all permissions for an admin
 */
export const getAdminPermissions = (email: string | null | undefined): string[] => {
  const role = getAdminRole(email);
  if (!role) return [];
  
  const rolePermissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || [];
  const customPermissions = ADMIN_CONFIG[email!.toLowerCase()]?.permissions || [];
  
  return [...new Set([...rolePermissions, ...customPermissions])];
};

/**
 * Get admin display info
 */
export const getAdminInfo = (email: string | null | undefined) => {
  if (!email || !isAdminEmail(email)) return null;
  
  const config = ADMIN_CONFIG[email.toLowerCase()];
  return {
    email,
    role: config?.role || ADMIN_ROLES.ADMIN,
    displayName: config?.displayName || 'Admin',
    permissions: getAdminPermissions(email)
  };
};

export default {
  ADMIN_EMAILS,
  ADMIN_ROLES,
  ADMIN_PERMISSIONS,
  ROLE_PERMISSIONS,
  ADMIN_CONFIG,
  isAdminEmail,
  getAdminRole,
  hasPermission,
  getAdminPermissions,
  getAdminInfo
};