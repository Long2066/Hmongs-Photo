
import React from 'react';

interface AvatarProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md';
}

export const Avatar: React.FC<AvatarProps> = ({ src, alt, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-12 h-12';
  return (
    <div className={`relative ${sizeClasses}`}>
      <img
        src={src}
        alt={alt}
        className="rounded-full w-full h-full object-cover"
      />
    </div>
  );
};
