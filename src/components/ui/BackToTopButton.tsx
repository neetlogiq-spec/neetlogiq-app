'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp } from 'lucide-react';

const BackToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let scrollContainer: HTMLElement | null = null;
    
    const toggleVisibility = (scrollTop: number) => {
      setIsVisible(scrollTop > 300);
    };

    // Universal scroll handler - works for any scroll target
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      
      // Check if this is the main scroll container
      if (target.id === 'main-scroll-container') {
        scrollContainer = target;
        toggleVisibility(target.scrollTop);
      } else if (target === document || target === document.documentElement) {
        toggleVisibility(window.scrollY || document.documentElement.scrollTop);
      }
    };

    // Use capture:true to catch scroll events from ANY element, including dynamically created ones
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  const scrollToTop = () => {
    // Try to find and scroll the main container
    const container = document.getElementById('main-scroll-container');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Show with smooth transition based on scroll
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: isVisible ? 1 : 0, 
        scale: isVisible ? 1 : 0.8,
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onClick={scrollToTop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-8 right-8 z-9999 h-12 rounded-full shadow-lg 
        transition-all duration-300 ease-out overflow-hidden
        bg-blue-500 hover:bg-blue-600 
        shadow-[0_0_0_4px_rgba(59,130,246,0.25)]
        hover:shadow-[0_0_0_4px_rgba(37,99,235,0.35)]
        flex items-center justify-center"
      style={{ width: isHovered ? '140px' : '48px' }}
      aria-label="Back to top"
    >
      <ChevronUp 
        className={`w-5 h-5 text-white transition-all duration-300 absolute
          ${isHovered ? 'opacity-0 -translate-y-8' : 'opacity-100'}`}
      />
      <span 
        className={`text-white text-sm font-medium whitespace-nowrap transition-all duration-300
          ${isHovered ? 'opacity-100' : 'opacity-0 translate-y-4'}`}
      >
        Back to Top
      </span>
    </motion.button>
  );
};

export default BackToTopButton;
