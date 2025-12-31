'use client';

import { useComparison } from '@/contexts/ComparisonContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function ComparisonDrawer() {
  const { items, removeItem, clearBasket, isOpen, setIsOpen } = useComparison();

  if (items.length === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4"
        >
          <div className="bg-slate-900/90 dark:bg-white/90 backdrop-blur-xl border border-white/10 dark:border-slate-200 text-white dark:text-slate-900 p-4 rounded-3xl shadow-2xl flex items-center justify-between gap-4 ring-1 ring-white/10 dark:ring-black/5">
            
            {/* Left: Indicator */}
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                  <span className="font-bold text-white">{items.length}</span>
               </div>
               <div className="hidden sm:block">
                  <h4 className="font-semibold text-sm">Comparison Basket</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{items.length} / 4 items selected</p>
               </div>
            </div>

            {/* Middle: Tiny Previews */}
            <div className="flex -space-x-2 overflow-hidden mx-auto">
                {items.map((item) => (
                    <div key={item.id} className="relative group">
                         <div className="w-8 h-8 rounded-full bg-slate-800 dark:bg-slate-200 border-2 border-slate-900 dark:border-white flex items-center justify-center text-[10px] font-bold tracking-tight uppercase" title={item.collegeName}>
                            {item.collegeName.substring(0, 2)}
                         </div>
                         <button 
                            onClick={() => removeItem(item.id)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                         >
                            <X className="w-2 h-2" />
                         </button>
                    </div>
                ))}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
               <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-white dark:text-slate-500 dark:hover:text-slate-900 h-8 w-8 p-0 rounded-full"
                >
                  <X className="w-4 h-4" />
               </Button>
               <Button size="sm" className="bg-white text-slate-900 hover:bg-slate-100 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800 rounded-full px-4 h-9">
                  Compare <ArrowRight className="w-4 h-4 ml-1.5" />
               </Button>
            </div>

          </div>
        </motion.div>
      )}
      
      {/* Floating Toggle if Closed but items exist */}
      {!isOpen && items.length > 0 && (
         <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center hover:scale-110 transition-transform"
         >
            <Layers className="w-6 h-6" />
            <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-red-500 border-2 border-slate-950">{items.length}</Badge>
         </motion.button>
      )}
    </AnimatePresence>
  );
}
