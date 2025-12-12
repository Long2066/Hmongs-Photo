
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UploadIcon, XCircleIcon } from './Icons';

export interface ImageState {
  base64: string;
  mimeType: string;
  id: number;
  fileName?: string; // Added fileName
}

interface ImageUploaderProps {
  onImagesChange: (images: ImageState[]) => void;
  maxImages?: number;
  label?: string;
  compact?: boolean; // New prop for grid layout
}

const UploaderSlot: React.FC<{ onClick: () => void, isDragging: boolean, compact?: boolean }> = ({ onClick, isDragging, compact }) => (
  <div
    onClick={onClick}
    className={`relative flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 group
        ${compact ? 'p-1' : 'p-2'}
        ${isDragging ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 hover:shadow-md'}`}
  >
    <div className="flex flex-col items-center justify-center text-center">
      <div className={`rounded-full mb-1 transition-colors ${compact ? 'p-1.5' : 'p-3'} ${isDragging ? 'bg-indigo-100' : 'bg-slate-100 group-hover:bg-indigo-50'}`}>
        <UploadIcon className={`transition-colors ${compact ? 'w-3 h-3' : 'w-5 h-5'} ${isDragging ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} />
      </div>
      {!compact && <p className="font-bold text-[10px] text-slate-500 uppercase tracking-wide group-hover:text-indigo-600 transition-colors">Thêm ảnh</p>}
    </div>
  </div>
);

const ImagePreviewSlot: React.FC<{
  src: string,
  isSelected: boolean,
  onToggle: () => void,
  onClear: () => void
}> = ({ src, isSelected, onToggle, onClear }) => (
  <div
    className={`relative w-full aspect-square rounded-xl overflow-hidden group shadow-sm transition-all duration-300 cursor-pointer
    ${isSelected ? 'ring-2 ring-indigo-600 ring-offset-2' : 'border border-slate-200 hover:shadow-lg hover:-translate-y-0.5'}`}
    onClick={onToggle}
  >
    <img src={src} alt="Preview" className="w-full h-full object-cover" />

    <div className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center transition-all shadow-sm
        ${isSelected ? 'bg-indigo-600 text-white' : 'bg-white/80 text-transparent border border-white backdrop-blur-sm'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    </div>

    <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
      <button
        onClick={(e) => { e.stopPropagation(); onClear(); }}
        className="p-1.5 bg-white text-red-500 rounded-full hover:bg-red-50 transition-colors shadow-lg transform scale-90 group-hover:scale-100"
      >
        <XCircleIcon className="w-4 h-4" />
      </button>
    </div>
  </div>
);

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesChange, maxImages = 4, label = "Ảnh tham khảo", compact = false }) => {
  const [images, setImages] = useState<ImageState[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (images.length > maxImages) {
      const keptImages = images.slice(0, maxImages);
      setImages(keptImages);
      const newSet = new Set<number>();
      keptImages.forEach(img => {
        if (selectedIds.has(img.id)) newSet.add(img.id);
      });
      setSelectedIds(newSet);
    }
  }, [maxImages, images, selectedIds]);

  // Use a ref to access the latest callback without triggering the effect
  const onImagesChangeRef = useRef(onImagesChange);

  useEffect(() => {
    onImagesChangeRef.current = onImagesChange;
  }, [onImagesChange]);

  useEffect(() => {
    const selectedImages = images
      .filter(img => selectedIds.has(img.id));
    onImagesChangeRef.current(selectedImages);
  }, [images, selectedIds]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      alert(`Mục này chỉ cho phép tối đa ${maxImages} ảnh.`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    if (filesToProcess.length === 0) return;

    const readPromises = filesToProcess
      .filter(file => file.type.startsWith('image/'))
      .map(file => new Promise<ImageState>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const cleanName = file.name.replace(/\.[^/.]+$/, "");
            resolve({
              base64: reader.result.split(',')[1],
              mimeType: file.type,
              id: Date.now() + Math.random(),
              fileName: cleanName
            });
          } else {
            reject(new Error('Read failed'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }));

    Promise.all(readPromises).then(newImages => {
      setImages(prev => {
        const updated = [...prev, ...newImages];
        const newIds = new Set(selectedIds);
        newImages.forEach(img => newIds.add(img.id));
        setSelectedIds(newIds);
        return updated;
      });
    });

  }, [images.length, selectedIds, maxImages]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleClear = (id: number) => {
    setImages(prev => prev.filter(img => img.id !== id));
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="w-full select-none"
    >
      <div className="flex justify-between items-center mb-1.5 px-1">
        <span className={`font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          {label}
        </span>
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-medium ${images.length === maxImages ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
          {images.length}/{maxImages}
        </span>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
        accept="image/*"
        multiple={maxImages > 1}
      />
      <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {images.map(image => (
          <ImagePreviewSlot
            key={image.id}
            src={`data:${image.mimeType};base64,${image.base64}`}
            isSelected={selectedIds.has(image.id)}
            onToggle={() => toggleSelection(image.id)}
            onClear={() => handleClear(image.id)}
          />
        ))}
        {images.length < maxImages && (
          <UploaderSlot onClick={() => fileInputRef.current?.click()} isDragging={isDragging} compact={compact} />
        )}
      </div>
    </div>
  );
};
