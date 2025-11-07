import { useEffect } from 'react';

const useScrollLock = (isLocked: boolean) => {
  useEffect(() => {
    if (isLocked) {
      // Lock scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Unlock scroll
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to ensure scroll is unlocked when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isLocked]);
};

export default useScrollLock;
