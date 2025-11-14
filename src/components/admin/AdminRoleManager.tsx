'use client';

import React, { useState, useEffect } from 'react';
import { Shield, UserCheck, UserX, Search, Clock } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  assignAdminRole,
  getUserRole,
  getRoleChangeHistory,
  UserRole
} from '@/lib/admin-auth';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

interface RoleChange {
  id: string;
  old_role: string | null;
  new_role: string;
  changed_at: string;
  reason: string | null;
}

const AdminRoleManager: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleHistory, setRoleHistory] = useState<RoleChange[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [assigningRole, setAssigningRole] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, role, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get emails from auth
      const { data: authData } = await supabase.auth.admin.listUsers();

      const usersWithEmails = data.map(profile => {
        const authUser = authData?.users.find(u => u.id === profile.user_id);
        return {
          id: profile.user_id,
          email: authUser?.email || 'Unknown',
          role: (profile.role || 'user') as UserRole,
          created_at: profile.created_at
        };
      });

      setUsers(usersWithEmails);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = async (userId: string, newRole: UserRole, reason: string) => {
    if (!user) return;

    try {
      setAssigningRole(true);
      const result = await assignAdminRole(userId, newRole, user.id, reason);

      if (result.success) {
        toast.success(`Role updated to ${newRole}`);
        await loadUsers();
        setSelectedUser(null);
      } else {
        toast.error(result.error || 'Failed to assign role');
      }
    } catch (error) {
      console.error('Error assigning role:', error);
      toast.error('Failed to assign role');
    } finally {
      setAssigningRole(false);
    }
  };

  const handleViewHistory = async (userId: string) => {
    try {
      const history = await getRoleChangeHistory(userId);
      setRoleHistory(history);
      setShowHistory(true);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load role history');
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-500 text-white';
      case 'admin':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className={`${
      isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
    } rounded-lg p-6`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Shield className="w-6 h-6 mr-2 text-purple-500" />
          <h2 className="text-2xl font-bold">User Role Management</h2>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              isDarkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-gray-50 border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-purple-500`}
          />
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-8">Loading users...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
              } text-left`}>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Member Since</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className={`border-b ${
                    isDarkMode ? 'border-gray-700' : 'border-gray-200'
                  }`}
                >
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                      {user.role.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm"
                    >
                      <UserCheck className="w-4 h-4 inline mr-1" />
                      Change Role
                    </button>
                    <button
                      onClick={() => handleViewHistory(user.id)}
                      className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition text-sm"
                    >
                      <Clock className="w-4 h-4 inline mr-1" />
                      History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Change Role Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          } rounded-lg p-6 max-w-md w-full mx-4`}>
            <h3 className="text-xl font-bold mb-4">Change Role for {selectedUser.email}</h3>

            <div className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold">Current Role:</label>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(selectedUser.role)}`}>
                  {selectedUser.role.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              <div>
                <label className="block mb-2 font-semibold">New Role:</label>
                <select
                  id="newRole"
                  className={`w-full px-3 py-2 rounded border ${
                    isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  }`}
                  defaultValue={selectedUser.role}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block mb-2 font-semibold">Reason:</label>
                <textarea
                  id="reason"
                  rows={3}
                  placeholder="Optional reason for role change..."
                  className={`w-full px-3 py-2 rounded border ${
                    isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  }`}
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    const newRole = (document.getElementById('newRole') as HTMLSelectElement).value as UserRole;
                    const reason = (document.getElementById('reason') as HTMLTextAreaElement).value;
                    handleAssignRole(selectedUser.id, newRole, reason);
                  }}
                  disabled={assigningRole}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:opacity-50"
                >
                  {assigningRole ? 'Updating...' : 'Update Role'}
                </button>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          } rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto`}>
            <h3 className="text-xl font-bold mb-4">Role Change History</h3>

            {roleHistory.length === 0 ? (
              <p className="text-gray-500">No role changes recorded</p>
            ) : (
              <div className="space-y-3">
                {roleHistory.map((change) => (
                  <div
                    key={change.id}
                    className={`p-4 rounded border ${
                      isDarkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold">
                          {change.old_role || 'N/A'} → {change.new_role}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(change.changed_at).toLocaleString()}
                      </span>
                    </div>
                    {change.reason && (
                      <p className="text-sm text-gray-600">{change.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowHistory(false)}
              className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRoleManager;
