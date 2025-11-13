'use client';

import React, { useState, useEffect } from 'react';
import { Heart, Star, BookOpen, GraduationCap, BarChart3, Trash2, ExternalLink, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import CollegeWorkspace from '@/components/college/CollegeWorkspace';

interface FavoriteItem {
  id: string;
  type: 'college' | 'course' | 'cutoff';
  data: any;
  addedAt: string;
  tags: string[];
  notes?: string;
}

const FavoritesManager: React.FC = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [filteredFavorites, setFilteredFavorites] = useState<FavoriteItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'college' | 'course' | 'cutoff'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState<any | null>(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

  useEffect(() => {
    loadFavorites();
  }, [user]);

  useEffect(() => {
    filterFavorites();
  }, [favorites, activeFilter, searchQuery, selectedTags]);

  const loadFavorites = () => {
    if (!user) return;
    
    // Load from localStorage (in real app, this would be from API)
    const savedFavorites = localStorage.getItem(`favorites_${user.uid}`);
    if (savedFavorites) {
      const parsed = JSON.parse(savedFavorites);
      setFavorites(parsed);
      
      // Extract unique tags
      const tags = [...new Set(parsed.flatMap((fav: FavoriteItem) => fav.tags))];
      setAvailableTags(tags);
    }
  };

  const saveFavorites = (newFavorites: FavoriteItem[]) => {
    if (!user) return;
    localStorage.setItem(`favorites_${user.uid}`, JSON.stringify(newFavorites));
    setFavorites(newFavorites);
  };

  const addToFavorites = (type: 'college' | 'course' | 'cutoff', data: any, tags: string[] = [], notes?: string) => {
    if (!user) return;

    const newFavorite: FavoriteItem = {
      id: `${type}_${data.id}_${Date.now()}`,
      type,
      data,
      addedAt: new Date().toISOString(),
      tags,
      notes
    };

    const updatedFavorites = [...favorites, newFavorite];
    saveFavorites(updatedFavorites);
  };

  const removeFromFavorites = (id: string) => {
    const updatedFavorites = favorites.filter(fav => fav.id !== id);
    saveFavorites(updatedFavorites);
  };

  const updateFavorite = (id: string, updates: Partial<FavoriteItem>) => {
    const updatedFavorites = favorites.map(fav => 
      fav.id === id ? { ...fav, ...updates } : fav
    );
    saveFavorites(updatedFavorites);
  };

  const filterFavorites = () => {
    let filtered = favorites;

    // Filter by type
    if (activeFilter !== 'all') {
      filtered = filtered.filter(fav => fav.type === activeFilter);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(fav => {
        const searchableText = [
          fav.data.name || fav.data.college_name,
          fav.data.city,
          fav.data.state,
          fav.data.stream,
          fav.notes || ''
        ].join(' ').toLowerCase();
        
        return searchableText.includes(searchQuery.toLowerCase());
      });
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(fav => 
        selectedTags.some(tag => fav.tags.includes(tag))
      );
    }

    setFilteredFavorites(filtered);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'college': return GraduationCap;
      case 'course': return BookOpen;
      case 'cutoff': return BarChart3;
      default: return Star;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'college': return 'text-blue-600 dark:text-blue-400';
      case 'course': return 'text-purple-600 dark:text-purple-400';
      case 'cutoff': return 'text-green-600 dark:text-green-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const FavoriteCard: React.FC<{ item: FavoriteItem }> = ({ item }) => {
    const TypeIcon = getTypeIcon(item.type);
    const typeColor = getTypeColor(item.type);

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700`}>
              <TypeIcon className={`h-5 w-5 ${typeColor}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {item.data.name || item.data.college_name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {item.data.city && item.data.state && `${item.data.city}, ${item.data.state}`}
                {item.data.course_name && ` • ${item.data.course_name}`}
              </p>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColor} bg-gray-100 dark:bg-gray-700`}>
                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Added {new Date(item.addedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => removeFromFavorites(item.id)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {item.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {item.notes && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 italic">
              "{item.notes}"
            </p>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              onClick={() => {
                if (item.type === 'college') {
                  setSelectedCollege(item.data);
                  setIsWorkspaceOpen(true);
                }
              }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View Details
            </button>
            <button className="text-gray-600 hover:text-gray-700 text-sm font-medium">
              Edit Notes
            </button>
          </div>
          <button className="p-1 text-gray-400 hover:text-gray-600">
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Sign in to save favorites
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Create an account to save colleges, courses, and cutoffs for later reference.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Favorites</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {favorites.length} saved items
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Heart className="h-4 w-4 mr-2" />
          Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-4">
          {/* Type Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <div className="flex space-x-1">
              {(['all', 'college', 'course', 'cutoff'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveFilter(type)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    activeFilter === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search favorites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />

          {/* Tag Filter */}
          {availableTags.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Tags:</span>
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSelectedTags(prev => 
                        prev.includes(tag) 
                          ? prev.filter(t => t !== tag)
                          : [...prev, tag]
                      );
                    }}
                    className={`px-2 py-1 rounded-full text-xs transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {filteredFavorites.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {favorites.length === 0 ? 'No favorites yet' : 'No matching favorites'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {favorites.length === 0 
              ? 'Start adding colleges, courses, and cutoffs to your favorites'
              : 'Try adjusting your search or filter criteria'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFavorites.map((item) => (
            <FavoriteCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* College Workspace Modal */}
      {selectedCollege && (
        <CollegeWorkspace
          isOpen={isWorkspaceOpen}
          onClose={() => {
            setIsWorkspaceOpen(false);
            setSelectedCollege(null);
          }}
          college={selectedCollege}
        />
      )}
    </div>
  );
};

export default FavoritesManager;
