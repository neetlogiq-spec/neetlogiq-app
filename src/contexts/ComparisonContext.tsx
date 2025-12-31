'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { toast } from 'sonner';

export interface ComparisonItem {
  id: string; // Unique identifier (e.g., college_id + course_id)
  collegeName: string;
  programName: string;
  rank: number;
  probability?: number;
}

interface ComparisonContextType {
  items: ComparisonItem[];
  addItem: (item: ComparisonItem) => void;
  removeItem: (id: string) => void;
  clearBasket: () => void;
  isInBasket: (id: string) => boolean;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('comparison_basket');
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse comparison basket', e);
      }
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('comparison_basket', JSON.stringify(items));
  }, [items]);

  const addItem = (item: ComparisonItem) => {
    if (items.find((i) => i.id === item.id)) {
        toast.info("Already in comparison basket");
        return;
    }
    if (items.length >= 4) {
      toast.error("You can compare up to 4 colleges only");
      return;
    }
    setItems((prev) => [...prev, item]);
    toast.success("Added to comparison");
    setIsOpen(true); // Open drawer on add for better feedback
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearBasket = () => {
    setItems([]);
    setIsOpen(false);
  };

  const isInBasket = (id: string) => {
    return items.some((i) => i.id === id);
  };

  return (
    <ComparisonContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        clearBasket,
        isInBasket,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const context = useContext(ComparisonContext);
  if (context === undefined) {
    throw new Error('useComparison must be used within a ComparisonProvider');
  }
  return context;
}
