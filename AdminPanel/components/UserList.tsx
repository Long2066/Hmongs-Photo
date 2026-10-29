import React, { useEffect, useState } from 'react';
import {
    Search,
    Download,
    RefreshCw,
    Edit2,
    Lock,
    Unlock,
    Users,
    AlertCircle
} from 'lucide-react';
import { getAllUsers, UserData } from '../services/adminFirebaseService';
import UserEditModal from './UserEditModal';
import * as XLSX from 'xlsx';

const UserList: React.FC = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getAllUsers();
            setUsers(data);
            setFilteredUsers(data);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredUsers(users);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredUsers(users.filter(user =>
                user.displayName.toLowerCase().includes(query) ||
                (user.email && user.email.toLowerCase().includes(query))
            ));
        }
    }, [searchQuery, users]);

    const handleExportExcel = () => {
        const exportData = users.map(user => ({
            'Email': user.email || '-',
            'Tên': user.displayName,
            'Số dư (VNĐ)': user.credits,
            'Trạng thái': user.isLocked ? 'Đã khóa' : 'Hoạt động',
            'Ngày đăng ký': user.registeredAt
                ? new Date(user.registeredAt).toLocaleDateString('vi-VN')
                : '-',
            'Cập nhật lần cuối': user.lastUpdated
                ? new Date(user.lastUpdated).toLocaleDateString('vi-VN')
                : '-'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Users');

        // Auto-size columns
        const colWidths = [
            { wch: 30 }, // Email
            { wch: 20 }, // Tên
            { wch: 15 }, // Số dư
            { wch: 12 }, // Trạng thái
            { wch: 15 }, // Ngày đăng ký
            { wch: 18 }, // Cập nhật
        ];
        ws['!cols'] = colWidths;

        XLSX.writeFile(wb, `users_toolphoto_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleUserUpdated = () => {
        fetchUsers();
        setSelectedUser(null);
    };

    const formatDate = (timestamp?: number) => {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatVND = (amount: number) => {
        return amount.toLocaleString('vi-VN') + 'đ';
    };

    return (
        <div className="user-list-container">
            <div className="page-header">
                <h1>Quản lý Users</h1>
                <p>Danh sách tất cả người dùng đã đăng ký</p>
            </div>

            <div className="toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo email hoặc tên..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <button className="btn btn-success" onClick={handleExportExcel} disabled={users.length === 0}>
                    <Download size={18} />
                    Export Excel
                </button>

                <button className="btn btn-secondary" onClick={fetchUsers} disabled={loading}>
                    <RefreshCw size={18} className={loading ? 'loading-spinner' : ''} />
                    Làm mới
                </button>
            </div>

            <div className="data-table">
                <div className="table-header">
                    <span>Người dùng</span>
                    <span>Email</span>
                    <span>Số dư (VNĐ)</span>
                    <span>Trạng thái</span>
                    <span>Ngày ĐK</span>
                    <span>Thao tác</span>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="empty-state">
                        {searchQuery ? (
                            <>
                                <AlertCircle size={48} />
                                <h3>Không tìm thấy kết quả</h3>
                                <p>Thử tìm kiếm với từ khóa khác</p>
                            </>
                        ) : (
                            <>
                                <Users size={48} />
                                <h3>Chưa có users</h3>
                                <p>Danh sách users sẽ hiển thị ở đây</p>
                            </>
                        )}
                    </div>
                ) : (
                    filteredUsers.map(user => (
                        <div key={user.id} className="table-row">
                            <div className="user-info">
                                <div className="user-avatar">
                                    {user.displayName[0]?.toUpperCase() || '?'}
                                </div>
                                <div className="user-details">
                                    <h4>{user.displayName}</h4>
                                    <p>{user.id.substring(0, 8)}...</p>
                                </div>
                            </div>

                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                {user.email || '-'}
                            </span>

                            <span className="credits-display">
                                {formatVND(user.credits)}
                            </span>

                            <span className={`status-badge ${user.isLocked ? 'locked' : 'active'}`}>
                                {user.isLocked ? (
                                    <>
                                        <Lock size={12} />
                                        Đã khóa
                                    </>
                                ) : (
                                    <>
                                        <Unlock size={12} />
                                        Hoạt động
                                    </>
                                )}
                            </span>

                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {formatDate(user.registeredAt)}
                            </span>

                            <div className="action-btns">
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setSelectedUser(user)}
                                    title="Chỉnh sửa"
                                >
                                    <Edit2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <p style={{
                marginTop: '16px',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                textAlign: 'right'
            }}>
                Hiển thị {filteredUsers.length} / {users.length} users
            </p>

            {/* Edit Modal */}
            {selectedUser && (
                <UserEditModal
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                    onUpdated={handleUserUpdated}
                />
            )}
        </div>
    );
};

export default UserList;
