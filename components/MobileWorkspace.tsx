/**
 * Mobile Workspace Component
 * Single scrollable page for mobile with:
 * - 4 input slots at top (2x2 grid)
 * - Config section below
 * - Results at bottom (2 columns grid)
 */

import React from 'react';

interface MobileWorkspaceProps {
    // Input section
    inputContent: React.ReactNode;
    // Config section
    configContent: React.ReactNode;
    // Results section
    results: string[]; // base64 images
    onResultClick: (url: string, index: number) => void;
    // Generate button
    onGenerate: () => void;
    isLoading: boolean;
    // Prompt input
    prompt: string;
    onPromptChange: (value: string) => void;
}

export const MobileWorkspace: React.FC<MobileWorkspaceProps> = ({
    inputContent,
    configContent,
    results,
    onResultClick,
    onGenerate,
    isLoading,
    prompt,
    onPromptChange
}) => {
    return (
        <div className="lg:hidden flex flex-col min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-6">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/95 border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">ImageTool</h1>
                        <p className="text-xs text-slate-500">AI Image Studio</p>
                    </div>
                </div>
            </div>

            {/* Main Content - Scrollable */}
            <div className="flex-1 px-4 py-4 space-y-4">

                {/* Section: Input Images */}
                <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Ảnh đầu vào
                    </h2>
                    {/* 2x2 Grid for inputs */}
                    <div className="grid grid-cols-2 gap-3">
                        {inputContent}
                    </div>
                </section>

                {/* Section: Prompt */}
                <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Mô tả
                    </h2>
                    <textarea
                        value={prompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                        placeholder="Mô tả ảnh bạn muốn tạo..."
                        className="w-full h-20 px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                    />
                </section>

                {/* Section: Config */}
                <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Cấu hình
                    </h2>
                    <div className="space-y-3">
                        {configContent}
                    </div>
                </section>

                {/* Generate Button */}
                <button
                    onClick={onGenerate}
                    disabled={isLoading}
                    className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${isLoading
                        ? 'bg-slate-400 text-slate-200 cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white hover:shadow-xl active:scale-[0.98]'
                        }`}
                >
                    {isLoading ? (
                        <>
                            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Đang tạo...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                            <span>Tạo ảnh AI</span>
                        </>
                    )}
                </button>

                {/* Section: Results */}
                {results.length > 0 && (
                    <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Kết quả ({results.length})
                        </h2>
                        {/* 2 column grid for results */}
                        <div className="grid grid-cols-2 gap-3">
                            {results.map((base64, index) => (
                                <div
                                    key={index}
                                    onClick={() => onResultClick(base64, index)}
                                    className="relative aspect-square rounded-xl overflow-hidden border-2 border-slate-200 hover:border-indigo-400 transition-all cursor-pointer group"
                                >
                                    <img
                                        src={`data:image/png;base64,${base64}`}
                                        alt={`Result ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    {/* Overlay with download hint */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                                            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                        </div>
                                    </div>
                                    {/* Index badge */}
                                    <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-lg">
                                        {index + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};
