'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Briefcase,
  GraduationCap,
  Edit2,
  Save,
  X,
  Camera,
  Shield,
  Eye,
  EyeOff,
  Trash2,
  Bell,
  Lock,
  Settings,
  Activity,
  Clock,
  Award,
  BookOpen,
  TrendingUp,
  Target
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
<<<<<<< Updated upstream:edge-native-app/src/app/profile/page.tsx

=======
import { useStream } from '@/contexts/StreamContext';
import RequestStreamChangeDialog from '@/components/user/RequestStreamChangeDialog';
import { Vortex } from '@/components/ui/vortex';
import LightVortex from '@/components/ui/LightVortex';
import { useTheme } from '@/contexts/ThemeContext';
>>>>>>> Stashed changes:src/components/profile/ProfileClient.tsx
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  location?: string;
  bio?: string;
  occupation?: string;
  education?: string;
  interests?: string[];
  preferences: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    dataSharing: boolean;
    theme: 'light' | 'dark' | 'system';
    language: string;
  };
  stats: {
    joinedDate: string;
    lastActive: string;
    totalLogins: number;
    favoriteColleges: number;
    searchesPerformed: number;
    achievementPoints: number;
  };
}
<<<<<<< Updated upstream:edge-native-app/src/app/profile/page.tsx

const ProfilePage: React.FC = () => {
=======
export default function ProfileClient() {
  const { isDarkMode } = useTheme();
>>>>>>> Stashed changes:src/components/profile/ProfileClient.tsx
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'security' | 'activity'>('profile');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    location: '',
    bio: '',
    occupation: '',
    education: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load user profile
  useEffect(() => {
    if (user && isAuthenticated) {
      loadProfile();
    }
  }, [user, isAuthenticated]);

  const loadProfile = async () => {
    try {
      setProfileLoading(true);
      // TODO: Replace with actual API call
      const mockProfile: UserProfile = {
        uid: user?.uid || '',
        email: user?.email || '',
        displayName: user?.displayName || 'User',
        photoURL: user?.photoURL,
        firstName: user?.displayName?.split(' ')[0] || '',
        lastName: user?.displayName?.split(' ').slice(1).join(' ') || '',
        phone: '',
        dateOfBirth: '',
        location: '',
        bio: '',
        occupation: '',
        education: '',
        interests: ['Medical Education', 'NEET Preparation', 'College Research'],
        preferences: {
          emailNotifications: true,
          pushNotifications: true,
          dataSharing: false,
          theme: 'system',
          language: 'en'
        },
        stats: {
          joinedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          lastActive: new Date().toISOString(),
          totalLogins: 45,
          favoriteColleges: 12,
          searchesPerformed: 156,
          achievementPoints: 1250
        }
      };
      
<<<<<<< Updated upstream:edge-native-app/src/app/profile/page.tsx
      setProfile(mockProfile);
      setFormData({
        firstName: mockProfile.firstName || '',
        lastName: mockProfile.lastName || '',
        phone: mockProfile.phone || '',
        dateOfBirth: mockProfile.dateOfBirth || '',
        location: mockProfile.location || '',
        bio: mockProfile.bio || '',
        occupation: mockProfile.occupation || '',
        education: mockProfile.education || ''
      });
=======
      if (result.success && result.data) {
        const profileData = result.data;
        const mockProfile: UserProfile = {
          uid: user?.uid || '',
          email: user?.email || '',
          displayName: user?.displayName || 'User',
          photoURL: user?.photoURL,
          firstName: profileData.first_name || user?.givenName || user?.displayName?.split(' ')[0] || '',
          lastName: profileData.last_name || user?.displayName?.split(' ').slice(1).join(' ') || '',
          phone: profileData.phone || '',
          dateOfBirth: profileData.date_of_birth || '',
          location: profileData.location || '',
          bio: profileData.bio || '',
          occupation: profileData.occupation || '',
          education: profileData.education || '',
          interests: profileData.interests || ['Medical Education', 'NEET Preparation', 'College Research'],
          preferences: profileData.preferences || {
            emailNotifications: true,
            pushNotifications: true,
            dataSharing: false,
            theme: 'system',
            language: 'en'
          },
          stats: {
            joinedDate: profileData.created_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            lastActive: new Date().toISOString(),
            totalLogins: 45,
            favoriteColleges: 12,
            searchesPerformed: 156,
            achievementPoints: 1250
          }
        };
        
        setProfile(mockProfile);
        setFormData({
          firstName: mockProfile.firstName || '',
          lastName: mockProfile.lastName || '',
          phone: mockProfile.phone || '',
          dateOfBirth: mockProfile.dateOfBirth || '',
          location: mockProfile.location || '',
          bio: mockProfile.bio || '',
          occupation: mockProfile.occupation || '',
          education: mockProfile.education || ''
        });
      }
>>>>>>> Stashed changes:src/components/profile/ProfileClient.tsx
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePreferenceChange = (key: string, value: any) => {
    if (profile) {
      setProfile(prev => prev ? {
        ...prev,
        preferences: {
          ...prev.preferences,
          [key]: value
        }
      } : null);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      // TODO: Implement actual API call to save profile
      console.log('Saving profile:', formData);
      
      // Update profile with new data
      if (profile) {
        setProfile(prev => prev ? {
          ...prev,
          ...formData,
          displayName: `${formData.firstName} ${formData.lastName}`.trim()
        } : null);
      }
      
      setIsEditing(false);
      // Show success message
    } catch (error) {
      console.error('Error saving profile:', error);
      // Show error message
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        alert('New passwords do not match');
        return;
      }

      if (passwordData.newPassword.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
      }

      setSaving(true);
      // TODO: Implement actual password change API call
      console.log('Changing password');
      
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordChange(false);
      alert('Password changed successfully');
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading || profileLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-black' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Dynamic Background */}
      {isDarkMode ? (
        <Vortex
          className="fixed inset-0 z-0"
          particleCount={600}
          baseHue={260}
          rangeHue={80}
          baseSpeed={0.15}
          rangeSpeed={1.8}
          baseRadius={1}
          rangeRadius={2.5}
          backgroundColor="#000000"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-black/30 z-10"></div>
        </Vortex>
      ) : (
        <LightVortex
          className="fixed inset-0 z-0"
          particleCount={400}
          baseHue={260}
          baseSpeed={0.12}
          rangeSpeed={1.5}
          baseRadius={1.5}
          rangeRadius={3}
          backgroundColor="#ffffff"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-indigo-50/20 to-pink-50/30 z-10"></div>
        </LightVortex>
      )}

      <div className="relative z-10 min-h-screen pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl shadow-lg p-6 mb-6 border transition-all duration-300 backdrop-blur-md ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white border-gray-200'
            }`}
          >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={profile.displayName}
                    className="w-20 h-20 rounded-full"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                    <User className="w-10 h-10 text-gray-600 dark:text-gray-300" />
                  </div>
                )}
                <button
                  onClick={() => console.log('Change photo')}
                  className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors"
                >
                  <Camera className="w-3 h-3" />
                </button>
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {profile.displayName}
                </h1>
                <p className={`${isDarkMode ? 'text-slate-200/90' : 'text-gray-600'}`}>{profile.email}</p>
                <div className="flex items-center mt-2">
                  <Calendar className="w-4 h-4 text-gray-400 mr-1" />
                  <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-500'}`}>
                    Joined {formatDate(profile.stats.joinedDate)}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center text-green-600 dark:text-green-400 mb-1">
                <Activity className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Active</span>
              </div>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                Last active: {formatDate(profile.stats.lastActive)}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t ${
            isDarkMode ? 'border-white/10' : 'border-gray-200'
          }`}>
            <div className="text-center group">
              <div className={`text-2xl font-bold transition-all duration-300 ${
                isDarkMode ? 'text-blue-400' : 'text-blue-600'
              }`}>{profile.stats.totalLogins}</div>
              <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Total Logins</div>
            </div>
            <div className="text-center group">
              <div className={`text-2xl font-bold transition-all duration-300 ${
                isDarkMode ? 'text-green-400' : 'text-green-600'
              }`}>{profile.stats.favoriteColleges}</div>
              <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Favorite Colleges</div>
            </div>
            <div className="text-center group">
              <div className={`text-2xl font-bold transition-all duration-300 ${
                isDarkMode ? 'text-purple-400' : 'text-purple-600'
              }`}>{profile.stats.searchesPerformed}</div>
              <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Searches</div>
            </div>
            <div className="text-center group">
              <div className={`text-2xl font-bold transition-all duration-300 ${
                isDarkMode ? 'text-orange-400' : 'text-orange-600'
              }`}>{profile.stats.achievementPoints}</div>
              <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Points</div>
            </div>
          </div>
        </motion.div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'profile', name: 'Profile', icon: User },
              { id: 'preferences', name: 'Preferences', icon: Settings },
              { id: 'security', name: 'Security', icon: Shield },
              { id: 'activity', name: 'Activity', icon: Activity }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 ${
                  activeTab === tab.id
                    ? isDarkMode
                      ? 'bg-white text-gray-900 shadow-lg'
                      : 'bg-blue-600 text-white shadow-lg'
                    : isDarkMode
                      ? 'text-slate-300 hover:text-white hover:bg-white/10'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl shadow-lg p-6 backdrop-blur-md border transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Personal Information
              </h2>
              {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                      isDarkMode 
                        ? 'text-blue-400 hover:bg-white/5' 
                        : 'text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        // Reset form data
                        setFormData({
                          firstName: profile.firstName || '',
                          lastName: profile.lastName || '',
                          phone: profile.phone || '',
                          dateOfBirth: profile.dateOfBirth || '',
                          location: profile.location || '',
                          bio: profile.bio || '',
                          occupation: profile.occupation || '',
                          education: profile.education || ''
                        });
                      }}
                      className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                        isDarkMode 
                          ? 'text-slate-300 hover:bg-white/5' 
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  First Name
                </label>
                {isEditing ? (
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } border`}
                    />
                ) : (
                  <p className={`py-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {profile.firstName || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Last Name
                </label>
                {isEditing ? (
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } border`}
                    />
                ) : (
                  <p className={`py-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {profile.lastName || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Phone Number
                </label>
                {isEditing ? (
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } border`}
                    />
                ) : (
                  <p className={`py-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {profile.phone || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Date of Birth
                </label>
                {isEditing ? (
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-white [color-scheme:dark]' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } border`}
                    />
                ) : (
                  <p className={`py-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {profile.dateOfBirth ? formatDate(profile.dateOfBirth) : 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Location
                </label>
                {isEditing ? (
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } border`}
                    />
                ) : (
                  <p className={`py-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {profile.location || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Occupation
                </label>
                {isEditing ? (
                    <input
                      type="text"
                      name="occupation"
                      value={formData.occupation}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } border`}
                    />
                ) : (
                  <p className={`py-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {profile.occupation || 'Not provided'}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Education
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="education"
                  value={formData.education}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              ) : (
                <p className="text-gray-900 dark:text-white py-2">
                  {profile.education || 'Not provided'}
                </p>
              )}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bio
              </label>
              {isEditing ? (
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Tell us about yourself..."
                />
              ) : (
                <p className="text-gray-900 dark:text-white py-2">
                  {profile.bio || 'No bio provided'}
                </p>
              )}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Interests
              </label>
              <div className="flex flex-wrap gap-2">
                {profile.interests?.map((interest, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 text-sm rounded-full"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
<<<<<<< Updated upstream:edge-native-app/src/app/profile/page.tsx
=======
            {/* Stream Selection Section */}
            {selectedStream && (
              <div className="mt-6 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Academic Stream
                  </label>
                  {isLocked && (
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Lock className="w-3 h-3 mr-1" />
                      Locked
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {selectedStream === 'UG' && 'Undergraduate (MBBS, BDS)'}
                      {selectedStream === 'PG_MEDICAL' && 'Postgraduate Medical (MD, MS)'}
                      {selectedStream === 'PG_DENTAL' && 'Postgraduate Dental (MDS)'}
                    </div>
                    {isLocked && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Stream selection is locked. Contact support to change.
                      </p>
                    )}
                    {changeRequested && (
                      <div className="flex items-center mt-2 text-sm text-orange-600 dark:text-orange-400">
                        <Clock className="w-4 h-4 mr-1" />
                        Change request pending admin approval
                      </div>
                    )}
                  </div>
                  {isLocked && !changeRequested && (
                    <button
                      onClick={() => setShowStreamChangeDialog(true)}
                      className="flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <Repeat className="w-4 h-4 mr-2" />
                      Request Change
                    </button>
                  )}
                </div>
                {isLocked && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-yellow-800 dark:text-yellow-400">
                        Your stream selection is permanent to ensure data consistency.
                        If you need to change it, click "Request Change" to submit a request to our admin team.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
>>>>>>> Stashed changes:src/components/profile/ProfileClient.tsx
          </motion.div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl shadow-lg p-6 backdrop-blur-md border transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white border-gray-200'
            }`}
          >
            <h2 className={`text-lg font-medium mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Preferences
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Notifications
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={profile.preferences.emailNotifications}
                      onChange={(e) => handlePreferenceChange('emailNotifications', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-900 dark:text-white">
                      Email notifications
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={profile.preferences.pushNotifications}
                      onChange={(e) => handlePreferenceChange('pushNotifications', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-900 dark:text-white">
                      Push notifications
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Privacy
                </h3>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={profile.preferences.dataSharing}
                    onChange={(e) => handlePreferenceChange('dataSharing', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-900 dark:text-white">
                    Allow anonymous data sharing for improvements
                  </span>
                </label>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Appearance
                </h3>
                <select
                  value={profile.preferences.theme}
                  onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Language
                </h3>
                <select
                  value={profile.preferences.language}
                  onChange={(e) => handlePreferenceChange('language', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="bn">Bengali</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className={`rounded-2xl shadow-lg p-6 backdrop-blur-md border transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white border-gray-200'
            }`}>
              <h2 className={`text-lg font-medium mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Security Settings
              </h2>

              <div className="space-y-4">
                <div className={`flex items-center justify-between p-4 border rounded-lg ${
                  isDarkMode ? 'border-white/10' : 'border-gray-200'
                }`}>
                  <div>
                    <h3 className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Password
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                      Last changed 3 months ago
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPasswordChange(!showPasswordChange)}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      isDarkMode 
                        ? 'text-blue-400 hover:bg-white/5' 
                        : 'text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    Change Password
                  </button>
                </div>

                {showPasswordChange && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={`p-4 rounded-lg space-y-4 ${
                      isDarkMode ? 'bg-white/5' : 'bg-gray-50'
                    }`}
                  >
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.current ? 'text' : 'password'}
                          name="currentPassword"
                          value={passwordData.currentPassword}
                          onChange={handlePasswordChange}
                          className={`w-full px-3 py-2 pr-10 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${
                            isDarkMode 
                              ? 'bg-white/5 border-white/10 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          } border`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPasswords.current ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.new ? 'text' : 'password'}
                          name="newPassword"
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPasswords.new ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? 'text' : 'password'}
                          name="confirmPassword"
                          value={passwordData.confirmPassword}
                          onChange={handlePasswordChange}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPasswords.confirm ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={handleChangePassword}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Changing...' : 'Change Password'}
                      </button>
                      <button
                        onClick={() => {
                          setShowPasswordChange(false);
                          setPasswordData({
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: ''
                          });
                        }}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}

                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      Two-Factor Authentication
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <button className="px-3 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                    Enable
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-800 rounded-lg">
                  <div>
                    <h3 className="text-sm font-medium text-red-900 dark:text-red-400">
                      Delete Account
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-500">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <button className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl shadow-lg p-6 backdrop-blur-md border transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white border-gray-200'
            }`}
          >
            <h2 className={`text-lg font-medium mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Recent Activity
            </h2>

            <div className="space-y-4">
              {[
                { action: 'Searched for medical colleges', time: '2 hours ago', icon: BookOpen },
                { action: 'Added college to favorites', time: '1 day ago', icon: Target },
                { action: 'Updated profile information', time: '3 days ago', icon: Edit2 },
                { action: 'Changed password', time: '1 week ago', icon: Lock },
                { action: 'Signed up for NeetLogIQ', time: formatDate(profile.stats.joinedDate), icon: Award }
              ].map((activity, index) => (
                <div key={index} className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                }`}>
                  <div className="shrink-0">
                    <activity.icon className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{activity.action}</p>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;