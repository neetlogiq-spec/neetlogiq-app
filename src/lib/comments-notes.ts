// Comments and Notes System for Staging Review

export interface Comment {
  id: string;
  itemId: string;
  itemType: 'college' | 'course' | 'cutoff';
  author: string;
  content: string;
  timestamp: number;
  edited?: boolean;
  editedAt?: number;
}

export interface Note {
  id: string;
  itemId: string;
  itemType: 'college' | 'course' | 'cutoff';
  content: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

class CommentsNotesManager {
  private comments: Map<string, Comment[]> = new Map();
  private notes: Map<string, Note> = new Map();
  private storageKey = 'staging-review-comments-notes';

  constructor() {
    this.loadFromStorage();
  }

  // Comments
  addComment(
    itemId: string,
    itemType: 'college' | 'course' | 'cutoff',
    content: string,
    author: string = 'User'
  ): Comment {
    const comment: Comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      itemId,
      itemType,
      author,
      content,
      timestamp: Date.now()
    };

    const key = `${itemType}-${itemId}`;
    const existing = this.comments.get(key) || [];
    this.comments.set(key, [...existing, comment]);
    this.saveToStorage();

    return comment;
  }

  getComments(itemId: string, itemType: 'college' | 'course' | 'cutoff'): Comment[] {
    const key = `${itemType}-${itemId}`;
    return this.comments.get(key) || [];
  }

  editComment(commentId: string, newContent: string): boolean {
    for (const [key, comments] of this.comments.entries()) {
      const index = comments.findIndex(c => c.id === commentId);
      if (index !== -1) {
        comments[index] = {
          ...comments[index],
          content: newContent,
          edited: true,
          editedAt: Date.now()
        };
        this.comments.set(key, comments);
        this.saveToStorage();
        return true;
      }
    }
    return false;
  }

  deleteComment(commentId: string): boolean {
    for (const [key, comments] of this.comments.entries()) {
      const filtered = comments.filter(c => c.id !== commentId);
      if (filtered.length !== comments.length) {
        this.comments.set(key, filtered);
        this.saveToStorage();
        return true;
      }
    }
    return false;
  }

  // Notes
  addNote(
    itemId: string,
    itemType: 'college' | 'course' | 'cutoff',
    content: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
    tags: string[] = []
  ): Note {
    const note: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      itemId,
      itemType,
      content,
      priority,
      tags,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const key = `${itemType}-${itemId}`;
    this.notes.set(key, note);
    this.saveToStorage();

    return note;
  }

  getNote(itemId: string, itemType: 'college' | 'course' | 'cutoff'): Note | null {
    const key = `${itemType}-${itemId}`;
    return this.notes.get(key) || null;
  }

  updateNote(
    itemId: string,
    itemType: 'college' | 'course' | 'cutoff',
    updates: Partial<Omit<Note, 'id' | 'itemId' | 'itemType' | 'createdAt'>>
  ): boolean {
    const key = `${itemType}-${itemId}`;
    const existing = this.notes.get(key);

    if (existing) {
      this.notes.set(key, {
        ...existing,
        ...updates,
        updatedAt: Date.now()
      });
      this.saveToStorage();
      return true;
    }

    return false;
  }

  deleteNote(itemId: string, itemType: 'college' | 'course' | 'cutoff'): boolean {
    const key = `${itemType}-${itemId}`;
    const deleted = this.notes.delete(key);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  // Search and Filter
  searchNotesByTag(tag: string): Note[] {
    return Array.from(this.notes.values()).filter(note =>
      note.tags.includes(tag)
    );
  }

  getNotesByPriority(priority: 'low' | 'medium' | 'high'): Note[] {
    return Array.from(this.notes.values()).filter(note =>
      note.priority === priority
    );
  }

  getAllNotes(): Note[] {
    return Array.from(this.notes.values());
  }

  getAllComments(): Comment[] {
    return Array.from(this.comments.values()).flat();
  }

  // Storage
  private saveToStorage() {
    try {
      const data = {
        comments: Array.from(this.comments.entries()),
        notes: Array.from(this.notes.entries())
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save comments/notes to storage:', error);
    }
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.comments = new Map(parsed.comments || []);
        this.notes = new Map(parsed.notes || []);
      }
    } catch (error) {
      console.error('Failed to load comments/notes from storage:', error);
    }
  }

  clearAll() {
    this.comments.clear();
    this.notes.clear();
    localStorage.removeItem(this.storageKey);
  }

  // Export/Import
  exportToJSON(): string {
    return JSON.stringify({
      comments: Array.from(this.comments.entries()),
      notes: Array.from(this.notes.entries()),
      exportedAt: Date.now()
    }, null, 2);
  }

  importFromJSON(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      this.comments = new Map(data.comments || []);
      this.notes = new Map(data.notes || []);
      this.saveToStorage();
      return true;
    } catch (error) {
      console.error('Failed to import comments/notes:', error);
      return false;
    }
  }
}

export const commentsNotesManager = new CommentsNotesManager();
