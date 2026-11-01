import React, { useState, useEffect } from 'react';
import {
    startAntigravityOAuthSession,
    fetchVpsAntigravityAccounts,
    submitAntigravityCallback,
    verifyAndRewardContributedAccount,
    getUserContributedAccounts,
    ContributedAccountItem
} from '../services/quotaStationService';
import type { User } from '../types';

interface GoogleQuotaStationModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    onBalanceUpdated: () => void;
}

export const GoogleQuotaStationModal: React.FC<GoogleQuotaStationModalProps> = ({
    isOpen,
    onClose,
    user,
    onBalanceUpdated
}) => {
    const [step, setStep] = useState<'idle' | 'authorizing' | 'submitting' | 'success'>('idle');
    const [authUrl, setAuthUrl] = useState<string>('');
    const [expectedState, setExpectedState] = useState<string>('');
    const [callbackInput, setCallbackInput] = useState<string>('');
    const [knownAccountsBefore, setKnownAccountsBefore] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [contributedList, setContributedList] = useState<ContributedAccountItem[]>([]);

    // Load user's contributed history when opened
    useEffect(() => {
        if (isOpen && user?.id) {
            loadUserContributions();
            setErrorMsg(null);
            setSuccessMsg(null);
            setCallbackInput('');
            setStep('idle');
        }
    }, [isOpen, user?.id]);

    const loadUserContributions = async () => {
        if (!user?.id) return;
        const list = await getUserContributedAccounts(user.id);
        setContributedList(list);
    };

    if (!isOpen) return null;

    // STEP 1: Start OAuth Session and Open Google Login
    const handleStartOAuth = async () => {
        setIsLoading(true);
        setErrorMsg(null);
        setSuccessMsg(null);
        try {
            // Snapshot current accounts on VPS before opening
            const accounts = await fetchVpsAntigravityAccounts();
            setKnownAccountsBefore(accounts);

            const session = await startAntigravityOAuthSession();
            setAuthUrl(session.url);
            setExpectedState(session.state);
            setStep('authorizing');

            // Open Google Authorization page in new tab/popup
            window.open(session.url, '_blank', 'width=600,height=750,noopener,noreferrer');
        } catch (err: any) {
            setErrorMsg(err.message || 'Không thể kết nối với máy chủ VPS.');
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-paste from clipboard helper
    const handleAutoPaste = async () => {
        setErrorMsg(null);
        try {
            if (navigator?.clipboard?.readText) {
                const text = await navigator.clipboard.readText();
                if (text && (text.includes('code=') || text.includes('localhost') || text.includes('oauth-callback'))) {
                    setCallbackInput(text.trim());
                    return;
                }
            }
        } catch {
            // Clipboard permission denied or unsupported
        }
        // If auto-read failed, just focus the input
        const inputEl = document.getElementById('quota-callback-input');
        if (inputEl) inputEl.focus();
    };

    // STEP 2: Submit Callback and Reward Credits
    const handleSubmitCallback = async () => {
        const textToSubmit = callbackInput.trim();
        if (!textToSubmit) {
            setErrorMsg('Vui lòng dán liên kết từ thanh địa chỉ sau khi đăng nhập Google.');
            return;
        }

        setIsLoading(true);
        setStep('submitting');
        setErrorMsg(null);

        try {
            // 1. Submit to VPS
            await submitAntigravityCallback(textToSubmit, expectedState);

            // 2. Anti-fraud check & Reward 20 free images
            const rewardResult = await verifyAndRewardContributedAccount(
                user.id,
                user.name,
                knownAccountsBefore
            );

            if (!rewardResult.success) {
                setErrorMsg(rewardResult.message);
                setStep('authorizing');
                return;
            }

            // Success!
            setSuccessMsg(rewardResult.message);
            setStep('success');
            setCallbackInput('');
            onBalanceUpdated();
            await loadUserContributions();
        } catch (err: any) {
            setErrorMsg(err.message || 'Xác thực tài khoản Google thất bại.');
            setStep('authorizing');
        } finally {
            setIsLoading(false);
        }
    };

    const totalFreeImagesEarned = contributedList.reduce((acc, curr) => acc + (curr.rewardImages || 20), 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div
                className="bg-white rounded-3xl shadow-2xl ring-1 ring-slate-900/10 max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
                role="dialog"
                aria-modal="true"
            >
                {/* Header Banner */}
                <div className="relative p-5 sm:p-6 bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white overflow-hidden shrink-0">
                    {/* Decorative glows */}
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                                <span className="text-2xl">⚙️</span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold tracking-tight text-white">Trạm Nạp Quota</h2>
                                    <span className="px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider bg-amber-400 text-slate-900 rounded-full shadow-xs">
                                        +20 Ảnh / Acc
                                    </span>
                                </div>
                                <p className="text-xs text-indigo-200 mt-0.5">
                                    Nạp tài khoản Google để nhận thêm lượt tạo ảnh miễn phí
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95 min-w-[40px] min-h-[40px] flex items-center justify-center"
                            aria-label="Đóng"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
                    {/* Value Proposition Bento Card */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-indigo-50 border border-amber-200/60 shadow-xs">
                        <div className="flex items-start gap-3">
                            <span className="text-xl shrink-0">🎁</span>
                            <div className="text-xs text-slate-700 leading-relaxed">
                                <p className="font-bold text-slate-900 mb-1">Quyền lợi nạp tài khoản:</p>
                                <ul className="space-y-1 list-disc list-inside text-slate-600">
                                    <li>Mỗi tài khoản Google mới nạp thành công ➔ Nhận ngay <strong>+20 lượt ảnh miễn phí</strong>.</li>
                                    <li><strong>Không giới hạn số lần nạp</strong> (1 tài khoản chỉ được nhận thưởng 1 lần).</li>
                                    <li>Khuyến khích sử dụng <em>tài khoản phụ / tài khoản mới</em> để kết nối an toàn.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Error Alert */}
                    {errorMsg && (
                        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 animate-shake">
                            <span className="text-base shrink-0">⚠️</span>
                            <div className="flex-1 font-medium">{errorMsg}</div>
                        </div>
                    )}

                    {/* Success Alert */}
                    {successMsg && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-3 animate-fade-in">
                            <span className="text-2xl shrink-0">🎉</span>
                            <div>
                                <p className="font-bold text-sm text-emerald-900 mb-0.5">Nạp thành công!</p>
                                <p>{successMsg}</p>
                            </div>
                        </div>
                    )}

                    {/* Action Step 1: Open Google OAuth */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">1</span>
                                <span className="text-xs font-bold text-slate-900">Đăng nhập tài khoản Google</span>
                            </div>
                            {step !== 'idle' && (
                                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    ✓ Đã mở tab cấp quyền
                                </span>
                            )}
                        </div>

                        <button
                            onClick={handleStartOAuth}
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2.5 active:scale-98 disabled:opacity-50 min-h-[44px]"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path fill="#EA4335" d="M12 5c1.56 0 2.97.55 4.08 1.45l3.06-3.06C17.29 1.63 14.83 1 12 1 7.42 1 3.53 3.6 1.64 7.37l3.75 2.91C6.28 7.33 8.91 5 12 5z"/>
                                <path fill="#4285F4" d="M23.49 12.28c0-.79-.07-1.54-.19-2.28H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.71 2.88c2.16-1.99 3.71-4.92 3.71-8.69z"/>
                                <path fill="#FBBC05" d="M5.39 14.72c-.24-.72-.39-1.49-.39-2.28 0-.79.15-1.56.39-2.28L1.64 7.25C.6 9.33 0 11.64 0 14.08s.6 4.75 1.64 6.83l3.75-2.91z"/>
                                <path fill="#34A853" d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.71-2.88c-1.07.72-2.45 1.16-4.22 1.16-3.09 0-5.72-2.33-6.61-5.28L1.64 16.08C3.53 19.85 7.42 22.45 12 22.45z"/>
                            </svg>
                            <span>{step === 'idle' ? 'Bấm vào đây để mở trang Google' : 'Mở lại trang cấp quyền Google'}</span>
                        </button>
                    </div>

                    {/* Action Step 2: Confirm Callback */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">2</span>
                            <span className="text-xs font-bold text-slate-900">Dán liên kết xác thực (Sau khi đăng nhập xong)</span>
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            Khi đăng nhập xong, trang Google sẽ chuyển hướng về một trang trắng báo <em>"Không thể truy cập localhost"</em>. Hãy <strong>sao chép toàn bộ thanh địa chỉ</strong> đó và dán vào đây:
                        </p>

                        <div className="flex gap-2">
                            <input
                                id="quota-callback-input"
                                type="text"
                                value={callbackInput}
                                onChange={(e) => setCallbackInput(e.target.value)}
                                placeholder="http://localhost:51121/oauth-callback?code=4/..."
                                className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all min-h-[44px]"
                            />
                            <button
                                type="button"
                                onClick={handleAutoPaste}
                                className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors shrink-0 flex items-center gap-1.5 active:scale-95 min-h-[44px]"
                                title="Dán tự động từ bộ nhớ tạm"
                            >
                                <span>📋</span>
                                <span className="hidden sm:inline">Dán</span>
                            </button>
                        </div>

                        <button
                            onClick={handleSubmitCallback}
                            disabled={isLoading || !callbackInput.trim()}
                            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Đang kết nối với VPS...</span>
                                </>
                            ) : (
                                <>
                                    <span>✓</span>
                                    <span>Xác nhận nạp tài khoản & Nhận +20 ảnh</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Contributed History Card */}
                    <div className="pt-2">
                        <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-2">
                            <span>Lịch sử đóng góp của bạn</span>
                            <span className="text-indigo-600">
                                {contributedList.length} tài khoản • Tích lũy +{totalFreeImagesEarned} ảnh
                            </span>
                        </div>

                        {contributedList.length === 0 ? (
                            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                                Bạn chưa nạp tài khoản Google nào. Hãy nạp ngay để nhận thưởng!
                            </div>
                        ) : (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                {contributedList.map((item) => (
                                    <div
                                        key={item.id}
                                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs"
                                    >
                                        <div className="flex items-center gap-2 truncate pr-2">
                                            <span className="text-emerald-500 font-bold">✓</span>
                                            <span className="font-medium text-slate-800 truncate">{item.email}</span>
                                        </div>
                                        <div className="text-[11px] font-bold text-amber-600 shrink-0 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                                            +{item.rewardImages || 20} ảnh
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                    <span className="text-[11px] text-slate-400">
                        Bảo mật 100% • Xác thực Google chuẩn OAuth 2.0
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};
