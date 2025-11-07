import { useState, useCallback } from 'react';

export interface BulkOperationItem {
  id: string;
  type: 'college' | 'course' | 'cutoff';
  name: string;
}

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export function useBulkOperations() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleItem = useCallback((id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedItems(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const isSelected = useCallback((id: string) => {
    return selectedItems.has(id);
  }, [selectedItems]);

  const bulkApprove = async (
    items: BulkOperationItem[]
  ): Promise<BulkOperationResult> => {
    setIsProcessing(true);
    const result: BulkOperationResult = { success: 0, failed: 0, errors: [] };

    try {
      for (const item of items) {
        if (selectedItems.has(item.id)) {
          try {
            const response = await fetch(`/api/staging/approve/${item.type}/${item.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ approved: true })
            });

            if (response.ok) {
              result.success++;
            } else {
              result.failed++;
              result.errors.push({ id: item.id, error: 'Request failed' });
            }
          } catch (error) {
            result.failed++;
            result.errors.push({ id: item.id, error: String(error) });
          }
        }
      }
    } finally {
      setIsProcessing(false);
      clearSelection();
    }

    return result;
  };

  const bulkReject = async (
    items: BulkOperationItem[]
  ): Promise<BulkOperationResult> => {
    setIsProcessing(true);
    const result: BulkOperationResult = { success: 0, failed: 0, errors: [] };

    try {
      for (const item of items) {
        if (selectedItems.has(item.id)) {
          try {
            const response = await fetch(`/api/staging/reject/${item.type}/${item.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rejected: true })
            });

            if (response.ok) {
              result.success++;
            } else {
              result.failed++;
              result.errors.push({ id: item.id, error: 'Request failed' });
            }
          } catch (error) {
            result.failed++;
            result.errors.push({ id: item.id, error: String(error) });
          }
        }
      }
    } finally {
      setIsProcessing(false);
      clearSelection();
    }

    return result;
  };

  const bulkDelete = async (
    items: BulkOperationItem[]
  ): Promise<BulkOperationResult> => {
    setIsProcessing(true);
    const result: BulkOperationResult = { success: 0, failed: 0, errors: [] };

    try {
      for (const item of items) {
        if (selectedItems.has(item.id)) {
          try {
            const response = await fetch(`/api/staging/${item.type}/${item.id}`, {
              method: 'DELETE'
            });

            if (response.ok) {
              result.success++;
            } else {
              result.failed++;
              result.errors.push({ id: item.id, error: 'Request failed' });
            }
          } catch (error) {
            result.failed++;
            result.errors.push({ id: item.id, error: String(error) });
          }
        }
      }
    } finally {
      setIsProcessing(false);
      clearSelection();
    }

    return result;
  };

  return {
    selectedItems,
    selectedCount: selectedItems.size,
    toggleItem,
    selectAll,
    clearSelection,
    isSelected,
    bulkApprove,
    bulkReject,
    bulkDelete,
    isProcessing
  };
}
