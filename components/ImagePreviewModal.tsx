import React from 'react';
import { DownloadIcon } from './Icons';

interface ImagePreviewModalProps {
  base64: string;
  index: number;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ base64, index, onClose }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64}`;
    // Simple numeric filename: 1.png, 2.png, etc.
    link.download = `${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in"
      onClick={onClose}
    >
      <div className="relative w-full max-w-6xl h-full p-6 md:p-10 flex flex-col justify-center items-center" onClick={(e) => e.stopPropagation()}>
        
        <div className="relative w-auto h-auto max-h-[85vh] max-w-full rounded-xl shadow-2xl overflow-hidden bg-black/50 border border-white/10">
             <img
                src={`data:image/png;base64,${base64}`}
                alt="Full preview"
                className="block max-h-[85vh] w-auto h-auto object-contain"
            />
        </div>

        <div className="mt-8 flex items-center gap-4">
             <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-8 py-3.5 bg-white text-indigo-900 font-bold rounded-full hover:bg-indigo-50 hover:scale-105 transition-all shadow-lg ring-1 ring-white/50"
            >
                <DownloadIcon className="w-5 h-5"/>
                Tải xuống ảnh {index + 1}
            </button>
             <button
                onClick={onClose}
                className="px-8 py-3.5 bg-slate-800/80 text-white font-bold rounded-full hover:bg-slate-700 hover:scale-105 transition-all backdrop-blur-sm border border-slate-700"
            >
                Đóng
            </button>
        </div>
        
        <button
            onClick={onClose}
            className="absolute top-6 right-6 bg-white/10 text-white rounded-full h-12 w-12 flex items-center justify-center text-2xl hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
            &times;
        </button>
      </div>
    </div>
  );
};