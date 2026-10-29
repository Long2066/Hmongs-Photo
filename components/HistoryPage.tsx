import React, { useState, useEffect } from 'react';
import * as firebaseService from '../services/firebaseService';
import { User, HistoryItem } from '../types';
import { ArrowLeftIcon, ClockIcon, TrashIcon } from './Icons';

interface HistoryPageProps {
  user: User;
  onBack: () => void;
  onImageClick: (base64: string) => void;
}

const HistoryCard: React.FC<{ item: HistoryItem, onImageClick: (base64: string) => void, onDelete: (id: string) => void }> = ({ item, onImageClick, onDelete }) => {
  const successfulImages = item.images.filter((img): img is string => img !== null);

  return (
    <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 flex flex-col gap-4 animate-fade-in hover:shadow-md transition-shadow relative group">
      <div className="flex items-center justify-between">
        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md uppercase tracking-wider">
          {item.style}
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <ClockIcon className="w-3 h-3" />
          {new Date(item.timestamp).toLocaleDateString('vi-VN')}
        </span>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
        className="absolute top-2 right-2 p-2 bg-white/80 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:scale-110 shadow-sm z-10"
        title="Xóa ảnh này"
      >
        <TrashIcon className="w-4 h-4" />
      </button>

      <div className="grid grid-cols-2 gap-2">
        {successfulImages.slice(0, 4).map((img, index) => (
          <div key={index} className="relative w-full aspect-square bg-slate-100 rounded-lg overflow-hidden group/img cursor-pointer" onClick={() => onImageClick(img)}>
            <img src={`data:image/png;base64,${img}`} alt={`History`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-white font-bold text-xs">Xem</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <p className="text-sm text-slate-700 font-medium line-clamp-2" title={item.prompt}>{item.prompt}</p>
        <p className="text-xs text-slate-500 mt-1">{item.aspectRatio} • {item.resolution} • {item.shotType}</p>
      </div>
    </div>
  );
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ user, onBack, onImageClick }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[HistoryPage] Fetching history for user:', user.id);
      const userHistory = await firebaseService.getHistoryFromFirestore(user.id);
      console.log('[HistoryPage] Received', userHistory.length, 'items');
      setHistory(userHistory);
    } catch (err) {
      console.error("[HistoryPage] Failed to fetch history:", err);
      setError("Không thể tải thư viện. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user.id]);

  const handleDelete = async (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa ảnh này không?")) {
      await firebaseService.deleteHistoryItemFromFirestore(id);
      setHistory(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleClearAll = async () => {
    if (confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa TẤT CẢ lịch sử ảnh không? Hành động này không thể hoàn tác.")) {
      await firebaseService.clearUserHistoryInFirestore(user.id);
      setHistory([]);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Thư viện cá nhân</h2>
            <p className="text-slate-500 text-sm">Tự động xóa sau 3 ngày • {history.length} mục</p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-bold text-sm"
          >
            <TrashIcon className="w-4 h-4" />
            Xóa tất cả
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-slate-100 shadow-sm">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="text-lg font-bold text-slate-700">Đang tải thư viện...</h3>
          <p className="text-slate-500 mt-2">Vui lòng đợi trong giây lát</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-2xl p-16 text-center border border-red-200 shadow-sm">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">⚠️</span>
          </div>
          <h3 className="text-lg font-bold text-red-700">{error}</h3>
          <button
            onClick={fetchHistory}
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold"
          >
            Thử lại
          </button>
        </div>
      ) : history.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {history.map(item => <HistoryCard key={item.id} item={item} onImageClick={onImageClick} onDelete={handleDelete} />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-16 text-center border border-slate-100 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClockIcon className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-700">Chưa có dữ liệu</h3>
          <p className="text-slate-500 mt-2">Hãy bắt đầu tạo những bức ảnh đầu tiên của bạn!</p>
          <p className="text-xs text-slate-400 mt-4">User ID: {user.id}</p>
        </div>
      )}
    </div>
  );
};