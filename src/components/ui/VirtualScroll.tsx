'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // Number of items to render outside the visible area
  className?: string;
  isDarkMode?: boolean;
}

interface ScrollPosition {
  scrollTop: number;
  isScrolling: boolean;
  direction: 'up' | 'down' | null;
}

const VirtualScroll = <T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  isDarkMode = false
}: VirtualScrollProps<T>) => {
  const [scrollPosition, setScrollPosition] = useState<ScrollPosition>({
    scrollTop: 0,
    isScrolling: false,
    direction: null
  });
  
  const [containerSize, setContainerSize] = useState({ width: 0, height: containerHeight });
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTopRef = useRef(0);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const { scrollTop } = scrollPosition;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerSize.height) / itemHeight) + overscan
    );
    
    return { startIndex, endIndex };
  }, [scrollPosition.scrollTop, itemHeight, containerSize.height, overscan, items.length]);

  // Calculate total height
  const totalHeight = useMemo(() => {
    return items.length * itemHeight;
  }, [items.length, itemHeight]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const scrollTop = containerRef.current.scrollTop;
    const direction = scrollTop > lastScrollTopRef.current ? 'down' : 'up';
    
    lastScrollTopRef.current = scrollTop;
    
    setScrollPosition({
      scrollTop,
      isScrolling: true,
      direction
    });
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Set a timeout to detect when scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      setScrollPosition(prev => ({ ...prev, isScrolling: false, direction: null }));
    }, 150);
  }, []);

  // Update container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    updateSize();
    
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Render visible items
  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    const itemsToRender = [];
    
    for (let i = startIndex; i <= endIndex; i++) {
      if (i < items.length) {
        itemsToRender.push({
          item: items[i],
          index: i,
          top: i * itemHeight
        });
      }
    }
    
    return itemsToRender;
  }, [visibleRange, items, itemHeight]);

  // Scroll to item
  const scrollToItem = useCallback((index: number, alignment: 'start' | 'center' | 'end' = 'start') => {
    if (!containerRef.current || index < 0 || index >= items.length) return;
    
    let scrollTop: number;
    
    switch (alignment) {
      case 'center':
        scrollTop = index * itemHeight - containerSize.height / 2 + itemHeight / 2;
        break;
      case 'end':
        scrollTop = index * itemHeight - containerSize.height + itemHeight;
        break;
      case 'start':
      default:
        scrollTop = index * itemHeight;
        break;
    }
    
    // Ensure scroll position is within bounds
    scrollTop = Math.max(0, Math.min(scrollTop, totalHeight - containerSize.height));
    
    containerRef.current.scrollTop = scrollTop;
  }, [items.length, itemHeight, containerSize.height, totalHeight]);

  // Scroll to top or bottom
  const scrollToTop = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = totalHeight - containerSize.height;
    }
  }, [totalHeight, containerSize.height]);

  return (
    <div className={`relative ${className}`}>
      {/* Scroll indicators */}
      {scrollPosition.scrollTop > 0 && (
        <button
          onClick={scrollToTop}
          className={`absolute top-2 right-2 z-10 p-2 rounded-full shadow-lg transition-all ${
            isDarkMode 
              ? 'bg-gray-800 text-white hover:bg-gray-700' 
              : 'bg-white text-gray-800 hover:bg-gray-100'
          }`}
          aria-label="Scroll to top"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      )}
      
      {scrollPosition.scrollTop < totalHeight - containerSize.height && (
        <button
          onClick={scrollToBottom}
          className={`absolute bottom-2 right-2 z-10 p-2 rounded-full shadow-lg transition-all ${
            isDarkMode 
              ? 'bg-gray-800 text-white hover:bg-gray-700' 
              : 'bg-white text-gray-800 hover:bg-gray-100'
          }`}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
      
      {/* Virtual scroll container */}
      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        {/* Spacer to create total height */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Visible items */}
          {visibleItems.map(({ item, index, top }) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                top,
                left: 0,
                right: 0,
                height: itemHeight
              }}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
      
      {/* Scroll position indicator */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
        <div
          className={`h-full transition-all ${isDarkMode ? 'bg-blue-500' : 'bg-blue-600'}`}
          style={{
            width: `${(scrollPosition.scrollTop / (totalHeight - containerSize.height)) * 100}%`
          }}
        />
      </div>
    </div>
  );
};

export default VirtualScroll;
