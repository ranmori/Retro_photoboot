import React from 'react';

interface TapeProps {
  className?: string;
  variant?: 'top' | 'corner' | 'bottom';
}

export const Tape: React.FC<TapeProps> = ({ className = '', variant = 'top' }) => {
  const rotation = variant === 'corner' ? '-rotate-45' : variant === 'bottom' ? 'rotate-1' : '-rotate-2';
  
  return (
    <div 
      className={`absolute z-20 h-8 w-24 bg-white/40 backdrop-blur-sm border-l border-r border-white/20 shadow-sm ${rotation} ${className}`}
      style={{
        backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)',
        backgroundSize: '4px 4px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
      }}
    />
  );
};
