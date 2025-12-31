'use client';

import { Button } from '@/components/ui/button';
import { useComparison, ComparisonItem } from '@/contexts/ComparisonContext';
import { Plus, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface CompareButtonProps {
  item: ComparisonItem;
  className?: string;
  variant?: 'icon' | 'full';
}

export function CompareButton({ item, className, variant = 'icon' }: CompareButtonProps) {
  const { addItem, removeItem, isInBasket, items } = useComparison();
  const isSelected = isInBasket(item.id);
  const [loading, setLoading] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    
    // Simulate tiny delay for "haptic" feel
    setTimeout(() => {
        if (isSelected) {
            removeItem(item.id);
        } else {
            addItem(item);
        }
        setLoading(false);
    }, 200);
  };

  const isFull = items.length >= 4 && !isSelected;

  if (variant === 'full') {
     return (
        <Button
          variant={isSelected ? "secondary" : "outline"}
          size="sm"
          className={cn(
             "gap-2 transition-all duration-300",
             isSelected ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800" : "",
             className
          )}
          onClick={handleClick}
          disabled={isFull || loading}
        >
           {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
           {isSelected ? "Added" : "Compare"}
        </Button>
     )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8 rounded-full transition-all duration-300",
        isSelected 
            ? "bg-blue-500 text-white hover:bg-blue-600 hover:text-white" 
            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
        className
      )}
      onClick={handleClick}
      disabled={isFull || loading}
      title={isFull ? "Basket full (max 4)" : isSelected ? "Remove from comparison" : "Add to comparison"}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
    </Button>
  );
}
