import React, { useState, useEffect, useRef } from 'react';
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
    const [isExtensionInstalled, setIsExtensionInstalled] = useState<boolean>(false);
    const [copiedExtensionsUrl, setCopiedExtensionsUrl] = useState<boolean>(false);

    // Keep ref to avoid stale closures in event listeners
    const expectedStateRef = useRef(expectedState);
    const knownAccountsBeforeRef = useRef(knownAccountsBefore);
    const userRef = useRef(user);

    useEffect(() => {
        expectedStateRef.current = expectedState;
    }, [expectedState]);

    useEffect(() => {
        knownAccountsBeforeRef.current = knownAccountsBefore;
    }, [knownAccountsBefore]);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

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

    // Listen for extension detection & automatic OAuth captures
    useEffect(() => {
        if (!isOpen) return;

        // Check DOM dataset first
        if (typeof document !== 'undefined') {
            const hasBridge = document.documentElement.dataset.flowBridgeInstalled === 'true' ||
                Boolean((window as any).__IMAGE_TOOL_EXTENSION_INSTALLED__);
            if (hasBridge) setIsExtensionInstalled(true);
        }

        const handleWindowMsg = async (event: MessageEvent) => {
            if (!event.data || !event.data.type) return;

            // 1. Extension detection pong
            if (event.data.type === 'FLOW_BRIDGE_PONG') {
                setIsExtensionInstalled(true);
            }

            // 2. Extension auto-captured Google OAuth callback
            if (event.data.type === 'QUOTA_OAUTH_CAPTURED' && event.data.callbackUrl) {
                console.log('[QuotaStation] Received auto callback from Extension:', event.data.callbackUrl);
                const capturedUrl = String(event.data.callbackUrl).trim();
                setCallbackInput(capturedUrl);
                await processSubmission(capturedUrl);
            }
        };

        window.addEventListener('message', handleWindowMsg);
        window.postMessage({ type: 'FLOW_BRIDGE_PING' }, '*');

        return () => window.removeEventListener('message', handleWindowMsg);
    }, [isOpen]);

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
            knownAccountsBeforeRef.current = accounts;

            const session = await startAntigravityOAuthSession();
            setAuthUrl(session.url);
            setExpectedState(session.state);
            expectedStateRef.current = session.state;
            setStep('authorizing');

            // Open Google Authorization page in new tab/popup
            window.open(session.url, '_blank', 'width=600,height=750,noopener,noreferrer');
        } catch (err: any) {
            setErrorMsg(err.message || 'Không thể kết nối với máy chủ VPS.');
        } finally {
            setIsLoading(false);
        }
    };

    // Open / copy chrome://extensions helper
    const handleOpenExtensionsPage = async () => {
        try {
            await navigator.clipboard.writeText('chrome://extensions');
            setCopiedExtensionsUrl(true);
            setTimeout(() => setCopiedExtensionsUrl(false), 3500);
        } catch {}
        try {
            window.open('chrome://extensions', '_blank');
        } catch {}
    };

    // Core submission processing (shared by manual click and extension auto-capture)
    const processSubmission = async (textToSubmit: string) => {
        const trimmed = textToSubmit.trim();
        if (!trimmed) {
            setErrorMsg('Vui lòng hoàn tất đăng nhập Google để nhận thưởng.');
            return;
        }

        setIsLoading(true);
        setStep('submitting');
        setErrorMsg(null);
        setSuccessMsg(null);

        try {
            // 1. Submit to VPS
            await submitAntigravityCallback(trimmed, expectedStateRef.current);

            // 2. Anti-fraud check & Reward 10 free images
            const rewardResult = await verifyAndRewardContributedAccount(
                userRef.current.id,
                userRef.current.name,
                knownAccountsBeforeRef.current
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

    const totalFreeImagesEarned = contributedList.reduce((acc, curr) => acc + (curr.rewardImages || 10), 0);

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
                                    <h2 className="text-lg font-bold tracking-tight text-white">Cấu hình</h2>
                                    <span className="px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider bg-amber-400 text-slate-900 rounded-full shadow-xs">
                                        +10 Ảnh / Acc
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
                    {/* Extension Status / Install Section */}
                    {isExtensionInstalled ? (
                        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 text-base font-bold">
                                    ⚡
                                </div>
                                <div className="text-xs text-emerald-950">
                                    <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                                        <span>Bổ trợ vip-imagetools: ĐANG HOẠT ĐỘNG</span>
                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    </p>
                                    <p className="text-slate-600 text-[11px] mt-0.5">
                                        Chế độ tự động 100% đã sẵn sàng. Bạn chỉ việc bấm đăng nhập Google!
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                <button
                                    type="button"
                                    onClick={handleOpenExtensionsPage}
                                    className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
                                    title="Mở trang chrome://extensions/"
                                >
                                    <span>⚙️</span>
                                    <span>{copiedExtensionsUrl ? '✓ Đã copy link' : 'Mở Tiện ích'}</span>
                                </button>
                                <a
                                    href="/vip-imagetools.zip"
                                    download="vip-imagetools.zip"
                                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                                    title="Tải lại file zip bổ trợ nếu cần"
                                >
                                    Tải .zip
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200/80 shadow-xs space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
                                        🧩
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-xs font-bold text-slate-900">Bổ trợ tự động (vip-imagetools)</h4>
                                            <span className="px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-100 rounded-md">
                                                Khuyên dùng
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                                            Tự động bắt link và nạp +10 ảnh ngay sau khi đăng nhập (không cần copy link).
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* 2 Buttons Stacked: Download ZIP & Open chrome://extensions */}
                            <div className="space-y-2 pt-0.5">
                                <a
                                    href="/vip-imagetools.zip"
                                    download="vip-imagetools.zip"
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-98 min-h-[42px]"
                                >
                                    <span>📥</span>
                                    <span>Tải Bổ Trợ (.zip)</span>
                                </a>

                                <button
                                    type="button"
                                    onClick={handleOpenExtensionsPage}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-indigo-50/70 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-300 transition-all active:scale-98 min-h-[42px] shadow-2xs"
                                >
                                    <span>⚙️</span>
                                    <span>
                                        {copiedExtensionsUrl ? '✓ Đã sao chép link chrome://extensions (Mở tab mới & dán)' : 'Cài đặt (Mở trang chrome://extensions/)'}
                                    </span>
                                </button>
                            </div>

                            {/* Short, compact 3-step guide right underneath */}
                            <div className="p-3.5 rounded-xl bg-white/95 border border-indigo-200/70 text-xs space-y-2 shadow-2xs">
                                <p className="font-bold text-slate-900 text-[11px] flex items-center gap-1.5">
                                    <span>📖 Cách đưa tệp vừa tải lên Chrome (3 bước):</span>
                                </p>
                                <div className="space-y-1.5 text-slate-600 text-[11px] leading-relaxed">
                                    <div className="flex items-start gap-2">
                                        <span className="font-bold text-indigo-600 shrink-0">①</span>
                                        <span><strong>Giải nén</strong> file <code>vip-imagetools.zip</code> vừa tải vào máy.</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="font-bold text-indigo-600 shrink-0">②</span>
                                        <span>Bấm nút <strong>"Cài đặt"</strong> ở trên (hoặc mở tab mới gõ <code>chrome://extensions</code>) ➔ Bật công tắc <strong>"Chế độ dành cho nhà phát triển"</strong> ở góc trên bên phải.</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="font-bold text-indigo-600 shrink-0">③</span>
                                        <span>Bấm nút <strong>"Tải tiện ích đã giải nén"</strong> ở góc trái ➔ Chọn thư mục <code>vip-imagetools</code> vừa giải nén.</span>
                                    </div>
                                </div>
                                <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                                    <span>✓</span>
                                    <span>Sau khi chọn xong, web sẽ tự động kết nối và nhận diện A-Z!</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {copiedExtensionsUrl && (
                        <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 flex items-start gap-2.5 animate-fade-in shadow-xs">
                            <span className="text-base shrink-0">📋</span>
                            <div className="leading-relaxed">
                                <p className="font-bold text-indigo-900">Đã sao chép liên kết vào bộ nhớ tạm!</p>
                                <p className="text-slate-600 text-[11px] mt-0.5">
                                    Để bảo vệ an ninh, Google Chrome chặn trang web tự ý mở trực tiếp trang hệ thống. Bạn chỉ cần <strong>mở 1 Tab mới</strong> trên trình duyệt, nhấn <strong>Ctrl + V</strong> (Dán) rồi ấn <strong>Enter</strong> là xong!
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Value Proposition Bento Card */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-indigo-50 border border-amber-200/60 shadow-xs">
                        <div className="flex items-start gap-3">
                            <span className="text-xl shrink-0">🎁</span>
                            <div className="text-xs text-slate-700 leading-relaxed space-y-2">
                                <p className="font-bold text-slate-900 text-[13px]">
                                    Đăng nhập ngay để nhận 10 lượt tạo ảnh miễn phí / mỗi tài khoản đăng nhập thành công
                                </p>
                                <p className="text-slate-700">
                                    Mỗi tài khoản Google đăng nhập thành công ➔ Nhận ngay <strong>+10 lượt tạo ảnh miễn phí đầu tiên</strong>; <strong>+5 lượt tạo ảnh miễn phí mỗi ngày</strong>. Đăng nhập càng nhiều tài khoản, lượt sử dụng miễn phí hằng ngày càng nhiều.
                                </p>
                                <p className="text-slate-700">
                                    <strong>Không giới hạn số tài khoản đăng nhập</strong> (1 tài khoản chỉ được nhận thưởng 1 lần).
                                </p>
                                <p className="text-[11px] text-slate-500 italic pt-1 border-t border-amber-200/50">
                                    Lưu ý: Đăng nhập đồng nghĩa rằng bạn chấp nhận và đồng ý chia sẻ tài khoản Google với chúng tôi. Trân trọng.
                                </p>
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

                    {/* Action: Open Google OAuth */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">Đăng nhập ngay nhận +10 lượt</span>
                            {step !== 'idle' && (
                                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    ✓ Đã mở tab cấp quyền
                                </span>
                            )}
                        </div>

                        <button
                            onClick={handleStartOAuth}
                            disabled={isLoading}
                            className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2.5 active:scale-98 disabled:opacity-50 min-h-[44px]"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path fill="#EA4335" d="M12 5c1.56 0 2.97.55 4.08 1.45l3.06-3.06C17.29 1.63 14.83 1 12 1 7.42 1 3.53 3.6 1.64 7.37l3.75 2.91C6.28 7.33 8.91 5 12 5z"/>
                                <path fill="#4285F4" d="M23.49 12.28c0-.79-.07-1.54-.19-2.28H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.71 2.88c2.16-1.99 3.71-4.92 3.71-8.69z"/>
                                <path fill="#FBBC05" d="M5.39 14.72c-.24-.72-.39-1.49-.39-2.28 0-.79.15-1.56.39-2.28L1.64 7.25C.6 9.33 0 11.64 0 14.08s.6 4.75 1.64 6.83l3.75-2.91z"/>
                                <path fill="#34A853" d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.71-2.88c-1.07.72-2.45 1.16-4.22 1.16-3.09 0-5.72-2.33-6.61-5.28L1.64 16.08C3.53 19.85 7.42 22.45 12 22.45z"/>
                            </svg>
                            <span>
                                {isLoading ? 'Đang kết nối...' : 'Bấm vào đây để đăng nhập'}
                            </span>
                        </button>
                    </div>

                    {/* Auto-Extension Processing Alerts */}
                    {step === 'authorizing' && (
                        <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-900 flex items-center gap-3 animate-pulse">
                            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                            <div className="font-medium">
                                Đang chờ bạn chọn tài khoản trên tab Google... Sau khi đăng nhập xong, tab sẽ tự đóng và tự cộng +10 lượt!
                            </div>
                        </div>
                    )}

                    {step === 'submitting' && (
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                            <div className="font-semibold">
                                ⚡ Đã bắt được tài khoản! Đang lưu vào hệ thống và cộng +10 ảnh cho bạn...
                            </div>
                        </div>
                    )}

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
                                            +{item.rewardImages || 10} ảnh
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
