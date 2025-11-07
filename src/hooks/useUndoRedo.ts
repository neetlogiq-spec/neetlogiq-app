import { useState, useCallback } from 'react';

export interface Action {
  type: 'approve' | 'reject' | 'manual-match' | 'delete' | 'bulk-approve' | 'bulk-reject';
  itemId: string | string[];
  itemType: 'college' | 'course' | 'cutoff';
  previousState?: any;
  timestamp: number;
}

const MAX_HISTORY_SIZE = 50;

export function useUndoRedo() {
  const [undoStack, setUndoStack] = useState<Action[]>([]);
  const [redoStack, setRedoStack] = useState<Action[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);

  const addAction = useCallback((action: Omit<Action, 'timestamp'>) => {
    const newAction: Action = {
      ...action,
      timestamp: Date.now()
    };

    setUndoStack(prev => {
      const newStack = [...prev, newAction];
      // Limit history size
      if (newStack.length > MAX_HISTORY_SIZE) {
        newStack.shift();
      }
      return newStack;
    });

    // Clear redo stack when new action is added
    setRedoStack([]);
  }, []);

  const undo = useCallback(async (): Promise<boolean> => {
    if (undoStack.length === 0) return false;

    setIsUndoing(true);
    const action = undoStack[undoStack.length - 1];

    try {
      // Perform undo operation based on action type
      let success = false;

      if (Array.isArray(action.itemId)) {
        // Bulk operation undo
        for (const id of action.itemId) {
          const response = await fetch(`/api/staging/undo/${action.itemType}/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ previousState: action.previousState })
          });
          if (!response.ok) {
            console.error(`Failed to undo ${action.type} for ${id}`);
          }
        }
        success = true;
      } else {
        // Single item undo
        const response = await fetch(`/api/staging/undo/${action.itemType}/${action.itemId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ previousState: action.previousState })
        });
        success = response.ok;
      }

      if (success) {
        // Move action from undo to redo stack
        setUndoStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev, action]);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Undo failed:', error);
      return false;
    } finally {
      setIsUndoing(false);
    }
  }, [undoStack]);

  const redo = useCallback(async (): Promise<boolean> => {
    if (redoStack.length === 0) return false;

    setIsUndoing(true);
    const action = redoStack[redoStack.length - 1];

    try {
      // Re-perform the action
      let success = false;

      if (Array.isArray(action.itemId)) {
        // Bulk operation redo
        for (const id of action.itemId) {
          const endpoint = action.type.includes('approve') ? 'approve' : 'reject';
          const response = await fetch(`/api/staging/${endpoint}/${action.itemType}/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [action.type.replace('bulk-', '')]: true })
          });
          if (!response.ok) {
            console.error(`Failed to redo ${action.type} for ${id}`);
          }
        }
        success = true;
      } else {
        // Single item redo
        const endpoint = action.type === 'approve' ? 'approve' :
                        action.type === 'reject' ? 'reject' :
                        'manual-match';
        const response = await fetch(`/api/staging/${endpoint}/${action.itemType}/${action.itemId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [action.type]: true })
        });
        success = response.ok;
      }

      if (success) {
        // Move action from redo to undo stack
        setRedoStack(prev => prev.slice(0, -1));
        setUndoStack(prev => [...prev, action]);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Redo failed:', error);
      return false;
    } finally {
      setIsUndoing(false);
    }
  }, [redoStack]);

  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  return {
    addAction,
    undo,
    redo,
    clearHistory,
    canUndo,
    canRedo,
    isUndoing,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
    lastAction: undoStack.length > 0 ? undoStack[undoStack.length - 1] : null
  };
}
