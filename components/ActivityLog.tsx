import React, { useState, useEffect } from 'react';
import * as firebaseService from '../services/firebaseService';
import { HistoryItem, User } from '../types';
import { ClockIcon } from './Icons';

interface ActivityLogProps {
    user: User | null;
    refreshTrigger: number; // Prop to trigger refresh when generation finishes
    onImageClick: (base64: string) => void;
    className?: string;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ user, refreshTrigger, onImageClick, className = "" }) => {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    // Default to false (collapsed) as requested
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (user) {
            firebaseService.getHistoryFromFirestore(user.id).then(items => {
                // Keep only last 5 items for the widget
                setHistory(items.slice(0, 5));
            });
        }
    }, [user, refreshTrigger]);

    if (!user || history.length === 0) return null;

    return (
        <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-300 ${className}`}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors group"
            >
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                    <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <ClockIcon className="w-4 h-4" />
                    </div>
                    <span>Nhật ký hoạt động gần đây</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{history.length} mục</span>
                    <svg
                        className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {isExpanded && (
                <div className="divide-y divide-slate-100 animate-fade-in">
                    {history.map(item => {
                        const previewImage = item.images.find(img => img !== null);
                        return (
                            <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                                <div className="w-14 h-14 rounded-lg bg-slate-200 flex-shrink-0 overflow-hidden border border-slate-200 shadow-sm">
                                    {previewImage && (
                                        <img
                                            src={`data:image/png;base64,${previewImage}`}
                                            alt="Thumbnail"
                                            className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-500"
                                            onClick={() => onImageClick(previewImage)}
                                        />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 truncate" title={item.prompt}>
                                        {item.prompt.substring(0, 80)}...
                                    </p>
                                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">{item.style}</span>
                                        <span className="flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {new Date(item.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div className="p-2 text-center bg-slate-50">
                        <p className="text-[10px] text-slate-400">Chỉ hiển thị 5 hoạt động gần nhất</p>
                    </div>
                </div>
            )}
        </div>
    );
};