
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UploadIcon, XCircleIcon } from './Icons';
import { optimizeFileForUpload } from '../services/imageOptimizer';

export interface ImageState {
  base64: string;
  mimeType: string;
  id: number;
  fileName?: string;
}

interface ImageUploaderProps {
  onImagesChange: (images: ImageState[]) => void;
  maxImages?: number;
  label?: string;
  compact?: boolean;
}

const UploaderSlot: React.FC<{ onClick: () => void, isDragging: boolean, compact?: boolean }> = ({ onClick, isDragging, compact }) => (
  <div
    onClick={onClick}
    className={`relative flex flex-col items-center justify-center w-full border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 group overflow-hidden
        ${compact ? 'aspect-square p-2' : 'aspect-square p-4'}
        ${isDragging
        ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 scale-[1.02] shadow-lg shadow-indigo-200'
        : 'border-slate-200/60 bg-gradient-to-br from-slate-50/80 to-white hover:border-indigo-400 hover:from-indigo-50/50 hover:to-purple-50/50 hover:shadow-xl hover:shadow-indigo-100/50 hover:scale-[1.01]'
      }`}
  >
    {/* Animated gradient border effect */}
    <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none
      ${isDragging ? 'opacity-100' : ''}`}>
      <div className="absolute inset-[-2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl opacity-20 animate-gradient-x"></div>
    </div>

    {/* Inner content */}
    <div className="relative flex flex-col items-center justify-center text-center z-10">
      <div className={`rounded-2xl mb-2 transition-all duration-300 backdrop-blur-sm
        ${compact ? 'p-3' : 'p-4'} 
        ${isDragging
          ? 'bg-gradient-to-br from-indigo-100 to-purple-100 shadow-lg scale-110'
          : 'bg-gradient-to-br from-slate-100 to-white group-hover:from-indigo-100 group-hover:to-purple-100 group-hover:shadow-md group-hover:scale-105'
        }`}>
        <UploadIcon className={`transition-all duration-300 ${compact ? 'w-6 h-6' : 'w-8 h-8'} 
          ${isDragging ? 'text-indigo-600 animate-bounce' : 'text-slate-400 group-hover:text-indigo-500'}`} />
      </div>
      {!compact && (
        <>
          <p className="font-bold text-sm text-slate-600 group-hover:text-indigo-600 transition-colors mb-1">
            Kéo thả ảnh vào đây
          </p>
          <p className="text-[10px] text-slate-400 group-hover:text-indigo-400 transition-colors">
            hoặc nhấn để chọn file
          </p>
        </>
      )}
      {compact && (
        <p className="font-bold text-[9px] text-slate-500 uppercase tracking-wide group-hover:text-indigo-600 transition-colors">
          Thêm ảnh
        </p>
      )}
    </div>

    {/* Sparkle effects on hover */}
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
      <span className="text-lg animate-pulse">✨</span>
    </div>
  </div>
);

const ImagePreviewSlot: React.FC<{
  src: string,
  fileName?: string,
  isSelected: boolean,
  onToggle: () => void,
  onClear: () => void,
  index: number
}> = ({ src, fileName, isSelected, onToggle, onClear, index }) => (
  <div
    className={`relative w-full aspect-square rounded-2xl overflow-hidden group shadow-lg transition-all duration-300 cursor-pointer
      ${isSelected
        ? 'ring-3 ring-indigo-500 ring-offset-2 shadow-xl shadow-indigo-200/50 scale-[1.02]'
        : 'ring-1 ring-slate-200/50 hover:shadow-2xl hover:shadow-indigo-100/50 hover:scale-[1.02]'
      }`}
    onClick={onToggle}
    style={{ animationDelay: `${index * 100}ms` }}
  >
    {/* Image with gradient overlay */}
    <img src={src} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />

    {/* Gradient overlay */}
    <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

    {/* Selection indicator */}
    <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg
        ${isSelected
        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white scale-110'
        : 'bg-white/90 text-transparent border-2 border-slate-200 backdrop-blur-sm group-hover:border-indigo-300'
      }`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    </div>

    {/* File name (if available) */}
    {fileName && (
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <p className="text-white text-[10px] font-medium truncate">{fileName}</p>
      </div>
    )}

    {/* Delete button - appears on hover */}
    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
      <button
        onClick={(e) => { e.stopPropagation(); onClear(); }}
        className="p-2.5 bg-white/95 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all duration-300 shadow-xl transform scale-90 group-hover:scale-100 backdrop-blur-sm"
      >
        <XCircleIcon className="w-5 h-5" />
      </button>
    </div>

    {/* Number badge */}
    <div className="absolute top-2 left-2 w-6 h-6 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
      <span className="text-white text-[10px] font-bold">{index + 1}</span>
    </div>
  </div>
);

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesChange, maxImages = 4, label = "Ảnh tham khảo", compact = false }) => {
  const [images, setImages] = useState<ImageState[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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

  const onImagesChangeRef = useRef(onImagesChange);

  useEffect(() => {
    onImagesChangeRef.current = onImagesChange;
  }, [onImagesChange]);

  useEffect(() => {
    const selectedImages = images.filter(img => selectedIds.has(img.id));
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

    setIsUploading(true);

    const readPromises = filesToProcess
      .filter(file => file.type.startsWith('image/'))
      .map(async file => {
        try {
          const opt = await optimizeFileForUpload(file);
          return {
            base64: opt.base64,
            mimeType: opt.mimeType,
            id: Date.now() + Math.random(),
            fileName: opt.fileName
          } as ImageState;
        } catch {
          return new Promise<ImageState>((resolve, reject) => {
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
          });
        }
      });

    Promise.all(readPromises).then(newImages => {
      setImages(prev => {
        const updated = [...prev, ...newImages];
        const newIds = new Set(selectedIds);
        newImages.forEach(img => newIds.add(img.id));
        setSelectedIds(newIds);
        return updated;
      });
      setIsUploading(false);
    }).catch(() => {
      setIsUploading(false);
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
      {/* Header with label and count */}
      <div className="flex justify-between items-center mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse"></div>
          <span className={`font-bold text-slate-600 uppercase tracking-widest ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
            {label}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-300 ${images.length === maxImages
            ? 'bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 shadow-sm'
            : 'bg-slate-100 text-slate-500'
          }`}>
          <span className={`text-[10px] font-bold`}>{images.length}</span>
          <span className="text-[10px] text-slate-400">/</span>
          <span className="text-[10px] font-medium">{maxImages}</span>
          {isUploading && (
            <svg className="animate-spin h-3 w-3 text-indigo-500 ml-1" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
        accept="image/*"
        multiple={maxImages > 1}
      />

      {/* Grid layout */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : images.length === 0 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {images.map((image, index) => (
          <ImagePreviewSlot
            key={image.id}
            src={`data:${image.mimeType};base64,${image.base64}`}
            fileName={image.fileName}
            isSelected={selectedIds.has(image.id)}
            onToggle={() => toggleSelection(image.id)}
            onClear={() => handleClear(image.id)}
            index={index}
          />
        ))}
        {images.length < maxImages && (
          <UploaderSlot
            onClick={() => fileInputRef.current?.click()}
            isDragging={isDragging}
            compact={compact || images.length > 0}
          />
        )}
      </div>

      {/* Helper text */}
      {images.length === 0 && !compact && (
        <p className="text-center text-[10px] text-slate-400 mt-3">
          Hỗ trợ: JPG, PNG, WEBP • Tối đa {maxImages} ảnh
        </p>
      )}
    </div>
  );
};
