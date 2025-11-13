/**
 * CollegeNotes Component
 *
 * Rich note-taking for colleges with:
 * - Text notes
 * - Voice notes (future)
 * - Document attachments
 * - Tags and organization
 * - Share with family
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  StickyNote,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Tag,
  Share2,
  Paperclip,
  Calendar
} from 'lucide-react';

interface Note {
  id: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  attachments?: {
    name: string;
    size: number;
    type: string;
  }[];
}

export default function CollegeNotes({
  collegeId,
  collegeName
}: {
  collegeId: string;
  collegeName: string;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTags, setNewNoteTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Load notes from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem(`notes_${collegeId}`);
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes, (key, value) => {
        if (key === 'createdAt' || key === 'updatedAt') {
          return new Date(value);
        }
        return value;
      }));
    }
  }, [collegeId]);

  // Save notes to localStorage
  const saveNotes = (updatedNotes: Note[]) => {
    setNotes(updatedNotes);
    localStorage.setItem(`notes_${collegeId}`, JSON.stringify(updatedNotes));
  };

  const addNote = () => {
    if (!newNoteContent.trim()) return;

    const note: Note = {
      id: Date.now().toString(),
      content: newNoteContent,
      tags: newNoteTags,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    saveNotes([note, ...notes]);
    setNewNoteContent('');
    setNewNoteTags([]);
    setIsAddingNote(false);
  };

  const deleteNote = (noteId: string) => {
    if (confirm('Delete this note?')) {
      saveNotes(notes.filter(note => note.id !== noteId));
    }
  };

  const updateNote = (noteId: string, content: string) => {
    saveNotes(
      notes.map(note =>
        note.id === noteId
          ? { ...note, content, updatedAt: new Date() }
          : note
      )
    );
    setEditingNoteId(null);
  };

  const addTag = (noteId: string, tag: string) => {
    if (!tag.trim()) return;
    saveNotes(
      notes.map(note =>
        note.id === noteId
          ? { ...note, tags: [...note.tags, tag.trim()] }
          : note
      )
    );
  };

  const removeTag = (noteId: string, tagToRemove: string) => {
    saveNotes(
      notes.map(note =>
        note.id === noteId
          ? { ...note, tags: note.tags.filter(t => t !== tagToRemove) }
          : note
      )
    );
  };

  const addTagToNewNote = () => {
    if (tagInput.trim() && !newNoteTags.includes(tagInput.trim())) {
      setNewNoteTags([...newNoteTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <StickyNote className="w-6 h-6 mr-2" />
            My Notes
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Personal notes for {collegeName}
          </p>
        </div>
        <button
          onClick={() => setIsAddingNote(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add Note</span>
        </button>
      </div>

      {/* Add Note Form */}
      {isAddingNote && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl border-2 border-blue-500 p-6"
        >
          <div className="space-y-4">
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Write your note here..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
              rows={6}
              autoFocus
            />

            {/* Tags Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTagToNewNote();
                    }
                  }}
                  placeholder="Add tag..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={addTagToNewNote}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Tags Display */}
              {newNoteTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {newNoteTags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm flex items-center space-x-2"
                    >
                      <span>{tag}</span>
                      <button
                        onClick={() => setNewNoteTags(newNoteTags.filter((_, i) => i !== index))}
                        className="hover:text-blue-900 dark:hover:text-blue-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsAddingNote(false);
                  setNewNoteContent('');
                  setNewNoteTags([]);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addNote}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Note</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
          <StickyNote className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">No notes yet</p>
          <button
            onClick={() => setIsAddingNote(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Your First Note</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note, index) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              {editingNoteId === note.id ? (
                // Edit Mode
                <div className="space-y-4">
                  <textarea
                    defaultValue={note.content}
                    id={`edit-${note.id}`}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={6}
                  />
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setEditingNoteId(null)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const textarea = document.getElementById(`edit-${note.id}`) as HTMLTextAreaElement;
                        updateNote(note.id, textarea.value);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                        {note.content}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => setEditingNoteId(note.id)}
                        className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {/* Share functionality */}}
                        className="p-2 text-gray-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                        title="Share"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {note.tags.map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm flex items-center space-x-2"
                        >
                          <Tag className="w-3 h-3" />
                          <span>{tag}</span>
                          <button
                            onClick={() => removeTag(note.id, tag)}
                            className="hover:text-red-600 dark:hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-4">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {note.createdAt.toLocaleDateString()}
                    </div>
                    {note.updatedAt.getTime() !== note.createdAt.getTime() && (
                      <div>Updated {note.updatedAt.toLocaleDateString()}</div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
