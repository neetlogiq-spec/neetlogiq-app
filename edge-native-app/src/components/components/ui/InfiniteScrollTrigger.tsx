'use client';

import React, { useEffect, useRef, useCallback } from 'react';

interface InfiniteScrollTriggerProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  threshold?: number;
  rootMargin?: string;
  children?: React.ReactNode;
}

const InfiniteScrollTrigger: React.FC<InfiniteScrollTriggerProps> = ({
  onLoadMore,
  hasMore,
  isLoading,
  threshold = 0.8,
  rootMargin = '200px',
  children
}) => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoading) {
        onLoadMore();
      }
    },
    [hasMore, isLoading, onLoadMore]
  );

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin,
    });

    if (triggerRef.current) {
      observerRef.current.observe(triggerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersection, threshold, rootMargin]);

  return (
    <div ref={triggerRef} className="w-full">
      {children}
    </div>
  );
};

export default InfiniteScrollTrigger;