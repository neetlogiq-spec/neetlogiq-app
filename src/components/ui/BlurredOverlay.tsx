'use client';

import React from 'react';

interface BlurredOverlayProps {
  children: React.ReactNode;
  className?: string;
}

const BlurredOverlay: React.FC<BlurredOverlayProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`relative ${className}`}>
      {children}
    </div>
  );
};

export default BlurredOverlay;
