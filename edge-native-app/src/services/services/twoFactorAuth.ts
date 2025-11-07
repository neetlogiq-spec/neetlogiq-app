/**
 * Two-Factor Authentication Service
 * Implements TOTP (Time-based One-Time Password) for super admin security
 */

import { generateSecret, authenticator, totp } from 'speakeasy';
import QRCode from 'qrcode';

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manual_entry_key: string;
}

export interface TwoFactorVerification {
  isValid: boolean;
  remainingWindow?: number;
}

export interface AdminSecuritySettings {
  uid: string;
  email: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  backupCodes?: string[];
  lastTwoFactorVerification?: string;
  sessionTimeoutMinutes: number;
  allowedIpAddresses?: string[];
  requireTwoFactorForCriticalActions: boolean;
}

/**
 * Generate a new 2FA secret and QR code for setup
 */
export function generateTwoFactorSetup(
  userEmail: string,
  serviceName: string = 'NeetLogIQ Admin'
): TwoFactorSetup {
  // Generate a secret for the user
  const secret = generateSecret({
    name: userEmail,
    issuer: serviceName,
    length: 32
  });

  // Generate backup codes (10 codes, 8 characters each)
  const backupCodes = Array.from({ length: 10 }, () => 
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );

  // Create the OTP auth URL
  const otpauthUrl = authenticator.generateSecret({
    secret: secret.base32,
    label: userEmail,
    issuer: serviceName
  });

  return {
    secret: secret.base32,
    qrCodeUrl: otpauthUrl,
    backupCodes,
    manual_entry_key: secret.base32
  };
}

/**
 * Generate QR code as base64 image
 */
export async function generateQRCodeImage(otpauthUrl: string): Promise<string> {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 256,
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Verify a TOTP token
 */
export function verifyTOTP(
  token: string,
  secret: string,
  window: number = 2
): TwoFactorVerification {
  try {
    const verified = authenticator.verify({
      token: token.replace(/\s/g, ''), // Remove any spaces
      secret: secret,
      window: window, // Allow some time drift
      encoding: 'base32'
    });

    return {
      isValid: verified,
      remainingWindow: window
    };
  } catch (error) {
    console.error('Error verifying TOTP:', error);
    return { isValid: false };
  }
}

/**
 * Verify a backup code
 */
export function verifyBackupCode(
  providedCode: string,
  backupCodes: string[]
): { isValid: boolean; remainingCodes?: string[] } {
  const cleanCode = providedCode.toUpperCase().replace(/\s/g, '');
  const codeIndex = backupCodes.indexOf(cleanCode);
  
  if (codeIndex === -1) {
    return { isValid: false };
  }
  
  // Remove the used backup code
  const remainingCodes = [...backupCodes];
  remainingCodes.splice(codeIndex, 1);
  
  return {
    isValid: true,
    remainingCodes
  };
}

/**
 * Generate new backup codes (when existing ones are running low)
 */
export function generateBackupCodes(count: number = 10): string[] {
  return Array.from({ length: count }, () => 
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );
}

/**
 * Check if 2FA verification is required based on time elapsed
 */
export function isTwoFactorVerificationRequired(
  lastVerification: string | undefined,
  requirementMinutes: number = 30
): boolean {
  if (!lastVerification) return true;
  
  const lastVerificationTime = new Date(lastVerification);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastVerificationTime.getTime()) / (1000 * 60);
  
  return diffMinutes >= requirementMinutes;
}

/**
 * Validate IP address against allowed list
 */
export function isIpAddressAllowed(
  clientIp: string,
  allowedIps?: string[]
): boolean {
  if (!allowedIps || allowedIps.length === 0) return true;
  
  return allowedIps.includes(clientIp);
}

/**
 * Generate a secure session token
 */
export function generateSecureSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Default security settings for super admins
 */
export const DEFAULT_ADMIN_SECURITY_SETTINGS: Omit<AdminSecuritySettings, 'uid' | 'email'> = {
  twoFactorEnabled: false,
  sessionTimeoutMinutes: 30, // 30 minutes for admin sessions
  requireTwoFactorForCriticalActions: true
};

/**
 * Critical actions that require 2FA verification
 */
export const CRITICAL_ADMIN_ACTIONS = [
  'delete_user',
  'promote_user',
  'system_backup',
  'system_restore',
  'change_admin_settings',
  'bulk_data_delete',
  'modify_system_config'
] as const;

export type CriticalAdminAction = typeof CRITICAL_ADMIN_ACTIONS[number];

/**
 * Check if an action requires 2FA verification
 */
export function requiresTwoFactorForAction(action: string): boolean {
  return CRITICAL_ADMIN_ACTIONS.includes(action as CriticalAdminAction);
}