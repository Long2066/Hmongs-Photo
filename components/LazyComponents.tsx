/**
 * Lazy loaded components for better performance
 * These components are loaded only when needed, reducing initial bundle size
 */
import React, { Suspense, lazy } from 'react';

// Loading spinner component
export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Đang tải...' }) => (
    <div className="flex flex-col items-center justify-center p-8 gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">{message}</p>
    </div>
);

// Lazy load heavy components
export const LazySupportHub = lazy(() => import('./SupportHub').then(m => ({ default: m.SupportHub })));
export const LazyCreditsPurchaseModal = lazy(() => import('./CreditsPurchaseModal').then(m => ({ default: m.CreditsPurchaseModal })));
export const LazyA4PrintPreview = lazy(() => import('./A4PrintPreview').then(m => ({ default: m.A4PrintPreview })));
export const LazyComparisonSlider = lazy(() => import('./ComparisonSlider').then(m => ({ default: m.ComparisonSlider })));
export const LazyImagePreviewModal = lazy(() => import('./ImagePreviewModal').then(m => ({ default: m.ImagePreviewModal })));
export const LazyDownloadHelpModal = lazy(() => import('./DownloadHelpModal').then(m => ({ default: m.DownloadHelpModal })));
export const LazyApiKeyModal = lazy(() => import('./ApiKeyModal').then(m => ({ default: m.ApiKeyModal })));
export const LazyAuthModal = lazy(() => import('./AuthModal').then(m => ({ default: m.AuthModal })));
export const LazyProfilePage = lazy(() => import('./ProfilePage').then(m => ({ default: m.ProfilePage })));

// Suspense wrapper for lazy components
interface LazyWrapperProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export const LazyWrapper: React.FC<LazyWrapperProps> = ({ children, fallback }) => (
    <Suspense fallback={fallback || <LoadingSpinner />}>
        {children}
    </Suspense>
);

export default {
    LazySupportHub,
    LazyCreditsPurchaseModal,
    LazyA4PrintPreview,
    LazyComparisonSlider,
    LazyImagePreviewModal,
    LazyDownloadHelpModal,
    LazyApiKeyModal,
    LazyAuthModal,
    LazyProfilePage,
    LazyWrapper,
    LoadingSpinner
};
