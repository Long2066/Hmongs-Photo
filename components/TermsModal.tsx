// Terms of Service Modal Component
import React, { useState, useEffect } from 'react';
import { getTermsContent, subscribeToTerms, TermsData } from '../services/firebaseService';

interface TermsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept?: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, onAccept }) => {
    const [terms, setTerms] = useState<TermsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;

        setLoading(true);

        // Subscribe to realtime updates
        const unsubscribe = subscribeToTerms((termsData) => {
            setTerms(termsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-white">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">📜</span>
                        <div>
                            <h2 className="text-xl font-bold">Điều khoản sử dụng</h2>
                            {terms && (
                                <p className="text-white/80 text-sm mt-1">
                                    Phiên bản {terms.version}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p className="mt-4 text-slate-500">Đang tải điều khoản...</p>
                        </div>
                    ) : (
                        <div className="prose prose-slate max-w-none">
                            {terms?.content.split('\n').map((line, i) => {
                                // Style headings
                                if (line.startsWith('📜')) {
                                    return <h3 key={i} className="text-lg font-bold text-indigo-800 mb-2">{line}</h3>;
                                }
                                if (line.startsWith('Cập nhật:')) {
                                    return <p key={i} className="text-sm text-slate-500 mb-4 italic">{line}</p>;
                                }
                                // Style numbered items
                                if (/^\d+\./.test(line)) {
                                    const [num, ...rest] = line.split(' - ');
                                    return (
                                        <div key={i} className="mb-3 p-3 bg-slate-50 rounded-lg border-l-4 border-indigo-500">
                                            <span className="font-bold text-indigo-600">{num}</span>
                                            <span className="text-slate-700"> - {rest.join(' - ')}</span>
                                        </div>
                                    );
                                }
                                // Last line (agreement)
                                if (line.includes('đồng ý')) {
                                    return (
                                        <p key={i} className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 font-medium text-center">
                                            ⚠️ {line}
                                        </p>
                                    );
                                }
                                return line ? <p key={i} className="text-slate-600 mb-2">{line}</p> : null;
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 p-4 bg-slate-50 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition-colors"
                    >
                        Đóng
                    </button>
                    {onAccept && (
                        <button
                            onClick={() => {
                                onAccept();
                                onClose();
                            }}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
                        >
                            ✓ Tôi đồng ý
                        </button>
                    )}
                </div>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out;
                }
            `}</style>
        </div>
    );
};

export default TermsModal;
