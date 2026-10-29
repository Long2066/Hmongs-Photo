import React, { useState } from 'react';
import { DownloadIcon } from './Icons';
import { downloadImage } from '../services/downloadService';

interface ImagePreviewModalProps {
  base64: string;
  index: number;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ base64, index, onClose }) => {
  const [downloadStatus, setDownloadStatus] = useState<{ message: string; success: boolean } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadStatus(null);

    const result = await downloadImage(base64, `${index + 1}.png`);

    setDownloadStatus({
      message: result.message,
      success: result.success
    });
    setIsDownloading(false);

    // Auto-hide success message after 3 seconds
    if (result.success) {
      setTimeout(() => setDownloadStatus(null), 3000);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in p-4"
      onClick={onClose}
    >
      <div className="relative w-full max-w-4xl h-full flex flex-col justify-center items-center gap-4" onClick={(e) => e.stopPropagation()}>

        {/* Image Container */}
        <div className="relative w-auto h-auto max-h-[70vh] max-w-full rounded-xl shadow-2xl overflow-hidden bg-black/50 border border-white/10">
          <img
            src={`data:image/png;base64,${base64}`}
            alt="Full preview"
            className="block max-h-[70vh] w-auto h-auto object-contain"
          />
        </div>

        {/* Download Status Toast */}
        {downloadStatus && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full font-bold text-sm shadow-lg z-[110] animate-fade-in ${downloadStatus.success ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}>
            {downloadStatus.message}
          </div>
        )}

        {/* Action Buttons - Larger for mobile */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full hover:scale-105 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px] justify-center"
          >
            {isDownloading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Đang tải...
              </>
            ) : (
              <>
                <DownloadIcon className="w-5 h-5" />
                Tải xuống
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-8 py-4 bg-slate-700 text-white font-bold rounded-full hover:bg-slate-600 transition-all min-w-[100px]"
          >
            Đóng
          </button>
        </div>

        {/* Close X button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 bg-white/10 text-white rounded-full h-12 w-12 flex items-center justify-center text-2xl hover:bg-white/20 transition-colors"
        >
          &times;
        </button>
      </div>
    </div>
  );
};