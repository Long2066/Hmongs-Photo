import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { UploadIcon, XCircleIcon } from './Icons';
import { optimizeFileForUpload } from '../services/imageOptimizer';

export interface ImageState {
  base64: string;
  mimeType: string;
  id: number;
  fileName?: string;
  previewUrl?: string;
}

interface ImageUploaderProps {
  onImagesChange: (images: ImageState[]) => void;
  maxImages?: number;
  label?: string;
  compact?: boolean;
}

const UploaderSlot: React.FC<{ onClick: () => void, isDragging: boolean, compact?: boolean }> = memo(({ onClick, isDragging, compact }) => (
  <div
    onClick={onClick}
    className={`relative flex flex-col items-center justify-center w-full border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 group overflow-hidden
        ${compact ? 'aspect-square p-2' : 'aspect-square p-4'}
        ${isDragging
        ? 'border-indigo-600 bg-indigo-50/60 scale-[1.01] shadow-xs'
        : 'border-slate-300 bg-white hover:border-indigo-500 hover:bg-slate-50 shadow-xs'
      }`}
  >
    {/* Inner content */}
    <div className="relative flex flex-col items-center justify-center text-center z-10">
      <div className={`rounded-xl mb-1.5 transition-all duration-200
        ${compact ? 'p-2' : 'p-3'} 
        ${isDragging
          ? 'bg-indigo-100 text-indigo-700'
          : 'bg-slate-100 group-hover:bg-indigo-50 text-slate-600 group-hover:text-indigo-600'
        }`}>
        <UploadIcon className={`${compact ? 'w-5 h-5' : 'w-7 h-7'}`} />
      </div>
      {!compact && (
        <>
          <p className="font-bold text-xs text-slate-800 group-hover:text-indigo-600 transition-colors mb-0.5">
            Kéo thả ảnh vào đây
          </p>
          <p className="text-[10px] text-slate-500 font-medium group-hover:text-slate-700 transition-colors">
            hoặc nhấn để chọn file
          </p>
        </>
      )}
      {compact && (
        <p className="font-bold text-[10px] text-slate-700 uppercase tracking-wide group-hover:text-indigo-600 transition-colors">
          Thêm ảnh
        </p>
      )}
    </div>
  </div>
));

UploaderSlot.displayName = 'UploaderSlot';

const ImagePreviewSlot: React.FC<{
  src: string,
  fileName?: string,
  isSelected: boolean,
  onToggle: () => void,
  onClear: () => void,
  index: number
}> = memo(({ src, fileName, isSelected, onToggle, onClear, index }) => (
  <div
    className={`relative w-full aspect-square rounded-2xl overflow-hidden group shadow-xs transition-all duration-200 cursor-pointer
      ${isSelected
        ? 'ring-2 ring-indigo-600 ring-offset-2 shadow-sm'
        : 'ring-1 ring-slate-300 hover:ring-indigo-400'
      }`}
    onClick={onToggle}
  >
    {/* Image with gradient overlay - fast async decoding */}
    <img
      src={src}
      alt="Preview"
      loading="lazy"
      decoding="async"
      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
    />

    {/* Gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>

    {/* Selection indicator */}
    <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 shadow-md
        ${isSelected
        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white scale-105'
        : 'bg-white/90 text-transparent border-2 border-slate-200 backdrop-blur-xs group-hover:border-indigo-300'
      }`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    </div>

    {/* File name (if available) */}
    {fileName && (
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <p className="text-white text-[10px] font-medium truncate">{fileName}</p>
      </div>
    )}

    {/* Delete button - appears on hover */}
    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
      <button
        onClick={(e) => { e.stopPropagation(); onClear(); }}
        className="p-2.5 bg-white/95 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all duration-200 shadow-xl transform scale-90 group-hover:scale-100"
      >
        <XCircleIcon className="w-5 h-5" />
      </button>
    </div>

    {/* Number badge */}
    <div className="absolute top-2 left-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
      <span className="text-white text-[10px] font-bold">{index + 1}</span>
    </div>
  </div>
));

ImagePreviewSlot.displayName = 'ImagePreviewSlot';

export const ImageUploader: React.FC<ImageUploaderProps> = memo(({ onImagesChange, maxImages = 4, label = "Ảnh tham khảo", compact = false }) => {
  const [images, setImages] = useState<ImageState[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enforce maxImages limit
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
  }, [maxImages, images.length, selectedIds]);

  const onImagesChangeRef = useRef(onImagesChange);
  useEffect(() => {
    onImagesChangeRef.current = onImagesChange;
  }, [onImagesChange]);

  // Synchronize selected images to parent
  useEffect(() => {
    const selectedImages = images.filter(img => selectedIds.has(img.id));
    onImagesChangeRef.current(selectedImages);
  }, [images, selectedIds]);

  // Clean, non-blocking file processing
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      alert(`Mục này chỉ cho phép tối đa ${maxImages} ảnh.`);
      return;
    }

    const filesToProcess = Array.from(files)
      .filter(file => file.type.startsWith('image/'))
      .slice(0, remainingSlots);

    if (filesToProcess.length === 0) return;

    setIsUploading(true);

    // Yield to the browser main thread to immediately render the uploading state
    await new Promise(resolve => setTimeout(resolve, 20));

    try {
      const processedImages: ImageState[] = [];

      for (const file of filesToProcess) {
        try {
          const opt = await optimizeFileForUpload(file);
          processedImages.push({
            base64: opt.base64,
            mimeType: opt.mimeType,
            id: Date.now() + Math.random(),
            fileName: opt.fileName,
            previewUrl: opt.previewUrl
          });
        } catch (err) {
          console.warn('[ImageUploader] Failed to optimize image, fallback to raw FileReader:', err);
          // Fallback only if all optimization methods fail
          const rawResult = await new Promise<ImageState>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                const cleanName = file.name.replace(/\.[^/.]+$/, '');
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
          processedImages.push(rawResult);
        }
      }

      if (processedImages.length > 0) {
        setSelectedIds(prev => {
          const next = new Set(prev);
          processedImages.forEach(img => next.add(img.id));
          return next;
        });
        setImages(prev => [...prev, ...processedImages]);
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [images.length, maxImages]);

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

  const handleClear = useCallback((id: number) => {
    setImages(prev => {
      const target = prev.find(img => img.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(img => img.id !== id);
    });
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="w-full select-none"
    >
      {/* Header with label and count */}
      <div className="flex justify-between items-center mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
          <span className={`font-bold text-slate-800 uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {label}
          </span>
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[10px] font-bold ${images.length === maxImages
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs'
            : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}>
          <span>{images.length}</span>
          <span className="text-slate-400">/</span>
          <span>{maxImages}</span>
          {isUploading && (
            <svg className="animate-spin h-3 w-3 text-indigo-600 ml-1" viewBox="0 0 24 24">
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
            src={image.previewUrl || `data:${image.mimeType};base64,${image.base64}`}
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
});

ImageUploader.displayName = 'ImageUploader';
