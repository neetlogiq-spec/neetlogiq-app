import { useEffect } from 'react';

export const useBodyScrollLock = (isLocked: boolean) => {
  useEffect(() => {
    if (isLocked) {
      // Store the current scroll position
      const scrollY = window.scrollY;
      
      // Lock the body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore scroll position
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isLocked]);
};
