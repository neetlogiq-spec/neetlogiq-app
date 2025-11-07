'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Smartphone,
  Key,
  AlertTriangle,
  CheckCircle,
  Copy,
  QrCode,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  X
} from 'lucide-react';

interface TwoFactorAuthProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'setup' | 'verify' | 'disable';
  userEmail: string;
  onComplete: (success: boolean) => void;
}

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manual_entry_key: string;
}

const TwoFactorAuth: React.FC<TwoFactorAuthProps> = ({
  isOpen,
  onClose,
  mode,
  userEmail,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState<'setup' | 'verify' | 'backup' | 'complete'>('setup');
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [backupCodesDownloaded, setBackupCodesDownloaded] = useState(false);

  useEffect(() => {
    if (isOpen && mode === 'setup') {
      initializeTwoFactor();
    }
  }, [isOpen, mode]);

  const initializeTwoFactor = async () => {
    setLoading(true);
    setError('');

    try {
      // In a real implementation, this would call your API
      // For demo, we'll simulate the setup
      const mockSetup: TwoFactorSetup = {
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeUrl: `otpauth://totp/NeetLogIQ%20Admin:${encodeURIComponent(userEmail)}?secret=JBSWY3DPEHPK3PXP&issuer=NeetLogIQ%20Admin`,
        backupCodes: [
          'ABC12345',
          'DEF67890',
          'GHI13579',
          'JKL24680',
          'MNO97531',
          'PQR86420',
          'STU75319',
          'VWX64208',
          'YZA53197',
          'BCD42086'
        ],
        manual_entry_key: 'JBSWY3DPEHPK3PXP'
      };

      setSetupData(mockSetup);
      
      // Generate QR code (in real implementation, use the 2FA service)
      setQrCodeImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
      
    } catch (err) {
      setError('Failed to initialize two-factor authentication');
      console.error('2FA initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setError('Please enter a verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // In a real implementation, verify the TOTP code
      // For demo, accept any 6-digit code
      if (verificationCode.length === 6) {
        if (mode === 'setup') {
          setCurrentStep('backup');
        } else {
          onComplete(true);
        }
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBackupCode = async () => {
    if (!backupCode.trim()) {
      setError('Please enter a backup code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // In a real implementation, verify the backup code
      const isValid = setupData?.backupCodes.includes(backupCode.toUpperCase());
      if (isValid) {
        onComplete(true);
      } else {
        setError('Invalid backup code. Please try again.');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadBackupCodes = () => {
    if (!setupData) return;

    const codesText = [
      'NeetLogIQ Admin - Two-Factor Authentication Backup Codes',
      `Generated for: ${userEmail}`,
      `Generated on: ${new Date().toLocaleString()}`,
      '',
      'IMPORTANT: Store these codes in a safe place!',
      'Each code can only be used once.',
      '',
      ...setupData.backupCodes.map((code, index) => `${index + 1}. ${code}`)
    ].join('\n');

    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neetlogiq-backup-codes-${userEmail.replace('@', '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    setBackupCodesDownloaded(true);
  };

  const completeSetup = () => {
    setCurrentStep('complete');
    setTimeout(() => {
      onComplete(true);
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Shield className="w-6 h-6 text-blue-600 mr-3" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {mode === 'setup' && 'Setup Two-Factor Authentication'}
                  {mode === 'verify' && 'Verify Two-Factor Authentication'}
                  {mode === 'disable' && 'Disable Two-Factor Authentication'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {userEmail}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Setup Flow */}
            {mode === 'setup' && (
              <>
                {currentStep === 'setup' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <Smartphone className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Scan QR Code
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Use your authenticator app to scan this QR code
                      </p>
                    </div>

                    {/* QR Code */}
                    <div className="flex justify-center">
                      <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                        {qrCodeImage ? (
                          <div className="w-48 h-48 bg-gray-100 rounded flex items-center justify-center">
                            <QrCode className="w-24 h-24 text-gray-400" />
                            <span className="ml-2 text-gray-500 text-sm">QR Code</span>
                          </div>
                        ) : (
                          <div className="w-48 h-48 bg-gray-100 rounded flex items-center justify-center">
                            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Manual Entry */}
                    {setupData && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Can't scan? Enter manually:
                        </h4>
                        <div className="flex items-center space-x-2">
                          <input
                            type={showSecret ? 'text' : 'password'}
                            value={setupData.manual_entry_key}
                            readOnly
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white font-mono"
                          />
                          <button
                            onClick={() => setShowSecret(!showSecret)}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(setupData.manual_entry_key)}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Verification Code Input */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Enter the 6-digit code from your app:
                      </label>
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-full px-4 py-3 text-center text-xl font-mono border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        maxLength={6}
                      />
                    </div>

                    {error && (
                      <div className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                        <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
                      </div>
                    )}

                    <button
                      onClick={handleVerifyCode}
                      disabled={loading || verificationCode.length !== 6}
                      className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {loading ? (
                        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="w-5 h-5 mr-2" />
                      )}
                      Verify Code
                    </button>
                  </motion.div>
                )}

                {currentStep === 'backup' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <Key className="w-16 h-16 text-amber-600 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Save Your Backup Codes
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Store these backup codes in a safe place. You can use them if you lose access to your authenticator app.
                      </p>
                    </div>

                    {setupData && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            Backup Codes
                          </h4>
                          <button
                            onClick={() => setShowBackupCodes(!showBackupCodes)}
                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          >
                            {showBackupCodes ? 'Hide' : 'Show'}
                          </button>
                        </div>
                        
                        {showBackupCodes && (
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            {setupData.backupCodes.map((code, index) => (
                              <div
                                key={index}
                                className="bg-white dark:bg-gray-800 p-2 rounded border font-mono text-sm text-center"
                              >
                                {code}
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={downloadBackupCodes}
                          className="w-full bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 py-2 px-4 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/40 flex items-center justify-center"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download Backup Codes
                        </button>

                        {backupCodesDownloaded && (
                          <div className="flex items-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg mt-2">
                            <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                            <span className="text-sm text-green-700 dark:text-green-400">
                              Backup codes downloaded successfully
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                      <div className="flex">
                        <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5" />
                        <div className="text-sm text-amber-800 dark:text-amber-400">
                          <p className="font-medium mb-1">Important:</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Each backup code can only be used once</li>
                            <li>Store them in a secure location</li>
                            <li>Don't share them with anyone</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={completeSetup}
                      disabled={!backupCodesDownloaded}
                      className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Complete Setup
                    </button>
                  </motion.div>
                )}

                {currentStep === 'complete' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Two-Factor Authentication Enabled!
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Your account is now more secure. You'll be asked for a verification code when signing in.
                    </p>
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <p className="text-sm text-green-800 dark:text-green-400">
                        ✓ Authenticator app configured<br />
                        ✓ Backup codes saved<br />
                        ✓ Account security enhanced
                      </p>
                    </div>
                  </motion.div>
                )}
              </>
            )}

            {/* Verification Flow */}
            {mode === 'verify' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Two-Factor Authentication Required
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Enter the verification code from your authenticator app
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Verification Code:
                  </label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-3 text-center text-xl font-mono border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    maxLength={6}
                  />
                </div>

                <button
                  onClick={handleVerifyCode}
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Shield className="w-5 h-5 mr-2" />
                  )}
                  Verify
                </button>

                {/* Backup Code Option */}
                <div className="text-center">
                  <button
                    onClick={() => {
                      // Switch to backup code input
                      setVerificationCode('');
                      setError('');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Use backup code instead
                  </button>
                </div>

                {/* Backup Code Input */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Or enter a backup code:
                  </label>
                  <input
                    type="text"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.toUpperCase().slice(0, 8))}
                    placeholder="ABC12345"
                    className="w-full px-4 py-2 text-center font-mono border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    maxLength={8}
                  />
                  <button
                    onClick={handleVerifyBackupCode}
                    disabled={loading || backupCode.length !== 8}
                    className="w-full bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Key className="w-5 h-5 mr-2" />
                    )}
                    Use Backup Code
                  </button>
                </div>

                {error && (
                  <div className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                    <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Disable Flow */}
            {mode === 'disable' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Disable Two-Factor Authentication
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Enter your current verification code to disable 2FA
                  </p>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex">
                    <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
                    <div className="text-sm text-red-800 dark:text-red-400">
                      <p className="font-medium mb-1">Warning:</p>
                      <p>Disabling two-factor authentication will make your account less secure.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Current Verification Code:
                  </label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-3 text-center text-xl font-mono border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                    maxLength={6}
                  />
                </div>

                {error && (
                  <div className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                    <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
                  </div>
                )}

                <button
                  onClick={handleVerifyCode}
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 mr-2" />
                  )}
                  Disable Two-Factor Authentication
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TwoFactorAuth;