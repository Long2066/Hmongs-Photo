import React, { useState } from 'react';
import { downloadImage } from '../services/downloadService';

export interface VideoEntry {
    url: string;
    firstFrame?: string;
    createdAt: number;
}

interface VideoWorkspaceProps {
    videos: VideoEntry[];
    isLoading: boolean;
    loadingStatus: string;
    error: string | null;
}
/** Playback and download stay inside ImageTool; this does not embed or sign into Google Flow. */
export const VideoWorkspace: React.FC<VideoWorkspaceProps> = ({ videos, isLoading, loadingStatus, error }) => {
    const [selectedUrl, setSelectedUrl] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [downloadMessage, setDownloadMessage] = useState('');

    const active = videos.find(item => item.url === selectedUrl) || videos[0];
    const frameSrc = active?.firstFrame
        ? active.firstFrame.startsWith('data:') || /^https?:\/\//i.test(active.firstFrame)
            ? active.firstFrame
            : `data:image/png;base64,${active.firstFrame}`
        : null;

    const handleDownload = async () => {
        if (!active || downloading) return;
        setDownloading(true);
        setDownloadMessage('');
        try {
            const filename = `imagetool_video_${active.createdAt}.mp4`;
            let result;
            if (!(window as any).electronAPI?.isElectron && /^https?:\/\//i.test(active.url)) {
                const response = await fetch(active.url);
                if (!response.ok) throw new Error(`Không tải được video (HTTP ${response.status}).`);
                const blobUrl = URL.createObjectURL(await response.blob());
                try {
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    result = { success: true, message: 'Đã bắt đầu tải video.' };
                } finally {
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                }
            } else {
                result = await downloadImage(active.url, filename);
            }
            setDownloadMessage(result.success ? (result.message || 'Đã lưu video.') : (result.message || 'Không thể lưu video.'));
        } catch (err) {
            setDownloadMessage(err instanceof Error ? err.message : 'Không thể tải video.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <section className="w-full max-w-6xl mx-auto space-y-6" aria-label="Video AI Studio">
            <div className="rounded-2xl bg-slate-900 p-4 sm:p-6 text-white shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-xl" aria-hidden="true">🎬</span>
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Video AI Studio</h2>
                        <p className="mt-1 text-sm leading-relaxed text-slate-300">Tạo, xem và tải video ngay trong ImageTool</p>
                    </div>
                </div>
            </div>

            {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-medium leading-relaxed text-rose-800 ring-1 ring-rose-900/10">{error}</div>}

            {isLoading && (
                <div role="status" className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm ring-1 ring-slate-900/5">
                    <p className="text-sm font-semibold text-slate-900">{loadingStatus || 'Đang tạo video...'}</p>
                    <p className="mt-1 text-xs text-slate-600">Quá trình xử lý có thể mất vài phút.</p>
                    <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-amber-100" />
                </div>
            )}

            {active ? (
                <>
                    <div className="grid grid-cols-1 gap-4 rounded-2xl bg-slate-800 p-4 shadow-sm ring-1 ring-slate-900/10 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)] lg:gap-6 lg:p-6">
                        <div className="min-w-0 overflow-hidden rounded-xl bg-slate-950">
                            <video key={active.url} src={active.url} controls playsInline preload="metadata" className="aspect-video w-full bg-slate-950 object-contain" aria-label="Phát video đã tạo">
                                Trình duyệt không hỗ trợ phát video này.
                            </video>
                        </div>
                        <div className="flex min-w-0 flex-col gap-4 text-white">
                            <div>
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">Khung hình gốc (First Frame)</h3>
                                    <span className="text-xs font-medium text-emerald-300">Đã render</span>
                                </div>
                                {frameSrc ? (
                                    <img src={frameSrc} alt="Ảnh nguồn của video" className="mt-3 aspect-video w-full rounded-xl bg-slate-950 object-contain" />
                                ) : (
                                    <div className="mt-3 flex aspect-video items-center justify-center rounded-xl bg-slate-700 p-4 text-center text-sm text-slate-200">Video tạo không kèm ảnh nguồn</div>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-2 text-sm text-slate-200">
                                <span>Định dạng tải</span><span className="font-mono tabular-nums font-semibold text-white">MP4</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-sm text-slate-200">
                                <span>Thời gian nhận</span><time className="font-mono tabular-nums text-right font-semibold text-white">{new Date(active.createdAt).toLocaleTimeString('vi-VN')}</time>
                            </div>
                            <button type="button" onClick={handleDownload} disabled={downloading} className="min-h-[44px] w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                                {downloading ? 'Đang lưu video...' : '↓ Tải video này về máy'}
                            </button>
                            {downloadMessage && <p role="status" className="text-sm leading-relaxed text-amber-100">{downloadMessage}</p>}
                        </div>
                    </div>
                    <div>
                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700">Video trong phiên này ({videos.length})</h3>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                            {videos.map((item, index) => (
                                <button key={item.url} type="button" onClick={() => { setSelectedUrl(item.url); setDownloadMessage(''); }} aria-current={item.url === active.url ? 'true' : undefined} className={`min-h-[88px] overflow-hidden rounded-xl bg-slate-800 text-left text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98] ${item.url === active.url ? 'ring-2 ring-amber-500' : 'ring-1 ring-slate-900/10'}`}>
                                    {item.firstFrame ? <img src={item.firstFrame.startsWith('data:') || /^https?:\/\//i.test(item.firstFrame) ? item.firstFrame : `data:image/png;base64,${item.firstFrame}`} alt="" className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center bg-slate-700 text-lg" aria-hidden="true">▶</div>}
                                    <span className="block truncate px-3 py-2 text-xs font-semibold">Video #{videos.length - index}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            ) : !isLoading && !error ? (
                <div className="flex flex-col items-center rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-900/5">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-2xl" aria-hidden="true">🎞️</span>
                    <h3 className="mt-4 text-base font-semibold text-slate-900">Chưa có video</h3>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">Chọn model và ảnh nguồn ở bảng cấu hình, sau đó nhấn Tạo video. Video hoàn thành sẽ hiển thị tại đây.</p>
                    <button type="button" onClick={() => Array.from(document.querySelectorAll<HTMLElement>('[data-video-config]')).find(element => element.getClientRects().length > 0)?.scrollIntoView({ behavior: 'smooth' })} className="mt-5 min-h-[44px] rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]">Đi tới cấu hình video</button>
                </div>
            ) : null}
        </section>
    );
};
