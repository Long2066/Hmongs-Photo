import React, { useEffect, useState } from 'react';
import { ExternalLink, Save } from 'lucide-react';
import { getFlowToolUrl, saveFlowToolUrl } from '../services/adminFirebaseService';
import { DEFAULT_FLOW_TOOL_URL, normalizeFlowToolUrl } from '../services/flowToolConfig';
import type { AdminUser } from '../services/adminAuthService';

export const FlowToolLinkManager: React.FC<{ admin: AdminUser }> = ({ admin }) => {
    const [url, setUrl] = useState(DEFAULT_FLOW_TOOL_URL);
    const [savedUrl, setSavedUrl] = useState(DEFAULT_FLOW_TOOL_URL);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        let mounted = true;
        getFlowToolUrl().then(value => {
            if (!mounted) return;
            const valid = value ? normalizeFlowToolUrl(value) : null;
            if (valid) { setUrl(valid); setSavedUrl(valid); }
            else if (value) setError('Link đã lưu không hợp lệ; đang hiển thị link mặc định.');
        }).catch(reason => {
            if (mounted) { setLoadFailed(true); setError(`Không đọc được link đã lưu: ${reason instanceof Error ? reason.message : 'Lỗi không xác định'}. Chưa thể lưu link mới.`); }
        }).finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, []);

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (loadFailed) return;
        setError(''); setMessage('');
        const valid = normalizeFlowToolUrl(url);
        if (!valid) { setError('Chỉ chấp nhận https://flow.google.com/shared/tool/ theo sau là mã tool hợp lệ; không chứa tham số.'); return; }
        if (!admin.email) { setError('Cần đăng nhập Admin để lưu link.'); return; }
        setSaving(true);
        try {
            await saveFlowToolUrl(valid, admin.email);
            setUrl(valid); setSavedUrl(valid);
            setMessage('Đã lưu. ImageTool sẽ nhận link mới khi có kết nối.');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Không lưu được link.');
        } finally { setSaving(false); }
    };

    return (
        <section aria-labelledby="flow-link-title" style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <h2 id="flow-link-title" style={{ margin: 0, color: '#0f172a', fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.3 }}>Link công cụ Tạo Video (Flow)</h2>
            <p style={{ margin: '8px 0 20px', color: '#475569', fontSize: '0.875rem', lineHeight: 1.6 }}>Dán link chia sẻ mới để thay trang trong ImageTool mà không phải phát hành lại ứng dụng. Việc lưu link không cấp quyền truy cập Google cho người dùng.</p>
            <form onSubmit={save} style={{ display: 'grid', gap: '12px' }}>
                <label htmlFor="flow-tool-link" style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem' }}>URL chia sẻ tool</label>
                <input id="flow-tool-link" type="url" inputMode="url" value={url} onChange={event => { setUrl(event.target.value); setMessage(''); if (!loadFailed) setError(''); }} disabled={loading || saving} autoComplete="off" spellCheck={false} placeholder={DEFAULT_FLOW_TOOL_URL} className="flow-tool-url-input" style={{ width: '100%', minWidth: 0, minHeight: '48px', borderRadius: '12px', padding: '12px 16px', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.875rem', background: '#fff', boxSizing: 'border-box' }} />
                {error && <p role="alert" style={{ margin: 0, color: '#9f1239', fontSize: '0.875rem', lineHeight: 1.5 }}>{error}</p>}
                {message && <p role="status" style={{ margin: 0, color: '#047857', fontSize: '0.875rem', lineHeight: 1.5 }}>{message}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button type="submit" disabled={loading || saving || loadFailed || normalizeFlowToolUrl(url) === savedUrl} className="btn btn-primary" style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Save size={16} />{saving ? 'Đang lưu...' : 'Lưu link Flow'}</button>
                    <button type="button" onClick={() => { const valid = normalizeFlowToolUrl(url); if (valid) window.open(valid, '_blank', 'noopener,noreferrer'); else setError('Hãy nhập link hợp lệ trước khi mở thử.'); }} className="btn btn-secondary" style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><ExternalLink size={16} />Mở thử link</button>
                </div>
            </form>
        </section>
    );
};
