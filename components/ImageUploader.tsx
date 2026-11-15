import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { UploadIcon, XCircleIcon } from './Icons';
import { optimizeFileForUpload } from '../services/imageOptimizer';
import { naturalCompareFileNames } from '../services/scenePromptUtils';

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

const CloudUploadSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3 3m3-3l3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
  </svg>
);

const UploaderSlot: React.FC<{ onClick: () => void, isDragging: boolean, compact?: boolean }> = memo(({ onClick, isDragging, compact }) => (
  <div
    onClick={onClick}
    className={`relative flex flex-col items-center justify-center w-full border-[1.5px] border-dashed rounded-2xl cursor-pointer transition-all duration-200 group overflow-hidden min-h-[44px]
        ${compact ? 'aspect-square p-2.5' : 'aspect-square p-4'}
        ${isDragging
        ? 'border-violet-600 bg-violet-50/80 scale-[1.01] shadow-sm'
        : 'border-indigo-200/90 bg-[#fbfaff] hover:border-violet-400 hover:bg-violet-50/50 shadow-[0_1px_4px_rgba(99,102,241,0.04)]'
      }`}
  >
    {/* Inner content */}
    <div className="relative flex flex-col items-center justify-center text-center z-10">
      <div className={`rounded-full border transition-all duration-200 flex items-center justify-center mb-2
        ${compact ? 'w-10 h-10' : 'w-12 h-12'} 
        ${isDragging
          ? 'bg-violet-100 border-violet-300 text-violet-700'
          : 'bg-white border-indigo-100 text-violet-600 group-hover:bg-violet-50 group-hover:border-violet-200 group-hover:scale-105 shadow-2xs'
        }`}>
        <CloudUploadSvg className={`${compact ? 'w-5 h-5' : 'w-6 h-6'}`} />
      </div>
      {!compact && (
        <>
          <p className="font-bold text-xs text-slate-800 group-hover:text-violet-700 transition-colors mb-0.5">
            Kéo thả ảnh vào đây
          </p>
          <p className="text-[10px] text-slate-500 font-medium group-hover:text-slate-700 transition-colors">
            hoặc nhấn để chọn file
          </p>
        </>
      )}
      {compact && (
        <p className="font-bold text-[10.5px] text-slate-700 uppercase tracking-wider group-hover:text-violet-700 transition-colors">
          THÊM ẢNH
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
  index: number,
  isOrderingMode?: boolean,
  orderPosition?: number,
  canMoveLeft?: boolean,
  canMoveRight?: boolean,
  onMoveLeft?: () => void,
  onMoveRight?: () => void,
  onDragStartItem?: (e: React.DragEvent, index: number) => void,
  onDragOverItem?: (e: React.DragEvent, index: number) => void,
  onDropItem?: (e: React.DragEvent, index: number) => void,
  onDragEndItem?: () => void,
  isDropTarget?: boolean
}> = memo(({
  src,
  fileName,
  isSelected,
  onToggle,
  onClear,
  index,
  isOrderingMode = false,
  orderPosition = 0,
  canMoveLeft = false,
  canMoveRight = false,
  onMoveLeft,
  onMoveRight,
  onDragStartItem,
  onDragOverItem,
  onDropItem,
  onDragEndItem,
  isDropTarget = false
}) => (
  <div
    draggable={!isOrderingMode && !!onDragStartItem}
    onDragStart={(e) => onDragStartItem?.(e, index)}
    onDragOver={(e) => onDragOverItem?.(e, index)}
    onDrop={(e) => onDropItem?.(e, index)}
    onDragEnd={() => onDragEndItem?.()}
    title={isOrderingMode ? 'Nhấn chọn thứ tự phân cảnh' : 'Nhấn để chọn/bỏ, kéo thả hoặc bấm ◀ ▶ để đổi thứ tự'}
    className={`relative w-full aspect-square rounded-2xl overflow-hidden group shadow-xs transition-all duration-200 cursor-pointer
      ${isOrderingMode
        ? orderPosition > 0
          ? 'ring-2 ring-emerald-500 ring-offset-2 shadow-md scale-[0.98]'
          : 'ring-2 ring-dashed ring-indigo-300 hover:ring-indigo-500 opacity-85 hover:opacity-100'
        : isDropTarget
        ? 'ring-2 ring-amber-500 ring-offset-2 scale-[1.02]'
        : isSelected
        ? 'ring-2 ring-indigo-600 ring-offset-2 shadow-sm'
        : 'ring-1 ring-slate-300 opacity-65 hover:opacity-100 hover:ring-indigo-400'
      }`}
    onClick={onToggle}
  >
    {/* Image with gradient overlay - fast async decoding */}
    <img
      src={src}
      alt="Preview"
      loading="lazy"
      decoding="async"
      draggable={false}
      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
    />

    {/* Gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>

    {/* Selection / Order indicator */}
    {isOrderingMode ? (
      <div className={`absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full flex items-center justify-center font-mono text-[11px] font-extrabold tabular-nums transition-all duration-200 shadow-md
        ${orderPosition > 0
          ? 'bg-emerald-500 text-white scale-110'
          : 'bg-white/95 text-slate-400 border border-slate-300'
        }`}>
        {orderPosition > 0 ? orderPosition : '?'}
      </div>
    ) : (
      <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 shadow-md
          ${isSelected
          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white scale-105'
          : 'bg-white text-transparent border-2 border-slate-300 shadow-xs group-hover:border-indigo-300'
        }`}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    )}

    {/* File name (if available) */}
    {fileName && !isOrderingMode && (
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <p className="text-white text-[10px] font-medium truncate">{fileName}</p>
      </div>
    )}

    {/* Quick Move Left/Right + Delete buttons */}
    {!isOrderingMode && (
      <>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="pointer-events-auto p-2 bg-white/95 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all duration-200 shadow-xl transform scale-90 group-hover:scale-100"
            title="Xóa ảnh này"
          >
            <XCircleIcon className="w-4 h-4" />
          </button>
        </div>

        {(canMoveLeft || canMoveRight) && (
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
            <button
              type="button"
              disabled={!canMoveLeft}
              onClick={(e) => { e.stopPropagation(); onMoveLeft?.(); }}
              title="Đẩy lên trước"
              className="pointer-events-auto h-6 w-6 rounded-md bg-slate-900/80 text-white text-[11px] font-bold flex items-center justify-center hover:bg-indigo-600 disabled:opacity-0 cursor-pointer transition-colors"
            >
              ◀
            </button>
            <button
              type="button"
              disabled={!canMoveRight}
              onClick={(e) => { e.stopPropagation(); onMoveRight?.(); }}
              title="Đẩy xuống sau"
              className="pointer-events-auto h-6 w-6 rounded-md bg-slate-900/80 text-white text-[11px] font-bold flex items-center justify-center hover:bg-indigo-600 disabled:opacity-0 cursor-pointer transition-colors"
            >
              ▶
            </button>
          </div>
        )}
      </>
    )}

    {/* Number badge */}
    <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-slate-900/80 backdrop-blur-xs rounded-md flex items-center justify-center shadow-xs border border-white/20">
      <span className="text-white text-[10px] font-bold font-mono tracking-tight tabular-nums">#{index + 1}</span>
    </div>
  </div>
));

ImagePreviewSlot.displayName = 'ImagePreviewSlot';

export const ImageUploader: React.FC<ImageUploaderProps> = memo(({ onImagesChange, maxImages = 4, label = "Ảnh tham khảo", compact = false }) => {
  const [images, setImages] = useState<ImageState[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isOrderingMode, setIsOrderingMode] = useState(false);
  const [clickOrderIds, setClickOrderIds] = useState<number[]>([]);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const dragSourceIndexRef = useRef<number | null>(null);
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

  // Synchronize selected images to parent in exact display order
  useEffect(() => {
    const selectedImages = images.filter(img => selectedIds.has(img.id));
    onImagesChangeRef.current(selectedImages);
  }, [images, selectedIds]);

  // Exit click-ordering mode if fewer than 2 images remain
  useEffect(() => {
    if (images.length <= 1 && isOrderingMode) {
      setIsOrderingMode(false);
      setClickOrderIds([]);
    }
  }, [images.length, isOrderingMode]);

  // Clean, non-blocking file processing with natural filename sorting on batch drops
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      alert(`Mục này chỉ cho phép tối đa ${maxImages} ảnh.`);
      return;
    }

    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (validFiles.length > 1) {
      validFiles.sort((a, b) => naturalCompareFileNames(a.name, b.name));
    }
    const filesToProcess = validFiles.slice(0, remainingSlots);

    if (filesToProcess.length === 0) return;

    setIsUploading(true);

    // Yield to the browser main thread to immediately render the uploading state
    await new Promise(resolve => setTimeout(resolve, 20));

    try {
      const processedImages: ImageState[] = [];
      const baseTs = Date.now();

      for (let idx = 0; idx < filesToProcess.length; idx++) {
        const file = filesToProcess[idx];
        const uniqueId = baseTs + idx * 0.001 + Math.random() * 0.0001;
        try {
          const opt = await optimizeFileForUpload(file);
          processedImages.push({
            base64: opt.base64,
            mimeType: opt.mimeType,
            id: uniqueId,
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
                  id: uniqueId,
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

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (dragSourceIndexRef.current !== null || !e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (dragSourceIndexRef.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (dragSourceIndexRef.current !== null) {
      dragSourceIndexRef.current = null;
      setDragSourceIndex(null);
      setDropTargetIndex(null);
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleDragStartItem = useCallback((e: React.DragEvent, index: number) => {
    dragSourceIndexRef.current = index;
    setDragSourceIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(index));
    } catch {}
  }, []);

  const handleDragOverItem = useCallback((e: React.DragEvent, index: number) => {
    if (dragSourceIndexRef.current === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetIndex(prev => (prev === index ? prev : index));
  }, []);

  const handleDropItem = useCallback((e: React.DragEvent, targetIndex: number) => {
    const fromIndex = dragSourceIndexRef.current;
    if (fromIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    dragSourceIndexRef.current = null;
    setDragSourceIndex(null);
    setDropTargetIndex(null);
    if (fromIndex === targetIndex) return;
    setImages(prev => {
      if (fromIndex < 0 || fromIndex >= prev.length || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }, []);

  const handleDragEndItem = useCallback(() => {
    dragSourceIndexRef.current = null;
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  }, []);

  const handleMoveItem = useCallback((index: number, delta: number) => {
    setImages(prev => {
      const targetIndex = index + delta;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }, []);

  const handleNaturalSort = useCallback(() => {
    setImages(prev => [...prev].sort((a, b) => naturalCompareFileNames(a.fileName || '', b.fileName || '')));
  }, []);

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
    setClickOrderIds(prev => prev.filter(itemId => itemId !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    setImages(prev => {
      prev.forEach(img => {
        if (img.previewUrl) {
          URL.revokeObjectURL(img.previewUrl);
        }
      });
      return [];
    });
    setSelectedIds(new Set());
    setIsOrderingMode(false);
    setClickOrderIds([]);
  }, []);

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startOrderingMode = useCallback(() => {
    setIsOrderingMode(true);
    setClickOrderIds([]);
  }, []);

  const cancelOrderingMode = useCallback(() => {
    setIsOrderingMode(false);
    setClickOrderIds([]);
  }, []);

  const handleOrderSlotClick = useCallback((id: number) => {
    setClickOrderIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);

  const applyClickOrdering = useCallback(() => {
    if (clickOrderIds.length > 0) {
      setImages(prev => {
        const byId = new Map<number, ImageState>(prev.map(img => [img.id, img]));
        const ordered: ImageState[] = [];
        const picked = new Set<number>();
        for (const id of clickOrderIds) {
          const item = byId.get(id);
          if (item) {
            ordered.push(item);
            picked.add(id);
          }
        }
        for (const item of prev) {
          if (!picked.has(item.id)) {
            ordered.push(item);
          }
        }
        return ordered;
      });
      setSelectedIds(prev => {
        const next = new Set(prev);
        clickOrderIds.forEach(id => next.add(id));
        return next;
      });
    }
    setIsOrderingMode(false);
    setClickOrderIds([]);
  }, [clickOrderIds]);

  const showOrderingToolbar = maxImages > 1 && images.length > 0 && !compact;
  const gridColsClass = compact
    ? 'grid-cols-1'
    : images.length === 0
    ? 'grid-cols-1'
    : maxImages > 10 && images.length > 6
    ? 'grid-cols-3'
    : 'grid-cols-2';
  const scrollContainerClass = maxImages > 10 && images.length > 6
    ? 'max-h-[340px] overflow-y-auto custom-scrollbar p-1 -m-1'
    : '';

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="w-full select-none"
    >
      {/* Header with label and count */}
      <div className="flex justify-between items-center mb-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-600"></span>
          <span className={`font-bold text-slate-900 uppercase tracking-wider ${compact ? 'text-[10.5px]' : 'text-xs'}`}>
            {label}
          </span>
        </div>
        <div className={`flex items-center gap-1 font-mono text-[11px] font-semibold tabular-nums ${images.length === maxImages
            ? 'text-violet-700'
            : 'text-slate-600'
          }`}>
          <span>{images.length}</span>
          <span className="text-slate-400">/</span>
          <span>{maxImages}</span>
          {isUploading && (
            <svg className="animate-spin h-3.5 w-3.5 text-violet-600 ml-1" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
        </div>
      </div>

      {/* Multi-image Ordering & Batch Controls */}
      {showOrderingToolbar && (
        isOrderingMode ? (
          <div className="mb-2.5 rounded-xl bg-emerald-50/90 ring-1 ring-emerald-200 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-emerald-900 leading-snug">
                Nhấn lần lượt từ Cảnh <span className="font-mono font-bold tabular-nums">#1</span> → Cảnh cuối
              </p>
              <span className="font-mono text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md ring-1 ring-emerald-200 tabular-nums shrink-0">
                {clickOrderIds.length}/{images.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={applyClickOrdering}
                className="min-h-[44px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <span>✓ Áp dụng</span>
                <span className="font-mono tabular-nums">({clickOrderIds.length})</span>
              </button>
              <button
                type="button"
                onClick={cancelOrderingMode}
                className="min-h-[44px] px-3 rounded-xl bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 ring-1 ring-slate-300 text-xs font-semibold transition-all cursor-pointer"
              >
                Hủy
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-2.5 flex items-center gap-1.5 rounded-xl bg-slate-50/90 ring-1 ring-slate-900/5 p-1.5">
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={startOrderingMode}
                  title="Bấm chuột chọn lần lượt ảnh nào là #1, #2, #3..."
                  className="flex-1 min-h-[44px] px-2.5 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/80 shadow-2xs text-[11px] font-semibold transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1"
                >
                  <span>🔢 Chọn thứ tự</span>
                </button>
                <button
                  type="button"
                  onClick={handleNaturalSort}
                  title="Sắp xếp tự nhiên theo tên file (1, 2, ..., 10, 40)"
                  className="min-h-[44px] px-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 ring-1 ring-slate-200/80 shadow-2xs text-[11px] font-semibold font-mono tabular-nums transition-all cursor-pointer active:scale-[0.98]"
                >
                  1→9
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleClearAll}
              title="Xóa tất cả ảnh đã tải"
              className={`min-h-[44px] px-2.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 ring-1 ring-slate-200/80 hover:ring-rose-200 shadow-2xs text-[11px] font-semibold transition-all cursor-pointer active:scale-[0.98] ${images.length === 1 ? 'w-full' : ''}`}
            >
              Xóa hết
            </button>
          </div>
        )
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
        accept="image/*"
        multiple={maxImages > 1}
      />

      {/* Grid layout */}
      <div className={`grid gap-2.5 ${gridColsClass} ${scrollContainerClass}`}>
        {images.map((image, index) => (
          <ImagePreviewSlot
            key={image.id}
            src={image.previewUrl || `data:${image.mimeType};base64,${image.base64}`}
            fileName={image.fileName}
            isSelected={selectedIds.has(image.id)}
            onToggle={() => (isOrderingMode ? handleOrderSlotClick(image.id) : toggleSelection(image.id))}
            onClear={() => handleClear(image.id)}
            index={index}
            isOrderingMode={isOrderingMode}
            orderPosition={clickOrderIds.indexOf(image.id) + 1}
            canMoveLeft={maxImages > 1 && index > 0}
            canMoveRight={maxImages > 1 && index < images.length - 1}
            onMoveLeft={() => handleMoveItem(index, -1)}
            onMoveRight={() => handleMoveItem(index, 1)}
            onDragStartItem={maxImages > 1 ? handleDragStartItem : undefined}
            onDragOverItem={maxImages > 1 ? handleDragOverItem : undefined}
            onDropItem={maxImages > 1 ? handleDropItem : undefined}
            onDragEndItem={maxImages > 1 ? handleDragEndItem : undefined}
            isDropTarget={dragSourceIndex !== null && dropTargetIndex === index && dragSourceIndex !== index}
          />
        ))}
        {images.length < maxImages && !isOrderingMode && (
          <UploaderSlot
            onClick={() => fileInputRef.current?.click()}
            isDragging={isDragging}
            compact={compact || images.length > 0}
          />
        )}
      </div>

      {/* Helper text */}
      {images.length === 0 && !compact && (
        <p className="text-center text-[11px] text-slate-500 mt-3 leading-relaxed">
          Hỗ trợ: JPG, PNG, WEBP • Tối đa <span className="font-mono font-semibold tabular-nums">{maxImages}</span> ảnh
        </p>
      )}
      {maxImages > 1 && images.length > 1 && !isOrderingMode && !compact && (
        <p className="text-[10.5px] text-slate-500 mt-2 leading-relaxed">
          Thứ tự cảnh: <span className="font-mono font-semibold text-slate-700">#1 → #{images.length}</span> • Kéo thả ảnh hoặc nhấn <strong className="text-indigo-700">Chọn thứ tự</strong> để xếp lại theo ý muốn.
        </p>
      )}
    </div>
  );
});

ImageUploader.displayName = 'ImageUploader';
