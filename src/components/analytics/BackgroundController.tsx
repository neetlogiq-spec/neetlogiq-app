'use client';

import { motion } from 'framer-motion';

export type BackgroundSentiment = 'neutral' | 'optimistic' | 'cautious' | 'ambitious';

interface BackgroundControllerProps {
  sentiment: BackgroundSentiment;
}

const variants = {
  neutral: { 
    background1: "rgba(96, 165, 250, 0.1)", // blue-400
    background2: "rgba(192, 132, 252, 0.1)"  // purple-400
  },
  optimistic: { 
    background1: "rgba(34, 197, 94, 0.1)",   // green-500
    background2: "rgba(56, 189, 248, 0.1)"   // sky-400
  },
  cautious: { 
    background1: "rgba(250, 204, 21, 0.1)",  // yellow-400
    background2: "rgba(244, 63, 94, 0.1)"    // rose-500
  },
  ambitious: { 
    background1: "rgba(249, 115, 22, 0.15)", // orange-500
    background2: "rgba(168, 85, 247, 0.15)"  // purple-500
  }
};

export function BackgroundController({ sentiment }: BackgroundControllerProps) {
  const currentVariant = variants[sentiment];

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <motion.div
        animate={{ backgroundColor: currentVariant.background1 }}
        transition={{ duration: 2, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px]"
      />
      <motion.div
        animate={{ backgroundColor: currentVariant.background2 }}
        transition={{ duration: 2, ease: "easeInOut", delay: 0.5 }}
        className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px]"
      />
      
      {/* Floating Particles for texture (optional, minimal) */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07]" 
           style={{ backgroundImage: 'url("/noise.png")' }} // Assuming a noise texture exists or just purely use CSS noise later if needed
      /> 
    </div>
  );
}
