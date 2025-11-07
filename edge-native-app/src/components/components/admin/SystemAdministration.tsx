'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Download,
  Upload,
  Settings,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  RefreshCw,
  Save,
  X,
  Shield,
  Wrench,
  Flag,
  Activity,
  Server,
  HardDrive,
  Cpu,
  Users,
  Zap,
  Edit2,
  Plus,
  Copy,
  FileText,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  createBackup,
  restoreBackup,
  getBackups,
  deleteBackup,
  getSystemConfig,
  updateSystemConfig,
  getFeatureFlags,
  updateFeatureFlag,
  deleteFeatureFlag,
  getMaintenanceMode,
  updateMaintenanceMode,
  getSystemHealth,
  exportSystemConfig,
  importSystemConfig,
  type SystemBackup,
  type BackupOperation,
  type SystemConfiguration,
  type FeatureFlag,
  type MaintenanceMode,
  type SystemHealth
} from '@/services/systemAdmin';
import { logAdminAction } from '@/services/adminAuditLog';

interface SystemAdministrationProps {
  adminUser: {
    uid: string;
    email: string;
  };
}

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackupCreated: () => void;
  adminUser: { uid: string; email: string };
}

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config?: SystemConfiguration;
  onSave: (config: Partial<SystemConfiguration>) => void;
}

interface FeatureFlagModalProps {
  isOpen: boolean;
  onClose: () => void;
  flag?: FeatureFlag;
  onSave: (flag: Partial<FeatureFlag>) => void;
}

const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose, onBackupCreated, adminUser }) => {
  const [backupName, setBackupName] = useState('');
  const [backupDescription, setBackupDescription] = useState('');
  const [backupType, setBackupType] = useState<SystemBackup['type']>('full');
  const [loading, setLoading] = useState(false);

  const handleCreateBackup = async () => {
    if (!backupName.trim()) return;

    setLoading(true);
    try {
      await createBackup(backupType, backupName, backupDescription, adminUser.email);
      
      logAdminAction(adminUser.uid, adminUser.email, 'system_backup', {
        resource: 'system',
        details: { type: backupType, name: backupName }
      });

      onBackupCreated();
      onClose();
      setBackupName('');
      setBackupDescription('');
    } catch (error) {
      console.error('Error creating backup:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full"
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create System Backup
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Backup Name *
              </label>
              <input
                type="text"
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
                placeholder="Enter backup name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={backupDescription}
                onChange={(e) => setBackupDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Backup Type
              </label>
              <select
                value={backupType}
                onChange={(e) => setBackupType(e.target.value as SystemBackup['type'])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="full">Full System</option>
                <option value="data">Data Only</option>
                <option value="config">Configuration Only</option>
                <option value="users">Users Only</option>
              </select>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex">
                <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-400">
                  <p className="font-medium mb-1">Important:</p>
                  <p>Backup process may take several minutes depending on data size.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateBackup}
              disabled={loading || !backupName.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              Create Backup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    type: 'string' as SystemConfiguration['type'],
    description: '',
    category: '',
    environment: 'all' as SystemConfiguration['environment']
  });

  useEffect(() => {
    if (config) {
      setFormData({
        key: config.key,
        value: config.type === 'json' ? JSON.stringify(config.value, null, 2) : String(config.value),
        type: config.type,
        description: config.description,
        category: config.category,
        environment: config.environment || 'all'
      });
    } else {
      setFormData({
        key: '',
        value: '',
        type: 'string',
        description: '',
        category: '',
        environment: 'all'
      });
    }
  }, [config]);

  const handleSave = () => {
    let processedValue = formData.value;
    
    try {
      switch (formData.type) {
        case 'number':
          processedValue = Number(formData.value);
          break;
        case 'boolean':
          processedValue = formData.value === 'true';
          break;
        case 'json':
          processedValue = JSON.parse(formData.value);
          break;
        case 'array':
          processedValue = formData.value.split(',').map(s => s.trim());
          break;
      }
    } catch (error) {
      alert('Invalid value format for the selected type');
      return;
    }

    onSave({
      key: formData.key,
      value: processedValue,
      type: formData.type,
      description: formData.description,
      category: formData.category,
      environment: formData.environment
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full"
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {config ? 'Edit' : 'Add'} Configuration
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Key *
                </label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="config_key"
                  disabled={!!config}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as SystemConfiguration['type'] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="json">JSON</option>
                  <option value="array">Array</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Value *
              </label>
              {formData.type === 'json' ? (
                <textarea
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="JSON value"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                />
              ) : formData.type === 'boolean' ? (
                <select
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <input
                  type={formData.type === 'number' ? 'number' : 'text'}
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={formData.type === 'array' ? 'value1, value2, value3' : 'Enter value'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="security, api, etc."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Environment
                </label>
                <select
                  value={formData.environment}
                  onChange={(e) => setFormData({ ...formData, environment: e.target.value as SystemConfiguration['environment'] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">All</option>
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description of this configuration"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!formData.key.trim() || !formData.value.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const FeatureFlagModal: React.FC<FeatureFlagModalProps> = ({ isOpen, onClose, flag, onSave }) => {
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    enabled: false,
    type: 'boolean' as FeatureFlag['type'],
    value: '',
    environment: 'all' as FeatureFlag['environment']
  });

  useEffect(() => {
    if (flag) {
      setFormData({
        key: flag.key,
        name: flag.name,
        description: flag.description,
        enabled: flag.enabled,
        type: flag.type,
        value: Array.isArray(flag.value) ? flag.value.join(', ') : String(flag.value || ''),
        environment: flag.environment
      });
    } else {
      setFormData({
        key: '',
        name: '',
        description: '',
        enabled: false,
        type: 'boolean',
        value: '',
        environment: 'all'
      });
    }
  }, [flag]);

  const handleSave = () => {
    let processedValue = formData.value;
    
    try {
      switch (formData.type) {
        case 'percentage':
          processedValue = Number(formData.value);
          if (processedValue < 0 || processedValue > 100) {
            alert('Percentage must be between 0 and 100');
            return;
          }
          break;
        case 'user_list':
          processedValue = formData.value.split(',').map(s => s.trim()).filter(s => s);
          break;
      }
    } catch (error) {
      alert('Invalid value format for the selected type');
      return;
    }

    onSave({
      key: formData.key,
      name: formData.name,
      description: formData.description,
      enabled: formData.enabled,
      type: formData.type,
      value: formData.type === 'boolean' ? undefined : processedValue,
      environment: formData.environment
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full"
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {flag ? 'Edit' : 'Add'} Feature Flag
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Key *
                </label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="feature_key"
                  disabled={!!flag}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                />
              </div>
              
              <div className="flex items-end">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enabled</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Display Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Feature Name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as FeatureFlag['type'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="boolean">Boolean (On/Off)</option>
                <option value="percentage">Percentage Rollout</option>
                <option value="user_list">User List</option>
                <option value="user_attribute">User Attribute</option>
              </select>
            </div>

            {formData.type !== 'boolean' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Value
                  {formData.type === 'percentage' && ' (0-100)'}
                  {formData.type === 'user_list' && ' (comma-separated emails)'}
                </label>
                <input
                  type={formData.type === 'percentage' ? 'number' : 'text'}
                  min={formData.type === 'percentage' ? 0 : undefined}
                  max={formData.type === 'percentage' ? 100 : undefined}
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={
                    formData.type === 'percentage' ? '50' :
                    formData.type === 'user_list' ? 'admin@example.com, user@example.com' :
                    'Configure conditions'
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Environment
              </label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value as FeatureFlag['environment'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All</option>
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description of this feature flag"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!formData.key.trim() || !formData.name.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const SystemAdministration: React.FC<SystemAdministrationProps> = ({ adminUser }) => {
  const [activeTab, setActiveTab] = useState<'backups' | 'config' | 'features' | 'maintenance' | 'health'>('backups');
  const [backups, setBackups] = useState<SystemBackup[]>([]);
  const [configs, setConfigs] = useState<SystemConfiguration[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [maintenanceMode, setMaintenanceMode] = useState<MaintenanceMode>();
  const [systemHealth, setSystemHealth] = useState<SystemHealth>();
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showFeatureFlagModal, setShowFeatureFlagModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SystemConfiguration>();
  const [editingFlag, setEditingFlag] = useState<FeatureFlag>();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setBackups(getBackups());
    setConfigs(getSystemConfig());
    setFeatureFlags(getFeatureFlags());
    setMaintenanceMode(getMaintenanceMode());
    setSystemHealth(getSystemHealth());
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to restore from this backup? This will overwrite current data.')) {
      return;
    }

    try {
      setLoading(true);
      await restoreBackup(backupId, adminUser.email);
      
      logAdminAction(adminUser.uid, adminUser.email, 'system_restore', {
        resource: 'system',
        resourceId: backupId,
        details: { backupId }
      });

      loadData();
    } catch (error) {
      console.error('Error restoring backup:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
      return;
    }

    deleteBackup(backupId);
    setBackups(getBackups());
    
    logAdminAction(adminUser.uid, adminUser.email, 'delete_backup', {
      resource: 'backup',
      resourceId: backupId
    });
  };

  const handleUpdateConfig = (config: Partial<SystemConfiguration>) => {
    updateSystemConfig(config.key!, config.value, adminUser.email);
    setConfigs(getSystemConfig());
    setEditingConfig(undefined);
    
    logAdminAction(adminUser.uid, adminUser.email, 'change_settings', {
      resource: 'config',
      resourceId: config.key,
      details: { key: config.key, value: config.value }
    });
  };

  const handleUpdateFeatureFlag = (flag: Partial<FeatureFlag>) => {
    updateFeatureFlag(flag.key!, flag, adminUser.email);
    setFeatureFlags(getFeatureFlags());
    setEditingFlag(undefined);
    
    logAdminAction(adminUser.uid, adminUser.email, 'modify_feature_flag', {
      resource: 'feature_flag',
      resourceId: flag.key,
      details: { key: flag.key, enabled: flag.enabled }
    });
  };

  const handleDeleteFeatureFlag = (key: string) => {
    if (!confirm('Are you sure you want to delete this feature flag?')) {
      return;
    }

    deleteFeatureFlag(key);
    setFeatureFlags(getFeatureFlags());
    
    logAdminAction(adminUser.uid, adminUser.email, 'delete_feature_flag', {
      resource: 'feature_flag',
      resourceId: key
    });
  };

  const handleToggleMaintenanceMode = () => {
    const newStatus = !maintenanceMode?.enabled;
    updateMaintenanceMode({ enabled: newStatus }, adminUser.email);
    setMaintenanceMode(getMaintenanceMode());
    
    logAdminAction(adminUser.uid, adminUser.email, 'maintenance_mode', {
      resource: 'system',
      details: { enabled: newStatus }
    });
  };

  const handleUpdateMaintenanceMessage = (message: string) => {
    updateMaintenanceMode({ message }, adminUser.email);
    setMaintenanceMode(getMaintenanceMode());
  };

  const handleExportConfig = () => {
    const config = exportSystemConfig();
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `system-config-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    logAdminAction(adminUser.uid, adminUser.email, 'export_config', {
      resource: 'system_config'
    });
  };

  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const configData = e.target?.result as string;
        const result = importSystemConfig(configData, adminUser.email);
        
        if (result.success) {
          loadData();
          logAdminAction(adminUser.uid, adminUser.email, 'import_config', {
            resource: 'system_config',
            details: { filename: file.name }
          });
        } else {
          alert(result.message);
        }
      } catch (error) {
        alert('Failed to import configuration file');
      }
    };
    reader.readAsText(file);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            System Administration
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage system backups, configuration, feature flags, and maintenance
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportConfig}
            className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Config
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportConfig}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Config
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 overflow-x-auto">
          {[
            { id: 'backups', label: 'Backups', icon: Database },
            { id: 'config', label: 'Configuration', icon: Settings },
            { id: 'features', label: 'Feature Flags', icon: Flag },
            { id: 'maintenance', label: 'Maintenance', icon: Wrench },
            { id: 'health', label: 'System Health', icon: Activity }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3 py-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Backups Tab */}
      {activeTab === 'backups' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              System Backups
            </h3>
            <button
              onClick={() => setShowBackupModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Database className="w-4 h-4 mr-2" />
              Create Backup
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {backups.map((backup) => (
                    <tr key={backup.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {backup.name}
                          </div>
                          {backup.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {backup.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                          {backup.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatBytes(backup.size)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(backup.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {backup.status === 'completed' && (
                            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                          )}
                          {backup.status === 'creating' && (
                            <Clock className="w-4 h-4 text-blue-500 mr-2" />
                          )}
                          {backup.status === 'failed' && (
                            <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
                          )}
                          <span className={`text-sm font-medium ${
                            backup.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                            backup.status === 'creating' ? 'text-blue-600 dark:text-blue-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {backup.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {backup.status === 'completed' && (
                            <button
                              onClick={() => handleRestoreBackup(backup.id)}
                              disabled={loading}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                              title="Restore"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteBackup(backup.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              System Configuration
            </h3>
            <button
              onClick={() => {
                setEditingConfig(undefined);
                setShowConfigModal(true);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Config
            </button>
          </div>

          <div className="grid gap-4">
            {Object.entries(
              configs.reduce((groups, config) => {
                const category = config.category || 'general';
                if (!groups[category]) groups[category] = [];
                groups[category].push(config);
                return groups;
              }, {} as Record<string, SystemConfiguration[]>)
            ).map(([category, categoryConfigs]) => (
              <div key={category} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white capitalize">
                    {category}
                  </h4>
                </div>
                <div className="p-6">
                  <div className="grid gap-4">
                    {categoryConfigs.map((config) => (
                      <div key={config.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h5 className="font-medium text-gray-900 dark:text-white">
                              {config.key}
                            </h5>
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                              {config.type}
                            </span>
                            {config.environment !== 'all' && (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                                {config.environment}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {config.description}
                          </p>
                          <div className="text-sm font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded">
                            {config.type === 'json' ? JSON.stringify(config.value) : String(config.value)}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setEditingConfig(config);
                              setShowConfigModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Feature Flags Tab */}
      {activeTab === 'features' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Feature Flags
            </h3>
            <button
              onClick={() => {
                setEditingFlag(undefined);
                setShowFeatureFlagModal(true);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Flag
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Flag
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Environment
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {featureFlags.map((flag) => (
                    <tr key={flag.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {flag.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {flag.key}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {flag.description}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                          {flag.type}
                        </span>
                        {flag.type === 'percentage' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {flag.value}% rollout
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {flag.enabled ? (
                            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                          ) : (
                            <X className="w-4 h-4 text-red-500 mr-2" />
                          )}
                          <span className={`text-sm font-medium ${
                            flag.enabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {flag.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                          {flag.environment}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleUpdateFeatureFlag({ key: flag.key, enabled: !flag.enabled })}
                            className={`${
                              flag.enabled 
                                ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300' 
                                : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300'
                            }`}
                            title={flag.enabled ? 'Disable' : 'Enable'}
                          >
                            {flag.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => {
                              setEditingFlag(flag);
                              setShowFeatureFlagModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFeatureFlag(flag.key)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && maintenanceMode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Maintenance Mode
            </h3>
            <button
              onClick={handleToggleMaintenanceMode}
              className={`flex items-center px-4 py-2 rounded-lg font-medium ${
                maintenanceMode.enabled
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {maintenanceMode.enabled ? (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Disable Maintenance
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4 mr-2" />
                  Enable Maintenance
                </>
              )}
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    Current Status
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last updated: {new Date(maintenanceMode.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className={`flex items-center space-x-2 ${
                  maintenanceMode.enabled 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {maintenanceMode.enabled ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <CheckCircle className="w-6 h-6" />
                  )}
                  <span className="font-medium">
                    {maintenanceMode.enabled ? 'Under Maintenance' : 'Operational'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maintenance Message
                </label>
                <textarea
                  value={maintenanceMode.message}
                  onChange={(e) => handleUpdateMaintenanceMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {maintenanceMode.enabled && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex">
                    <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
                    <div className="text-sm text-red-800 dark:text-red-400">
                      <p className="font-medium mb-1">Maintenance Mode Active</p>
                      <p>The system is currently in maintenance mode. Only admin users can access the system.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* System Health Tab */}
      {activeTab === 'health' && systemHealth && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              System Health
            </h3>
            <button
              onClick={() => setSystemHealth(getSystemHealth())}
              className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Overall Status */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className={`p-3 rounded-full ${
                  systemHealth.status === 'healthy' ? 'bg-green-100 dark:bg-green-900/20' :
                  systemHealth.status === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                  'bg-red-100 dark:bg-red-900/20'
                }`}>
                  <Activity className={`w-6 h-6 ${
                    systemHealth.status === 'healthy' ? 'text-green-600' :
                    systemHealth.status === 'warning' ? 'text-yellow-600' :
                    'text-red-600'
                  }`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    System Status
                  </p>
                  <p className={`text-xl font-bold capitalize ${
                    systemHealth.status === 'healthy' ? 'text-green-600' :
                    systemHealth.status === 'warning' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {systemHealth.status}
                  </p>
                </div>
              </div>
            </div>

            {/* Uptime */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/20">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Uptime
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatUptime(systemHealth.uptime)}
                  </p>
                </div>
              </div>
            </div>

            {/* Active Users */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/20">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Active Users
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {systemHealth.metrics.activeUsers}
                  </p>
                </div>
              </div>
            </div>

            {/* Response Time */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/20">
                  <Zap className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Response Time
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {systemHealth.metrics.responseTime}ms
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* System Components */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              System Components
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {Object.entries(systemHealth.components).map(([component, status]) => (
                <div key={component} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${
                      status === 'healthy' ? 'bg-green-500' :
                      status === 'warning' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {component}
                    </span>
                  </div>
                  <span className={`text-xs font-medium capitalize ${
                    status === 'healthy' ? 'text-green-600 dark:text-green-400' :
                    status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* System Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Resource Usage
              </h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Memory Usage</span>
                    <span className="font-medium text-gray-900 dark:text-white">{systemHealth.metrics.memoryUsage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        systemHealth.metrics.memoryUsage > 80 ? 'bg-red-500' :
                        systemHealth.metrics.memoryUsage > 60 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${systemHealth.metrics.memoryUsage}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Disk Usage</span>
                    <span className="font-medium text-gray-900 dark:text-white">{systemHealth.metrics.diskUsage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        systemHealth.metrics.diskUsage > 80 ? 'bg-red-500' :
                        systemHealth.metrics.diskUsage > 60 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${systemHealth.metrics.diskUsage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Performance Metrics
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Error Rate</span>
                  <span className={`text-sm font-medium ${
                    systemHealth.metrics.errorRate > 0.05 ? 'text-red-600 dark:text-red-400' :
                    'text-green-600 dark:text-green-400'
                  }`}>
                    {(systemHealth.metrics.errorRate * 100).toFixed(2)}%
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Avg Response Time</span>
                  <span className={`text-sm font-medium ${
                    systemHealth.metrics.responseTime > 1000 ? 'text-red-600 dark:text-red-400' :
                    systemHealth.metrics.responseTime > 500 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-green-600 dark:text-green-400'
                  }`}>
                    {systemHealth.metrics.responseTime}ms
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Last Checked</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(systemHealth.lastChecked).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Modals */}
      <BackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        onBackupCreated={() => setBackups(getBackups())}
        adminUser={adminUser}
      />

      <ConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={editingConfig}
        onSave={handleUpdateConfig}
      />

      <FeatureFlagModal
        isOpen={showFeatureFlagModal}
        onClose={() => setShowFeatureFlagModal(false)}
        flag={editingFlag}
        onSave={handleUpdateFeatureFlag}
      />
    </div>
  );
};

export default SystemAdministration;