/**
 * ClothingManager.tsx
 * Trang Admin để upload và quản lý thư viện trang phục
 * UI được thiết kế chuyên nghiệp, dễ thao tác
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    ClothingTemplate,
    ClothingCategory,
    ClothingGender,
    CATEGORY_LABELS,
    GENDER_LABELS,
    getAllTemplates,
    saveTemplate,
    deleteTemplate,
    toggleTemplateActive,
    compressImage,
    createThumbnail,
    getBase64SizeKB
} from '../services/clothingTemplateService';
import { Trash2, Plus, Edit2, Eye, EyeOff, Save, X, Upload, Image } from 'lucide-react';

const ClothingManager: React.FC = () => {
    const [templates, setTemplates] = useState<ClothingTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingTemplate, setEditingTemplate] = useState<Partial<ClothingTemplate> | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [filterGender, setFilterGender] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        const data = await getAllTemplates();
        setTemplates(data);
        setLoading(false);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            // Lưu ảnh chất lượng cao (1200px, 95%) để AI sử dụng
            const compressed = await compressImage(base64, 1200, 0.95);
            // Thumbnail lớn hơn để hiển thị rõ trong grid
            const thumbnail = await createThumbnail(base64, 250);

            setEditingTemplate((prev: Partial<ClothingTemplate> | null) => ({
                ...prev,
                imageBase64: compressed,
                thumbnailBase64: thumbnail
            }));
            setPreviewImage(`data:image/jpeg;base64,${compressed}`);
        };
        reader.readAsDataURL(file);
    };

    const handleAddNew = () => {
        setEditingTemplate({
            name: '',
            category: 'vest',
            gender: 'male',
            description: '',
            isActive: true,
            sortOrder: templates.length + 1
        });
        setPreviewImage(null);
        setIsModalOpen(true);
    };

    const handleEdit = (template: ClothingTemplate) => {
        setEditingTemplate(template);
        setPreviewImage(template.imageBase64 ? `data:image/jpeg;base64,${template.imageBase64}` : null);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!editingTemplate?.name || !editingTemplate?.imageBase64) {
            alert('Vui lòng nhập tên và upload ảnh trang phục');
            return;
        }

        setSaving(true);
        try {
            await saveTemplate(editingTemplate as any);
            await loadTemplates();
            setIsModalOpen(false);
            setEditingTemplate(null);
            setPreviewImage(null);
        } catch (error) {
            alert('Lỗi khi lưu: ' + (error as Error).message);
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa trang phục này?')) return;
        try {
            await deleteTemplate(id);
            await loadTemplates();
        } catch (error) {
            alert('Lỗi khi xóa: ' + (error as Error).message);
        }
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            await toggleTemplateActive(id, !currentStatus);
            await loadTemplates();
        } catch (error) {
            alert('Lỗi: ' + (error as Error).message);
        }
    };

    // Filter templates
    const filteredTemplates = templates.filter(t => {
        if (filterGender !== 'all' && t.gender !== filterGender) return false;
        if (filterCategory !== 'all' && t.category !== filterCategory) return false;
        return true;
    });

    const stats = {
        total: templates.length,
        active: templates.filter(t => t.isActive).length,
        male: templates.filter(t => t.gender === 'male').length,
        female: templates.filter(t => t.gender === 'female').length,
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header Section */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '16px',
                padding: '24px 32px',
                marginBottom: '24px',
                color: 'white',
                boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
                            👔 Thư viện Trang phục
                        </h1>
                        <p style={{ opacity: 0.9, fontSize: '14px' }}>
                            Quản lý trang phục mẫu cho tính năng Ảnh thẻ AI
                        </p>
                    </div>
                    <button
                        onClick={handleAddNew}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            background: 'white',
                            color: '#667eea',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                            transition: 'transform 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <Plus size={20} />
                        Thêm trang phục
                    </button>
                </div>

                {/* Stats Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '16px',
                    marginTop: '24px'
                }}>
                    {[
                        { label: 'Tổng cộng', value: stats.total, icon: '📦', bg: 'rgba(255,255,255,0.2)' },
                        { label: 'Đang hiển thị', value: stats.active, icon: '✅', bg: 'rgba(16,185,129,0.3)' },
                        { label: 'Nam', value: stats.male, icon: '👨', bg: 'rgba(59,130,246,0.3)' },
                        { label: 'Nữ', value: stats.female, icon: '👩', bg: 'rgba(236,72,153,0.3)' },
                    ].map((stat, i) => (
                        <div key={i} style={{
                            background: stat.bg,
                            borderRadius: '12px',
                            padding: '16px',
                            backdropFilter: 'blur(10px)'
                        }}>
                            <div style={{ fontSize: '24px', marginBottom: '4px' }}>{stat.icon}</div>
                            <div style={{ fontSize: '28px', fontWeight: '700' }}>{stat.value}</div>
                            <div style={{ fontSize: '12px', opacity: 0.8 }}>{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '24px',
                padding: '16px',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                        Lọc theo giới tính
                    </label>
                    <select
                        value={filterGender}
                        onChange={(e) => setFilterGender(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '14px',
                            background: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="all">Tất cả</option>
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                        <option value="unisex">Unisex</option>
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                        Lọc theo danh mục
                    </label>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '14px',
                            background: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="all">Tất cả danh mục</option>
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label as string}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                        onClick={() => { setFilterGender('all'); setFilterCategory('all'); }}
                        style={{
                            padding: '10px 16px',
                            background: '#f1f5f9',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            color: '#64748b',
                            cursor: 'pointer'
                        }}
                    >
                        Xóa bộ lọc
                    </button>
                </div>
            </div>

            {/* Templates Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                    <p>Đang tải dữ liệu...</p>
                </div>
            ) : filteredTemplates.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '60px',
                    background: 'white',
                    borderRadius: '16px',
                    border: '2px dashed #e2e8f0'
                }}>
                    <div style={{ fontSize: '64px', marginBottom: '16px' }}>👔</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                        {templates.length === 0 ? 'Chưa có trang phục nào' : 'Không tìm thấy kết quả'}
                    </h3>
                    <p style={{ color: '#64748b', marginBottom: '24px' }}>
                        {templates.length === 0 ? 'Hãy thêm trang phục đầu tiên để bắt đầu' : 'Thử thay đổi bộ lọc'}
                    </p>
                    {templates.length === 0 && (
                        <button
                            onClick={handleAddNew}
                            style={{
                                padding: '12px 24px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            <Plus size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Thêm trang phục đầu tiên
                        </button>
                    )}
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '20px'
                }}>
                    {filteredTemplates.map(template => (
                        <div
                            key={template.id}
                            style={{
                                background: 'white',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                opacity: template.isActive ? 1 : 0.6,
                                position: 'relative'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.12)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.08)';
                            }}
                        >
                            {/* Status Badge */}
                            {!template.isActive && (
                                <div style={{
                                    position: 'absolute',
                                    top: '12px',
                                    right: '12px',
                                    background: '#ef4444',
                                    color: 'white',
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    zIndex: 10
                                }}>
                                    Đang ẩn
                                </div>
                            )}

                            {/* Image */}
                            <div style={{
                                aspectRatio: '3/4',
                                background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {(template.thumbnailBase64 || template.imageBase64) ? (
                                    <img
                                        src={`data:image/jpeg;base64,${template.thumbnailBase64 || template.imageBase64}`}
                                        alt={template.name}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#cbd5e1'
                                    }}>
                                        <Image size={48} />
                                    </div>
                                )}

                                {/* Overlay Badges */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '8px',
                                    left: '8px',
                                    display: 'flex',
                                    gap: '6px'
                                }}>
                                    <span style={{
                                        background: template.gender === 'male' ? '#3b82f6' : template.gender === 'female' ? '#ec4899' : '#8b5cf6',
                                        color: 'white',
                                        padding: '4px 10px',
                                        borderRadius: '20px',
                                        fontSize: '11px',
                                        fontWeight: '600'
                                    }}>
                                        {GENDER_LABELS[template.gender]}
                                    </span>
                                </div>

                                {/* Size */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '8px',
                                    right: '8px',
                                    background: 'rgba(0,0,0,0.6)',
                                    color: 'white',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '10px'
                                }}>
                                    {getBase64SizeKB(template.imageBase64)} KB
                                </div>
                            </div>

                            {/* Info */}
                            <div style={{ padding: '16px' }}>
                                <h3 style={{
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#1e293b',
                                    marginBottom: '4px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {template.name}
                                </h3>
                                <p style={{
                                    fontSize: '12px',
                                    color: '#64748b',
                                    marginBottom: '12px'
                                }}>
                                    {CATEGORY_LABELS[template.category]}
                                </p>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => handleEdit(template)}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            padding: '8px',
                                            background: '#f1f5f9',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            fontWeight: '500',
                                            color: '#475569',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Edit2 size={14} />
                                        Sửa
                                    </button>
                                    <button
                                        onClick={() => handleToggleActive(template.id, template.isActive)}
                                        style={{
                                            padding: '8px 12px',
                                            background: template.isActive ? '#dcfce7' : '#fef2f2',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: template.isActive ? '#16a34a' : '#dc2626',
                                            cursor: 'pointer'
                                        }}
                                        title={template.isActive ? 'Click để ẩn' : 'Click để hiện'}
                                    >
                                        {template.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(template.id)}
                                        style={{
                                            padding: '8px 12px',
                                            background: '#fef2f2',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: '#dc2626',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '500px',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                                    {editingTemplate?.id ? '✏️ Chỉnh sửa trang phục' : '➕ Thêm trang phục mới'}
                                </h2>
                                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                                    Upload ảnh và điền thông tin bên dưới
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#f1f5f9',
                                    border: 'none',
                                    borderRadius: '10px',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '24px' }}>
                            {/* Image Upload */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '8px'
                                }}>
                                    Ảnh trang phục <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                />
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        border: '2px dashed #d1d5db',
                                        borderRadius: '16px',
                                        padding: '24px',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        background: previewImage ? 'white' : '#f9fafb',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {previewImage ? (
                                        <div>
                                            <img
                                                src={previewImage}
                                                alt="Preview"
                                                style={{
                                                    maxHeight: '200px',
                                                    borderRadius: '12px',
                                                    marginBottom: '12px'
                                                }}
                                            />
                                            <p style={{ fontSize: '12px', color: '#64748b' }}>
                                                📦 {editingTemplate?.imageBase64 ? getBase64SizeKB(editingTemplate.imageBase64) : 0} KB • Click để thay đổi
                                            </p>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '20px' }}>
                                            <Upload size={40} style={{ color: '#9ca3af', marginBottom: '12px' }} />
                                            <p style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                                                Click để upload ảnh
                                            </p>
                                            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                                                PNG, JPG (Khuyến nghị: ảnh nền trắng/trong suốt)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Name */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '8px'
                                }}>
                                    Tên trang phục <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <input
                                    type="text"
                                    value={editingTemplate?.name || ''}
                                    onChange={e => setEditingTemplate((prev: Partial<ClothingTemplate> | null) => ({ ...prev, name: e.target.value }))}
                                    placeholder="VD: Vest đen nam cao cấp"
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '12px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                />
                            </div>

                            {/* Category & Gender */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: '#374151',
                                        marginBottom: '8px'
                                    }}>
                                        Danh mục
                                    </label>
                                    <select
                                        value={editingTemplate?.category || 'vest'}
                                        onChange={e => setEditingTemplate((prev: Partial<ClothingTemplate> | null) => ({ ...prev, category: e.target.value as ClothingCategory }))}
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            background: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label as string}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: '#374151',
                                        marginBottom: '8px'
                                    }}>
                                        Giới tính
                                    </label>
                                    <select
                                        value={editingTemplate?.gender || 'male'}
                                        onChange={e => setEditingTemplate((prev: Partial<ClothingTemplate> | null) => ({ ...prev, gender: e.target.value as ClothingGender }))}
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            background: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {Object.entries(GENDER_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label as string}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '8px'
                                }}>
                                    Mô tả (tùy chọn)
                                </label>
                                <textarea
                                    value={editingTemplate?.description || ''}
                                    onChange={e => setEditingTemplate((prev: Partial<ClothingTemplate> | null) => ({ ...prev, description: e.target.value }))}
                                    placeholder="Mô tả chi tiết về trang phục để AI hiểu rõ hơn..."
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '12px',
                                        fontSize: '14px',
                                        resize: 'vertical',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Sort Order */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '8px'
                                }}>
                                    Thứ tự hiển thị
                                </label>
                                <input
                                    type="number"
                                    value={editingTemplate?.sortOrder || 1}
                                    onChange={e => setEditingTemplate((prev: Partial<ClothingTemplate> | null) => ({ ...prev, sortOrder: parseInt(e.target.value) || 1 }))}
                                    min={1}
                                    style={{
                                        width: '100px',
                                        padding: '12px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '12px',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '16px 24px',
                            borderTop: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px',
                            background: '#f8fafc'
                        }}>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                style={{
                                    padding: '12px 24px',
                                    background: 'white',
                                    border: '2px solid #e5e7eb',
                                    borderRadius: '10px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    cursor: 'pointer'
                                }}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                style={{
                                    padding: '12px 24px',
                                    background: saving ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: 'white',
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                {saving ? (
                                    <>⏳ Đang lưu...</>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Lưu trang phục
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClothingManager;
