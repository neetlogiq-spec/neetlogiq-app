'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Search, Sparkles, GraduationCap } from 'lucide-react';
import { usePremium } from '@/contexts/PremiumContext';

interface HeroSectionProps {
  userName?: string;
  hasRank?: boolean;
  hasPreferences?: boolean;
}

export default function HeroSection({ 
  userName = 'Student', 
  hasRank = false, 
  hasPreferences = false 
}: HeroSectionProps) {
  const { isPremium } = usePremium();
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-blue-900 dark:to-indigo-900 text-white shadow-xl"
    >
      {/* Background decorative elements */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 rounded-full bg-purple-500/20 blur-2xl"></div>

      <div className="relative z-10 p-8 md:p-10">
        <div className="max-w-3xl">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center space-x-2 mb-2 text-blue-100"
          >
            {isPremium ? (
              <>
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium uppercase tracking-wider">Premium Dashboard</span>
              </>
            ) : (
              <>
                <GraduationCap className="w-4 h-4" />
                <span className="text-sm font-medium uppercase tracking-wider">Student Dashboard</span>
              </>
            )}
          </motion.div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {getGreeting()}, <span className="text-blue-200">{userName}</span>.
          </h1>
          
          <p className="text-lg text-blue-100 mb-8 max-w-xl leading-relaxed">
            {!hasRank 
              ? "Ready to find your dream college? Enter your rank to get personalized admission probabilities and cutoff predictions."
              : "Explore the latest cutoffs and track your admission chances. We've updated the data with the latest counselling rounds."
            }
          </p>

          <div className="flex flex-wrap gap-4">
            {!hasRank ? (
              <Link href="/rank-tracking" className="group">
                <button className="flex items-center px-6 py-3 bg-white text-blue-700 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all transform hover:-translate-y-0.5">
                  <Search className="w-5 h-5 mr-2" />
                  Enter Your Rank
                  <ArrowRight className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                </button>
              </Link>
            ) : (
              <Link href="/colleges" className="group">
                <button className="flex items-center px-6 py-3 bg-white text-blue-700 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all transform hover:-translate-y-0.5">
                  <Search className="w-5 h-5 mr-2" />
                  Explore Colleges
                  <ArrowRight className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                </button>
              </Link>
            )}
            
            <Link href="/counselling/resources">
              <button className="flex items-center px-6 py-3 bg-blue-800/40 hover:bg-blue-800/60 text-white rounded-xl font-medium backdrop-blur-sm border border-white/10 transition-all">
                Counselling Resources
              </button>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
