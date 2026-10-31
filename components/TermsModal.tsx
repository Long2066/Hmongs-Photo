// Terms of Service Modal Component
import React, { useState, useEffect } from 'react';
import { subscribeToTerms, TermsData } from '../services/firebaseService';

interface TermsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept?: () => void;
    onReject?: () => void;
}

export interface TermItem {
    id: number;
    title: string;
    badge: string;
    description: string;
    highlight?: boolean;
    danger?: boolean;
}

export const TERMS_LIST: TermItem[] = [
    {
        id: 1,
        title: 'Chấp thuận',
        badge: 'Cơ bản',
        description: 'Đăng ký tài khoản đồng nghĩa bạn đã đọc, hiểu và đồng ý toàn bộ điều khoản này.'
    },
    {
        id: 2,
        title: 'Bảo mật',
        badge: 'Tài khoản',
        description: 'Bạn tự chịu trách nhiệm bảo mật mật khẩu và mọi hoạt động dưới tài khoản của mình.'
    },
    {
        id: 3,
        title: 'Gói cước',
        badge: 'Chi phí',
        description: 'Gói Free tặng 20 ảnh/ngày; gói Plus/Pro nạp kích hoạt tự động, tính phí 500đ/ảnh.'
    },
    {
        id: 4,
        title: 'Không hoàn tiền',
        badge: 'Giao dịch',
        description: 'Số dư và gói dịch vụ sau khi nạp thành công không thể quy đổi hay hoàn lại tiền mặt.'
    },
    {
        id: 5,
        title: 'Bảo mật ảnh',
        badge: 'Riêng tư',
        description: 'Ảnh tải lên chỉ phục vụ xử lý AI, cam kết không bán hay chia sẻ cho bên thứ 3.'
    },
    {
        id: 6,
        title: 'Lưu trữ',
        badge: 'Dữ liệu',
        description: 'Lịch sử ảnh tạm tự động xóa sau 72 giờ để bảo mật, bạn vui lòng tải ảnh về máy ngay khi tạo.'
    },
    {
        id: 7,
        title: 'Quyền sở hữu',
        badge: 'Bản quyền',
        description: 'Bạn có toàn quyền sử dụng hình ảnh do AI tạo ra cho mục đích cá nhân hoặc thương mại.'
    },
    {
        id: 8,
        title: 'Nghiêm cấm',
        badge: 'Cấm vi phạm',
        danger: true,
        description: 'Tuyệt đối không tạo ảnh khỏa thân (18+), bạo lực, bôi nhọ người khác hoặc vi phạm pháp luật.'
    },
    {
        id: 9,
        title: 'Chế tài',
        badge: 'Xử lý vi phạm',
        danger: true,
        description: 'Cố tình vi phạm chính sách hoặc gian lận sẽ bị khóa tài khoản vĩnh viễn và không hoàn lại số dư.'
    },
    {
        id: 10,
        title: 'Hỗ trợ',
        badge: 'Dịch vụ',
        description: 'Kết quả AI mang tính sáng tạo; mọi sự cố thanh toán hay kỹ thuật vui lòng gửi yêu cầu qua mục Hỗ trợ.'
    },
    {
        id: 11,
        title: 'Trách nhiệm pháp lý & Miễn trừ',
        badge: 'Pháp luật VN',
        highlight: true,
        description: 'Nếu vi phạm các điều khoản trên liên quan tới hành chính, dân sự, hình sự,... cá nhân vi phạm hoàn toàn chịu trách nhiệm trước pháp luật Việt Nam. Nhà phát triển không chịu trách nhiệm trước bất kì hành vi nào do người dùng gây ra.'
    }
];

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, onAccept, onReject }) => {
    const [termsData, setTermsData] = useState<TermsData | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        // Subscribe to realtime updates if admin edits, with instant fallback
        const unsubscribe = subscribeToTerms((data) => {
            setTermsData(data);
        });

        return () => unsubscribe();
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAccept = () => {
        if (onAccept) onAccept();
        onClose();
    };

    const handleReject = () => {
        if (onReject) onReject();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-fade-in border border-slate-100">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-5 py-4 sm:px-6 sm:py-5 text-white flex items-center justify-between shadow-sm flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-xl shadow-inner border border-white/20">
                            📜
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold tracking-tight">
                                Điều khoản sử dụng ImageTool
                            </h2>
                            <p className="text-white/80 text-xs mt-0.5">
                                11 quy định bắt buộc trước khi tạo tài khoản &bull; Phiên bản {termsData?.version || '2.0'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleReject}
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center transition-colors"
                        title="Đóng (Không đồng ý)"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Sub-header Notice */}
                <div className="bg-indigo-50/70 border-b border-indigo-100/80 px-5 py-2.5 text-xs text-indigo-900 flex items-center gap-2 flex-shrink-0">
                    <span className="text-indigo-600 text-sm">ℹ️</span>
                    <span>
                        Vui lòng đọc kỹ <strong>11 điều khoản</strong> dưới đây. Bạn cần bấm <strong>"Tôi đồng ý"</strong> để có thể đăng ký tài khoản.
                    </span>
                </div>

                {/* Content - 11 Terms */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 overscroll-contain">
                    {TERMS_LIST.map((term) => {
                        if (term.highlight) {
                            // Term 11: Legal & Disclaimer - special standout alert styling
                            return (
                                <div
                                    key={term.id}
                                    className="p-4 sm:p-4.5 rounded-xl bg-red-50/80 border-l-4 border-l-red-600 border border-red-200/90 shadow-sm"
                                >
                                    <div className="flex items-center gap-2.5 mb-1.5">
                                        <span className="w-6 h-6 rounded-md bg-red-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm">
                                            11
                                        </span>
                                        <h4 className="font-bold text-red-900 text-sm sm:text-base">
                                            {term.title}
                                        </h4>
                                        <span className="ml-auto text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-red-200/80 text-red-800">
                                            {term.badge}
                                        </span>
                                    </div>
                                    <p className="text-red-800/95 text-xs sm:text-sm leading-relaxed pl-8">
                                        {term.description}
                                    </p>
                                </div>
                            );
                        }

                        if (term.danger) {
                            // Term 8 & 9: Restrictions & Penalties - amber/rose warning styling
                            return (
                                <div
                                    key={term.id}
                                    className="p-3.5 sm:p-4 rounded-xl bg-rose-50/50 border border-rose-200/70 hover:bg-rose-50/80 transition-colors"
                                >
                                    <div className="flex items-center gap-2.5 mb-1">
                                        <span className="w-6 h-6 rounded-md bg-rose-500 text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm">
                                            0{term.id}
                                        </span>
                                        <h4 className="font-semibold text-rose-950 text-sm sm:text-base">
                                            {term.title}
                                        </h4>
                                        <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                            {term.badge}
                                        </span>
                                    </div>
                                    <p className="text-slate-700 text-xs sm:text-sm leading-relaxed pl-8">
                                        {term.description}
                                    </p>
                                </div>
                            );
                        }

                        // Standard terms 1 -> 7, 10
                        return (
                            <div
                                key={term.id}
                                className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200/60 transition-colors"
                            >
                                <div className="flex items-center gap-2.5 mb-1">
                                    <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center">
                                        {term.id < 10 ? `0${term.id}` : term.id}
                                    </span>
                                    <h4 className="font-semibold text-slate-900 text-sm sm:text-base">
                                        {term.title}
                                    </h4>
                                    <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600">
                                        {term.badge}
                                    </span>
                                </div>
                                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed pl-8">
                                    {term.description}
                                </p>
                            </div>
                        );
                    })}

                    {/* Bottom reassurance card */}
                    <div className="mt-4 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                        <span className="text-base flex-shrink-0">⚠️</span>
                        <span className="leading-relaxed">
                            Nếu bạn <strong>không đồng ý</strong> với bất kỳ điều khoản nào ở trên, vui lòng nhấn <strong>"Không đồng ý / Đóng"</strong>. Hệ thống sẽ không kích hoạt tạo tài khoản khi chưa có sự chấp thuận.
                        </span>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t border-slate-200 px-5 py-3.5 sm:px-6 sm:py-4 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                    <span className="text-xs text-slate-500 text-center sm:text-left order-2 sm:order-1">
                        Bằng việc bấm Đồng ý, bạn cam kết tuân thủ đầy đủ 11 điều khoản trên.
                    </span>
                    <div className="flex items-center gap-2.5 w-full sm:w-auto order-1 sm:order-2 justify-end">
                        <button
                            type="button"
                            onClick={handleReject}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 hover:text-slate-900 transition-colors text-sm min-h-[44px]"
                        >
                            Không đồng ý
                        </button>
                        <button
                            type="button"
                            onClick={handleAccept}
                            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-sm hover:shadow-indigo-500/25 transition-all text-sm min-h-[44px] flex items-center justify-center gap-1.5 active:scale-[0.98]"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Tôi đồng ý</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: scale(0.96); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in {
                    animation: fade-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
                }
            `}</style>
        </div>
    );
};

export default TermsModal;
