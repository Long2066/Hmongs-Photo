import React, { useEffect, useRef, useState } from 'react';
import { subscribeToFlowToolUrl } from '../services/flowToolRealtimeService';
import { DEFAULT_FLOW_TOOL_URL, normalizeFlowToolUrl } from '../services/flowToolConfig';

const FLOW_HOME_URL = 'https://flow.google.com/';

type FlowWebview = HTMLElement & { reload: () => void; loadURL: (url: string) => Promise<void> };

/** Shows the original Flow page in Electron, without copying credentials into ImageTool. */
export const FlowEmbeddedPage: React.FC = () => {
    const guestRef = useRef<FlowWebview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState<'home' | 'tool'>('home');
    const [flowUrl, setFlowUrl] = useState(DEFAULT_FLOW_TOOL_URL);
    const [linkNotice, setLinkNotice] = useState('');
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;

    useEffect(() => {
        if (!isElectron) return;
        const guest = guestRef.current;
        if (!guest) return;
        const start = () => { setLoading(true); setError(''); };
        const stop = () => setLoading(false);
        const failed = (event: Event) => {
            const detail = event as Event & { errorCode?: number; errorDescription?: string; isMainFrame?: boolean };
            if (detail.errorCode === -3 || detail.isMainFrame === false) return;
            setError(`Không tải được trang Flow${detail.errorDescription ? `: ${detail.errorDescription}` : '.'}`);
            setLoading(false);
        };
        const crashed = () => { setError('Trang Flow đã ngừng hoạt động. Hãy tải lại trang.'); setLoading(false); };
        guest.addEventListener('did-start-loading', start);
        guest.addEventListener('did-stop-loading', stop);
        guest.addEventListener('did-fail-load', failed);
        guest.addEventListener('render-process-gone', crashed);
        return () => {
            guest.removeEventListener('did-start-loading', start);
            guest.removeEventListener('did-stop-loading', stop);
            guest.removeEventListener('did-fail-load', failed);
            guest.removeEventListener('render-process-gone', crashed);
        };
    }, [isElectron]);

    useEffect(() => subscribeToFlowToolUrl(value => {
        const valid = value ? normalizeFlowToolUrl(value) : DEFAULT_FLOW_TOOL_URL;
        if (!valid) { setLinkNotice('Link Flow trong cấu hình Admin không hợp lệ; giữ nguyên trang đang mở.'); return; }
        setLinkNotice('');
        setFlowUrl(previous => previous === valid ? previous : valid);
    }, () => setLinkNotice('Không đồng bộ được link Flow mới. Đang giữ link gần nhất.')), []);

    useEffect(() => {
        if (page !== 'tool' || !guestRef.current || !isElectron) return;
        setError('');
        setLoading(true);
        guestRef.current.loadURL(flowUrl).catch(reason => {
            setError(reason instanceof Error ? reason.message : 'Không thể mở link Flow mới.');
            setLoading(false);
        });
    }, [flowUrl, isElectron]);

    const navigateTo = (destination: 'home' | 'tool') => {
        setError('');
        setLoading(true);
        setPage(destination);
        guestRef.current?.loadURL(destination === 'home' ? FLOW_HOME_URL : flowUrl).catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : 'Không thể mở trang Flow.');
            setLoading(false);
        });
    };

    const openExternally = () => {
        if (isElectron) (window as any).electronAPI.openExternal(flowUrl);
        else window.open(flowUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <section className="relative z-10 flex min-h-0 flex-1 flex-col bg-slate-50" aria-label="Trang tạo video Flow">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-2 shadow-sm ring-1 ring-slate-900/5 sm:px-6">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold leading-tight text-slate-900">Tạo Video · Flow</h2>
                    <p className="text-xs leading-relaxed text-slate-600">Đăng nhập trên Flow trước, sau đó mở tool đã chia sẻ</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {isElectron && <button type="button" onClick={() => navigateTo('home')} disabled={loading && page === 'home'} className="min-h-[44px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">Trang chủ Flow</button>}
                    {isElectron && <button type="button" onClick={() => navigateTo('tool')} disabled={loading && page === 'tool'} className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">Mở tool sau đăng nhập</button>}
                    {isElectron && <button type="button" onClick={() => { setError(''); setLoading(true); guestRef.current?.reload(); }} className="min-h-[44px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]">Tải lại</button>}
                    <button type="button" onClick={openExternally} className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]">Mở trong trình duyệt</button>
                </div>
            </div>
            {linkNotice && <p role="alert" className="bg-amber-50 p-3 text-sm font-medium text-amber-900">{linkNotice}</p>}
            {isElectron ? (
                <div className="relative min-h-0 flex-1 bg-white">
                    {React.createElement('webview', {
                        ref: guestRef,
                        partition: 'persist:flow-embedded',
                        src: FLOW_HOME_URL,
                        style: { display: 'flex', width: '100%', height: '100%' },
                        'aria-label': 'Trang Flow chính thức'
                    })}
                    {loading && !error && <div role="status" className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-white/95 p-4 text-sm font-medium text-slate-700 shadow-sm"><span className="h-4 w-4 animate-pulse rounded-full bg-indigo-500" />Đang tải trang Flow…</div>}
                    {error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center"><span className="text-3xl" aria-hidden="true">🌐</span><p className="max-w-md text-sm font-semibold leading-relaxed text-slate-900">{error}</p><button type="button" onClick={() => { setError(''); setLoading(true); guestRef.current?.reload(); }} className="min-h-[44px] rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]">Thử tải lại</button></div>}
                </div>
            ) : (
                <div className="m-4 flex min-h-64 flex-1 flex-col items-center justify-center gap-4 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-900/5"><span className="text-3xl" aria-hidden="true">🎬</span><h3 className="text-base font-semibold text-slate-900">Flow không hỗ trợ nhúng trên web</h3><p className="max-w-lg text-sm leading-relaxed text-slate-600">Trình duyệt không thể nhúng trang Flow vào ImageTool. Hãy mở trang gốc để tự đăng nhập và tạo video.</p><button type="button" onClick={openExternally} className="min-h-[44px] rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]">Mở trang Flow</button></div>
            )}
        </section>
    );
};
