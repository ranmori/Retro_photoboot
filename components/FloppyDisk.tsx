import React from 'react';

interface FloppyProps {
  color?: string; // 'pink' or 'purple'
  className?: string;
  onClick?: () => void;
  label?: string;
}

export const FloppyDisk: React.FC<FloppyProps> = ({ color = 'pink', className = '', onClick, label }) => {
  const baseColor = color === 'pink' ? 'bg-pink-400' : 'bg-purple-600';
  const darkerColor = color === 'pink' ? 'bg-pink-600' : 'bg-purple-800';

  return (
    <button 
      onClick={onClick}
      className={`group relative w-32 h-32 transition-transform hover:scale-105 active:scale-95 ${className}`}
      title={label || "Save"}
    >
      {/* Main Body */}
      <div className={`absolute inset-0 ${baseColor} rounded-md shadow-xl border-b-4 border-r-4 border-black/20`}></div>
      
      {/* Shutter (Metal part) */}
      <div className="absolute top-0 left-4 right-4 h-12 bg-gray-300 rounded-b-sm shadow-inner flex items-center justify-center">
         <div className="w-6 h-8 bg-gray-800 rounded-sm opacity-80"></div>
      </div>

      {/* Label Area */}
      <div className="absolute top-14 left-2 right-2 bottom-2 bg-gray-100/90 rounded-sm flex flex-col items-center justify-center p-2 shadow-inner transform rotate-180 group-hover:rotate-0 transition-all duration-500">
         {/* Lines on label */}
         <div className="w-full h-px bg-blue-200 mb-1"></div>
         <div className="w-full h-px bg-blue-200 mb-1"></div>
         <div className="w-full h-px bg-blue-200 mb-2"></div>
         <span className="font-typewriter text-xs text-gray-800 font-bold rotate-180 group-hover:rotate-0 transition-all duration-500">{label || "SAVE.JPG"}</span>
      </div>
      
      {/* Write Protect Tab */}
      <div className="absolute bottom-2 left-2 w-3 h-3 bg-black/80 rounded-sm"></div>
      <div className="absolute bottom-2 right-2 w-3 h-3 bg-black/10 rounded-sm"></div>
    </button>
  );
};
