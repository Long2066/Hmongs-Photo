/**
 * Poster & Catalog Studio Rendering Engine (v2.25.51)
 * Client-side High-DPI Canvas 2D Graphic Engine
 * 60 distinct studio-grade poster templates:
 * - 15 Kỷ Yếu 9:16 (Khổ Dọc Mobile / Story / TikTok)
 * - 15 Kỷ Yếu 16:9 (Khổ Ngang Màn Hình PC / TV / Banner)
 * - 15 Phim Ảnh 9:16 (Khổ Dọc Poster Rạp / WeTV / VieON / OTT)
 * - 15 Phim Ảnh 16:9 (Khổ Ngang Màn Bạc Cinema 2.39:1 / YouTube / TV Series)
 * Zero API cost, instant client-side rendering (0.2s - 0.4s).
 */

import { detectFacesInImage, calculateSmartCrop, type FaceBox } from './aiFaceDetectService';

export type PosterCategory = 'ky_yeu' | 'phim_anh';
export type PosterAspectRatio = '9:16' | '16:9';

export type PosterTemplateId =
    // --- 1. KỶ YẾU 9:16 (15 Mẫu Dọc) ---
    | 'kyyeu_916_film_sotay'
    | 'kyyeu_916_tennis_polaroid'
    | 'kyyeu_916_scrapbook_vintage'
    | 'kyyeu_916_bento_mobile'
    | 'kyyeu_916_max10_grid'
    | 'kyyeu_916_vogue_editorial'
    | 'kyyeu_916_newspaper_retro'
    | 'kyyeu_916_starry_night'
    | 'kyyeu_916_concert_ticket'
    | 'kyyeu_916_rainy_window'
    | 'kyyeu_916_y2k_student_id'
    | 'kyyeu_916_phuong_do'
    | 'kyyeu_916_instax_washi'
    | 'kyyeu_916_chalkboard_art'
    | 'kyyeu_916_korean_minimal'
    // --- 2. KỶ YẾU 16:9 (15 Mẫu Ngang) ---
    | 'kyyeu_169_aloha_bento'
    | 'kyyeu_169_curved_film'
    | 'kyyeu_169_nang_xien_bff'
    | 'kyyeu_169_youth_dream'
    | 'kyyeu_169_wood_frame_3d'
    | 'kyyeu_169_thanh_xuan_blend'
    | 'kyyeu_169_wall_gallery'
    | 'kyyeu_169_grand_panorama'
    | 'kyyeu_169_cork_bulletin'
    | 'kyyeu_169_yellow_bus'
    | 'kyyeu_169_contact_sheet'
    | 'kyyeu_169_open_yearbook'
    | 'kyyeu_169_sunset_silhouette'
    | 'kyyeu_169_sports_day'
    | 'kyyeu_169_nordic_lookbook'
    // --- 3. PHIM ẢNH 9:16 (15 Mẫu Dọc) ---
    | 'movie_916_wetv_romance'
    | 'movie_916_kdrama_split'
    | 'movie_916_pastel_bubble'
    | 'movie_916_vieon_firefly'
    | 'movie_916_dong_thoai'
    | 'movie_916_music_player'
    | 'movie_916_kodak_strip'
    | 'movie_916_neo_noir'
    | 'movie_916_campus_kdrama'
    | 'movie_916_action_blockbuster'
    | 'movie_916_anime_shinkai'
    | 'movie_916_wuxia_fantasy'
    | 'movie_916_cyberpunk_neon'
    | 'movie_916_fairytale_disney'
    | 'movie_916_indie_sundance'
    // --- 4. PHIM ẢNH 16:9 (15 Mẫu Ngang) ---
    | 'movie_169_cinema_widescreen'
    | 'movie_169_kdrama_banner'
    | 'movie_169_vieon_prime'
    | 'movie_169_dong_thoai_field'
    | 'movie_169_wetv_landscape'
    | 'movie_169_editing_timeline'
    | 'movie_169_trailer_thumbnail'
    | 'movie_169_tokyo_citylights'
    | 'movie_169_space_interstellar'
    | 'movie_169_vintage_drive_in'
    | 'movie_169_broadway_marquee'
    | 'movie_169_detective_casefile'
    | 'movie_169_music_album_gatefold'
    | 'movie_169_racing_speed'
    | 'movie_169_epic_battlefield'
    // --- Legacy compatibility aliases ---
    | 'tnt_wood_classic'
    | 'bff_thanh_xuan'
    | 'bento_catalog_8'
    | 'grid_10_max'
    | 'magazine_vogue'
    | 'polaroid_moodboard'
    | 'newspaper_retro'
    | 'wall_gallery_5'
    | 'cinema_film_strip'
    | 'story_9_16_music'
    | 'kyyeu_tuoi_hoc_tro_aloha'
    | 'kyyeu_cuon_film_sotay'
    | 'kyyeu_nang_xien_bff'
    | 'kyyeu_dai_phim_uon_luon'
    | 'kyyeu_scrapbook_vintage'
    | 'kyyeu_youth_dream_co'
    | 'kyyeu_khi_ta_con_tre_tennis'
    | 'movie_wetv_romance'
    | 'movie_kdrama_split'
    | 'movie_pastel_dream'
    | 'movie_vieon_fireworks';

export interface PosterOptions {
    templateId: PosterTemplateId;
    category?: PosterCategory;
    aspectRatio?: PosterAspectRatio;
    conceptName: string;
    studioName: string;
    slogan: string;
    hotline: string;
    yearTag: string;
    accentColor: string;
    resolution: 'HD' | '2K';
    cropBiasY?: number;
    quoteText?: string;
    movieTitle?: string;
    movieSubtitle?: string;
    actors?: string;
    platform?: 'wetv' | 'vieon' | 'netflix' | 'cinema' | 'none';
    broadcastTime?: string;
    releaseDate?: string;
}

export interface PosterTemplateMeta {
    id: PosterTemplateId;
    category: PosterCategory;
    aspectRatio: PosterAspectRatio;
    name: string;
    tagline: string;
    recommendedImages: string;
    idealSlots: number;
    slotLabels: string[];
    badge: string;
    color: string;
    description: string;
}

export const YEARBOOK_QUOTE_PRESETS: string[] = [
    'Điều đẹp đẽ không phải tuổi thanh xuân, mà là trong tuổi thanh xuân đó có họ.',
    'Tình bạn chúng ta nguyện xin giữ mãi trong tim.',
    'Khi ta còn trẻ, chúng ta đã từng rực rỡ như thế.',
    'Thanh xuân như một cơn mưa rào, dù cảm lạnh vẫn muốn đắm mình lần nữa.',
    'Cảm ơn vì đã trở thành một phần rực rỡ trong tuổi học trò của nhau.',
    'Từng trang giấy với nét chữ quen thuộc xin gửi lại mái trường thân yêu.'
];

export const THEME_COLOR_PRESETS = [
    { id: 'cherry', name: 'Đỏ Cherry', hex: '#e11d48' },
    { id: 'teal', name: 'Xanh Ngọc', hex: '#0d9488' },
    { id: 'blue', name: 'Xanh Dương', hex: '#2563eb' },
    { id: 'amber', name: 'Vàng Hoàng Hôn', hex: '#d97706' },
    { id: 'purple', name: 'Tím Mộng Mơ', hex: '#7c3aed' },
    { id: 'slate', name: 'Đen Cổ Điển', hex: '#1e293b' }
];

// =============================================================================
// 60 POSTER TEMPLATES METADATA
// =============================================================================
export const POSTER_TEMPLATES: PosterTemplateMeta[] = [
    // -------------------------------------------------------------------------
    // 1. KỶ YẾU 9:16 (15 Mẫu Dọc)
    // -------------------------------------------------------------------------
    {
        id: 'kyyeu_916_film_sotay',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Sổ Tay Cuộn Film 9:16',
        tagline: 'Trang vở ô ly học sinh dán ảnh film nghiêng',
        recommendedImages: '5-6 ảnh',
        idealSlots: 6,
        slotLabels: ['Ảnh đầu trang', 'Tập thể lớp', 'Chân dung đứng 1', 'Nữ sinh góc trái', 'Đôi bạn lớp học', 'Chân dung bảng'],
        badge: 'HOT TREND',
        color: '#2563eb',
        description: 'Khổ dọc 9:16 trang vở ô ly xanh pastel, đính ảnh film 35mm nghiêng kèm 2 cuộn film Fuji/Kodak.'
    },
    {
        id: 'kyyeu_916_tennis_polaroid',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Khi Ta Còn Trẻ 9:16',
        tagline: '3 tầng chuyển cảnh mượt + 2 ảnh Polaroid nổi',
        recommendedImages: '5 ảnh',
        idealSlots: 5,
        slotLabels: ['Tầng trên hành lang', 'Tầng giữa sân tập', 'Tầng dưới đồng loạt', 'Polaroid nhóm nữ', 'Polaroid cặp đôi'],
        badge: 'POLAROID',
        color: '#0d9488',
        description: 'Bố cục 3 lớp chuyển tiếp thể thao sân tennis kèm chữ thư pháp "Khi ta còn trẻ" và 2 tấm ảnh Polaroid ghim nổi.'
    },
    {
        id: 'kyyeu_916_scrapbook_vintage',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Nhật Ký Giấy Rách 9:16',
        tagline: '5 khung viền rách vintage & ruy băng đỏ',
        recommendedImages: '5 ảnh',
        idealSlots: 5,
        slotLabels: ['Tập thể trên cùng', 'Nhóm nhỏ góc phải', 'Khoảnh khắc lớp', 'Cầu thang kỷ niệm', 'Cổng trường'],
        badge: 'VINTAGE',
        color: '#b45309',
        description: '5 khung ảnh xé rách mép thủ công (deckle edge) kèm ruy băng đỏ và chữ lưu bút viết tay tiếng Việt.'
    },
    {
        id: 'kyyeu_916_bento_mobile',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Bento Grid Mobile 7 Ô',
        tagline: 'Lưới Bento 7 ô dọc tối ưu màn hình điện thoại',
        recommendedImages: '7 ảnh',
        idealSlots: 7,
        slotLabels: ['Hero Lớn trên cùng', 'Chân dung trái 1', 'Chân dung phải 1', 'Cặp đôi giữa', 'Ảnh hậu trường 1', 'Ảnh hậu trường 2', 'Tập thể đáy'],
        badge: 'BENTO 9:16',
        color: '#8b5cf6',
        description: 'Bố cục Bento hiện đại chia 3 tầng dọc cho điện thoại: 1 ảnh Hero lớn tập thể + 6 ô vệ tinh chân dung xung quanh.'
    },
    {
        id: 'kyyeu_916_max10_grid',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Album Đầy Đủ 10 Ảnh 9:16',
        tagline: 'Khoe trọn vẹn cả 10 ảnh tải lên',
        recommendedImages: '10 ảnh (đầy đủ)',
        idealSlots: 10,
        slotLabels: ['Lớn 1', 'Lớn 2', 'Vừa 1', 'Vừa 2', 'Vừa 3', 'Nhỏ 1', 'Nhỏ 2', 'Nhỏ 3', 'Nhỏ 4', 'Nhỏ 5'],
        badge: 'MAX 10 ẢNH',
        color: '#10b981',
        description: 'Bố cục 3 tầng khoa học tỷ lệ 9:16 (2 ảnh lớn, 3 ảnh vừa, 5 ảnh nhỏ) chuẩn đăng Story Instagram & Facebook.'
    },
    {
        id: 'kyyeu_916_vogue_editorial',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Bìa Vogue High-Fashion 9:16',
        tagline: 'Thời trang kỷ yếu chuẩn bìa tạp chí danh tiếng',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Ảnh bìa toàn màn', 'Ảnh phụ nhỏ 1', 'Ảnh phụ nhỏ 2', 'Ảnh phụ nhỏ 3'],
        badge: 'FASHION',
        color: '#0f172a',
        description: 'Ảnh Hero bìa lớn, typography Vogue Masthead in hoa quyền lực, mã vạch barcode và 3 ảnh hậu trường chân trang.'
    },
    {
        id: 'kyyeu_916_newspaper_retro',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Bản Tin Báo Chí 90s 9:16',
        tagline: 'Trang nhất The Youth Times hoài niệm',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Ảnh bìa Trang nhất', 'Cột trái', 'Cột giữa', 'Cột phải'],
        badge: 'RETRO BÁO',
        color: '#78350f',
        description: 'Nền giấy báo ngả vàng retro, tiêu đề báo in cổ điển, đường kẻ đôi và chia cột bài báo thanh lịch.'
    },
    {
        id: 'kyyeu_916_starry_night',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Dải Ngân Hà & Ước Mơ 9:16',
        tagline: 'Bầu trời đêm huyền ảo & chòm sao ước nguyện',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Ảnh chính bầu trời', 'Khoảnh khắc sao 1', 'Khoảnh khắc sao 2', 'Ước mơ chân trang'],
        badge: 'GALAXY',
        color: '#312e81',
        description: 'Tone màu xanh tím thiên hà bí ẩn, các đường nối chòm sao lấp lánh và dòng chữ ước mơ tương lai.'
    },
    {
        id: 'kyyeu_916_concert_ticket',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Vé Concert Thanh Xuân 9:16',
        tagline: 'Thiết kế vé lễ hội âm nhạc có răng cưa & mã QR',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Cuống vé trên', 'Sân khấu trung tâm', 'Ban nhạc/Nhóm', 'Vạch mã vé đáy'],
        badge: 'TICKET PASS',
        color: '#db2777',
        description: 'Mô phỏng tấm vé concert âm nhạc tuổi học trò với đường viền răng cưa xé vé, mã vạch barcode và danh sách học sinh.'
    },
    {
        id: 'kyyeu_916_rainy_window',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Cửa Sổ Mưa Kỷ Niệm 9:16',
        tagline: 'Hiệu ứng giọt nước đọng & chữ viết trên kính mờ',
        recommendedImages: '3 ảnh',
        idealSlots: 3,
        slotLabels: ['Kính mờ ngoại cảnh', 'Ảnh chân dung trong mưa', 'Góc lớp học'],
        badge: 'MOODY RAIN',
        color: '#0284c7',
        description: 'Tâm trạng hoài niệm với lớp texture hạt mưa đọng trên cửa sổ kính, dòng chữ lưu bút mờ như được ngón tay vẽ lên.'
    },
    {
        id: 'kyyeu_916_y2k_student_id',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Thẻ Học Sinh Y2K Retro 9:16',
        tagline: 'Thẻ ID Card học sinh tem hologram phản quang',
        recommendedImages: '3 ảnh',
        idealSlots: 3,
        slotLabels: ['Ảnh thẻ chân dung', 'Ảnh hoạt động lớp', 'Ảnh tập thể'],
        badge: 'Y2K RETRO',
        color: '#6366f1',
        description: 'Thiết kế thẻ học sinh phóng to phong cách Y2K thập niên 2000, có tem hologram 7 màu phản quang và mã vạch.'
    },
    {
        id: 'kyyeu_916_phuong_do',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Hoa Phượng Rực Rỡ 9:16',
        tagline: 'Sắc đỏ hoa phượng vĩ & vạt nắng hè chói chang',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Tán phượng trên', 'Chân dung trong nắng', 'Sân trường hoa rơi', 'Nụ cười ngày bế giảng'],
        badge: 'MÙA HÈ',
        color: '#dc2626',
        description: 'Dành riêng cho mùa chia tay với viền hoa phượng đỏ rực, tia nắng hạ vàng ươm và câu thơ giã từ mái trường.'
    },
    {
        id: 'kyyeu_916_instax_washi',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Instax Washi Tape Dọc 9:16',
        tagline: '6 tấm Instax Mini dán so le bằng băng dính giấy',
        recommendedImages: '6 ảnh',
        idealSlots: 6,
        slotLabels: ['Instax #1', 'Instax #2', 'Instax #3', 'Instax #4', 'Instax #5', 'Instax Tốt Nghiệp'],
        badge: 'INSTAX',
        color: '#d97706',
        description: 'Các tấm ảnh Instax Mini nghiêng nghệ thuật ghim băng dính giấy washi tape trong suốt và bóng đổ 3D.'
    },
    {
        id: 'kyyeu_916_chalkboard_art',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Bảng Đen Phấn Trắng 9:16',
        tagline: 'Nền bảng xanh đen học đường & nét phấn vẽ tay',
        recommendedImages: '5 ảnh',
        idealSlots: 5,
        slotLabels: ['Khung bảng trên', 'Khung phấn trái', 'Khung phấn phải', 'Góc lưu niệm', 'Lời chúc thầy cô'],
        badge: 'BẢNG ĐEN',
        color: '#15803d',
        description: 'Bề mặt bảng đen lớp học thân quen với các nét vẽ phấn trắng ngộ nghĩnh, công thức toán học và lời chúc thi tốt.'
    },
    {
        id: 'kyyeu_916_korean_minimal',
        category: 'ky_yeu',
        aspectRatio: '9:16',
        name: 'Tối Giản Hàn Quốc 9:16',
        tagline: 'Phong cách Minimalist trắng tinh khôi & viền mỏng',
        recommendedImages: '3 ảnh',
        idealSlots: 3,
        slotLabels: ['Chân dung thanh lịch', 'Khoảnh khắc tinh khôi', 'Chi tiết đồng phục'],
        badge: 'MINIMAL',
        color: '#475569',
        description: 'Thiết kế tinh giản tối đa chuẩn Studio Hàn Quốc, nền trắng ngà, khoảng thở rộng rãi và font chữ serif tao nhã.'
    },

    // -------------------------------------------------------------------------
    // 2. KỶ YẾU 16:9 (15 Mẫu Ngang)
    // -------------------------------------------------------------------------
    {
        id: 'kyyeu_169_aloha_bento',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Tuổi Học Trò Aloha 16:9',
        tagline: 'Tone vàng nắng trường cổ & thư pháp chân trang',
        recommendedImages: '8 ảnh',
        idealSlots: 8,
        slotLabels: ['Cột trái 1', 'Cột trái 2', 'Ô flycam giữa', 'Hành lang đứng', 'Selfie góc', 'Nhóm sân trường', 'Hàng dài dưới 1', 'Hàng dài dưới 2'],
        badge: 'PANORAMA',
        color: '#d97706',
        description: 'Khổ ngang 16:9 ấm áp tone vàng hoàng gia, lưới Bento 8 ô panorama kèm chữ thư pháp "Concept Tuổi học trò".'
    },
    {
        id: 'kyyeu_169_curved_film',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Dải Phim Uốn Lượn 16:9',
        tagline: 'Dải phim 35mm bay lượn xuyên bầu trời ngang',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Nền bầu trời toàn cảnh', 'Khung phim trái', 'Khung phim giữa', 'Khung phim phải'],
        badge: 'FILM 3D',
        color: '#4f46e5',
        description: 'Cuộn phim 35mm uốn lượn 3D nổi bật xuyên qua bầu trời ngang, chứa 3 khoảnh khắc lớp cùng trích dẫn thơ thanh xuân.'
    },
    {
        id: 'kyyeu_169_nang_xien_bff',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Nắng Xiên Cầu Thang 16:9',
        tagline: 'Kiến trúc ánh sáng & bóng đổ Chiaroscuro 9 ô',
        recommendedImages: '9 ảnh',
        idealSlots: 9,
        slotLabels: ['Nắng cầu thang 1', 'Nơ trắng quay lưng', 'Cầu thang nam', 'Cửa sổ nắng', 'Nhìn sân trường', 'Chân dung đứng', 'Cửa sổ kính', 'Sân trường lớn', 'Hàng dài nữ sinh'],
        badge: 'ÁNH SÁNG',
        color: '#92400e',
        description: 'Lưới 9 ô kỷ yếu điện ảnh chuẩn BFF Media trải dài khổ 16:9, tôn vinh kiến trúc ánh sáng & bóng đổ sân trường.'
    },
    {
        id: 'kyyeu_169_youth_dream',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Youth Dream Đồng Cỏ 16:9',
        tagline: '4 khối ảnh lớn tươi sáng phong cách Kỷ Yếu Sài Gòn',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Khối logo trái', 'Hero cận cười rạng rỡ', 'Đồng cỏ lớn đáy', 'Nhóm nằm bãi cỏ'],
        badge: 'CỎ XANH',
        color: '#059669',
        description: '4 khung ảnh thoáng đãng trên nền màu nước pastel tươi tắn, đồng phục áo trắng trên thảm cỏ xanh.'
    },
    {
        id: 'kyyeu_169_wood_frame_3d',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'TNT Khung Gỗ 3D 16:9',
        tagline: 'Khung tranh gỗ 3D lớn trái + cụm chân dung phải',
        recommendedImages: '5 ảnh',
        idealSlots: 5,
        slotLabels: ['Ảnh lớn Khung Gỗ 3D', 'Chân dung phải 1', 'Chân dung phải 2', 'Chân dung phải 3', 'Ảnh đôi đáy phải'],
        badge: 'KHUNG GỖ',
        color: '#e11d48',
        description: 'Khung gỗ 3D nổi bật chiếm nửa trái, nửa phải gồm các ô chân dung sắc nét và cụm icon like/tim Facebook.'
    },
    {
        id: 'kyyeu_169_thanh_xuan_blend',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Thanh Xuân Blend 16:9',
        tagline: 'Phóng sự điện ảnh hòa trộn viền mờ mềm mại',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Trái trên', 'Trái giữa', 'Trái dưới', 'Hero dọc bên phải'],
        badge: 'ĐIỆN ẢNH',
        color: '#0284c7',
        description: 'Ảnh Hero lớn bên phải + 3 ảnh ngang chuyển mờ viền mềm mại bên trái (đã hết lỗi đen), chữ quote thư pháp.'
    },
    {
        id: 'kyyeu_169_wall_gallery',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Bộ 5 Tranh Gỗ Treo Tường',
        tagline: 'Demo bộ tranh ép gỗ phòng khách/lớp học',
        recommendedImages: '5 ảnh',
        idealSlots: 5,
        slotLabels: ['Khung nhỏ trái', 'Khung vừa trái', 'Khung Lớn Giữa', 'Khung vừa phải', 'Khung nhỏ phải'],
        badge: 'TRANH TREO',
        color: '#475569',
        description: 'Bộ 5 bức tranh khung gỗ 3D đối xứng treo trên tường phòng triển lãm, ánh sáng rọi sang trọng.'
    },
    {
        id: 'kyyeu_169_grand_panorama',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Đại Kỷ Niệm Panorama 16:9',
        tagline: 'Đại cảnh lớp học siêu rộng + dải 6 chân dung chân trang',
        recommendedImages: '7 ảnh',
        idealSlots: 7,
        slotLabels: ['Ảnh đại cảnh cả lớp', 'Chân dung 1', 'Chân dung 2', 'Chân dung 3', 'Chân dung 4', 'Chân dung 5', 'Chân dung 6'],
        badge: 'TOÀN CẢNH',
        color: '#2563eb',
        description: 'Khổ ngang rộng lớn: 1 bức ảnh chụp tập thể cả lớp chiếm 65% trên cùng, chân trang là hàng chân dung 6 thành viên.'
    },
    {
        id: 'kyyeu_169_cork_bulletin',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Bảng Tin Gỗ Bần Lớp Học',
        tagline: 'Nền gỗ bần ghim giấy note, đinh bấm & Polaroid',
        recommendedImages: '6 ảnh',
        idealSlots: 6,
        slotLabels: ['Góc trái trên', 'Tập thể giữa', 'Góc phải trên', 'Polaroid trái', 'Polaroid giữa', 'Lời nhắn nhủ'],
        badge: 'BẢNG TIN',
        color: '#92400e',
        description: 'Bảng tin lớp học bằng gỗ bần ấm áp với giấy ghi chú viết tay, đinh ghim kim loại tròn và ảnh chụp lấy liền.'
    },
    {
        id: 'kyyeu_169_yellow_bus',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Chuyến Xe Bus Kỷ Yếu 16:9',
        tagline: 'Hành trình xe bus vàng dã ngoại & bản đồ kỷ niệm',
        recommendedImages: '5 ảnh',
        idealSlots: 5,
        slotLabels: ['Xe bus toàn cảnh', 'Cửa sổ xe 1', 'Cửa sổ xe 2', 'Điểm dừng chân', 'Khoảnh khắc ca hát'],
        badge: 'DÃ NGOẠI',
        color: '#eab308',
        description: 'Chủ đề dã ngoại tươi vui với hình ảnh xe bus trường học, đường kẻ lộ trình du lịch và các khung cửa sổ xe.'
    },
    {
        id: 'kyyeu_169_contact_sheet',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Contact Sheet Phòng Tối 16:9',
        tagline: 'Bảng duyệt film âm bản 8 khung có bút chì mỡ đỏ',
        recommendedImages: '8 ảnh',
        idealSlots: 8,
        slotLabels: ['Frame 01', 'Frame 02', 'Frame 03', 'Frame 04', 'Frame 05', 'Frame 06', 'Frame 07', 'Frame 08'],
        badge: 'DARKROOM',
        color: '#18181b',
        description: 'Mô phỏng bảng duyệt film âm bản trong phòng tối nhiếp ảnh với số khung 01-08 và nét khoanh đỏ chọn ảnh ưng ý.'
    },
    {
        id: 'kyyeu_169_open_yearbook',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Trang Niên Giám Mở Đôi 16:9',
        tagline: 'Cuốn kỷ yếu mở ngang có nếp gấp gáy sách 3D',
        recommendedImages: '6 ảnh',
        idealSlots: 6,
        slotLabels: ['Trang trái đại cảnh', 'Trang trái góc', 'Trang phải chân dung 1', 'Trang phải chân dung 2', 'Trang phải chân dung 3', 'Trang phải chân dung 4'],
        badge: 'SÁCH MỞ',
        color: '#71717a',
        description: 'Trang sách niên giám mở đôi với bóng đổ gáy sách 3D ở giữa: trang trái ảnh đại cảnh, trang phải 4 ảnh chân dung cá nhân.'
    },
    {
        id: 'kyyeu_169_sunset_silhouette',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Hoàng Hôn Bờ Biển 16:9',
        tagline: 'Chân trời hoàng hôn cam rực & bóng hình ngược sáng',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Chân trời hoàng hôn', 'Cặp đôi ngược sáng', 'Nhóm bạn tung bóng', 'Kỷ niệm bờ cát'],
        badge: 'HOÀNG HÔN',
        color: '#ea580c',
        description: 'Hòa quyện vạt nắng cuối chiều trên bờ biển, hiệu ứng ánh sáng ngược silhouette vàng cam đầy cảm xúc.'
    },
    {
        id: 'kyyeu_169_sports_day',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Hội Thao Rực Lửa 16:9',
        tagline: 'Đường chéo thể thao năng động & bảng điểm số',
        recommendedImages: '5 ảnh',
        idealSlots: 5,
        slotLabels: ['Khung cản đích', 'Đồng đội ăn mừng', 'Khoảnh khắc bứt phá', 'Huy chương vàng', 'Cổ động viên'],
        badge: 'THỂ THAO',
        color: '#0284c7',
        description: 'Đường cắt xiên thể thao sắc sảo, bảng tỷ số điện tử năng động và huy hiệu nhà vô địch kỷ yếu.'
    },
    {
        id: 'kyyeu_169_nordic_lookbook',
        category: 'ky_yeu',
        aspectRatio: '16:9',
        name: 'Lookbook Bắc Âu 16:9',
        tagline: 'Khoảng thở rộng rãi, căn lề tạp chí Thụy Điển',
        recommendedImages: '5 ảnh',
        idealSlots: 5,
        slotLabels: ['Ảnh chính 01', 'Ảnh phụ 02', 'Ảnh phụ 03', 'Ảnh phụ 04', 'Ảnh phụ 05'],
        badge: 'NORDIC',
        color: '#334155',
        description: 'Phong cách Scandinavia thanh lịch với tỷ lệ khoảng trắng cân bằng, typography số đánh thứ tự 01-05.'
    },

    // -------------------------------------------------------------------------
    // 3. PHIM ẢNH 9:16 (15 Mẫu Dọc)
    // -------------------------------------------------------------------------
    {
        id: 'movie_916_wetv_romance',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'Phim Ngôn Tình WeTV 9:16',
        tagline: 'Poster phim xích đu đêm, bokeh ánh đèn lung linh',
        recommendedImages: '1-2 ảnh',
        idealSlots: 2,
        slotLabels: ['Ảnh chính đôi uyên ương', 'Ảnh chân dung phụ'],
        badge: 'WETV ROMANCE',
        color: '#e11d48',
        description: 'Thiết kế điện ảnh lãng mạn giống WeTV, ánh sáng bokeh ấm áp, tiêu đề thanh mảnh + logo đài phát sóng.'
    },
    {
        id: 'movie_916_kdrama_split',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'K-Drama Song Hành 9:16',
        tagline: '2 chân dung nam/nữ đối xứng trên + cảnh gặp gỡ dưới',
        recommendedImages: '3 ảnh',
        idealSlots: 3,
        slotLabels: ['Chân dung Nữ (Trên trái)', 'Chân dung Nam (Trên phải)', 'Cảnh đối thoại (Nửa dưới)'],
        badge: 'K-DRAMA',
        color: '#3b82f6',
        description: 'Chia tầng K-Drama kinh điển: 2 chân dung tách đôi tầng trên, cảnh đối thoại tình cảm tầng dưới & chữ giữa.'
    },
    {
        id: 'movie_916_pastel_bubble',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'Tình Yêu Độc Nhất Pastel',
        tagline: 'Bầu trời dịu êm, bong bóng xà phòng & Font Trái Tim',
        recommendedImages: '1-2 ảnh',
        idealSlots: 2,
        slotLabels: ['Ảnh cặp đôi chính diện', 'Khoảnh khắc nụ cười'],
        badge: 'PASTEL POP',
        color: '#ec4899',
        description: 'Ánh nắng bầu trời trong veo, hiệu ứng bong bóng xà phòng bay bổng cùng chữ thiết kế trái tim ngọt ngào.'
    },
    {
        id: 'movie_916_vieon_firefly',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'Phim Truyền Hình VieON 9:16',
        tagline: 'Rừng cây đom đóm + Badge Song Song & Giờ chiếu 19:00',
        recommendedImages: '1 ảnh đôi',
        idealSlots: 1,
        slotLabels: ['Ảnh chính đôi diễn viên'],
        badge: 'VIEON PRIME',
        color: '#16a34a',
        description: 'Tone rừng xanh mộng mơ cùng hạt ánh sáng đom đóm, badge phát sóng SONG SONG, logo VieON và lịch chiếu 19:00.'
    },
    {
        id: 'movie_916_dong_thoai',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'MV Nghệ Thuật Đồng Thoại',
        tagline: 'Double Exposure cây thông cô đơn trên đồi cỏ vintage',
        recommendedImages: '2 ảnh',
        idealSlots: 2,
        slotLabels: ['Ảnh cận đôi hòa trộn cây thông', 'Ảnh toàn cảnh đồi cỏ thảo nguyên'],
        badge: 'MV CHUNG ĐÔI',
        color: '#78350f',
        description: 'Phong cách retro đồi cỏ hoài niệm với hiệu ứng hòa trộn Double Exposure, tên 2 ca sĩ chính và ngày ra mắt MV.'
    },
    {
        id: 'movie_916_music_player',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'Story MV + Đĩa Nhạc Xoay 9:16',
        tagline: 'Khổ dọc Reels/TikTok, đĩa than xoay & thanh phát nhạc',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Ảnh bìa lớn', 'Cảnh phụ trái', 'Cảnh phụ phải', 'Ảnh đĩa than tròn'],
        badge: 'STORY MV',
        color: '#ec4899',
        description: 'Khổ dọc 9:16 cho điện thoại, nền blur huyền ảo kèm Widget phát nhạc OST phim & bài hát sống động.'
    },
    {
        id: 'movie_916_kodak_strip',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'Dải Phim Kodak Portra 9:16',
        tagline: '4 khung 35mm màu cam có lỗ răng cưa phim thực tế',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Cảnh 01A', 'Cảnh 02A', 'Cảnh 03A', 'Cảnh 04A'],
        badge: 'FILM 35MM',
        color: '#ea580c',
        description: 'Dải phim 35mm màu đen có lỗ răng cưa phim thực tế, số khung 01A/02A và timestamp màu cam.'
    },
    {
        id: 'movie_916_neo_noir',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'Trinh Thám Neo-Noir 9:16',
        tagline: 'Bóng đổ rèm cửa sổ sọc, mưa đêm & chữ đỏ bí ẩn',
        recommendedImages: '2 ảnh',
        idealSlots: 2,
        slotLabels: ['Chân dung bí ẩn', 'Manh mối hiện trường'],
        badge: 'NEO-NOIR',
        color: '#dc2626',
        description: 'Tương phản đen trắng mạnh mẽ kết hợp ánh sáng rèm sọc, vệt mưa rơi trên phố đêm và chữ đỏ trinh thám kịch tính.'
    },
    {
        id: 'movie_916_campus_kdrama',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'Vườn Trường K-Drama 9:16',
        tagline: 'Nắng rọi bàn học, rèm trắng bay & lời tỏ tình',
        recommendedImages: '2-3 ảnh',
        idealSlots: 3,
        slotLabels: ['Nữ chính bên cửa sổ', 'Nam chính nhìn trộm', 'Cảnh sân trường chung'],
        badge: 'VƯỜN TRƯỜNG',
        color: '#0284c7',
        description: 'Không gian lớp học tràn ngập ánh nắng ban mai, rèm cửa trắng bay bồng bềnh và câu thoại tỏ tình thanh xuân K-Drama.'
    },
    {
        id: 'movie_916_action_blockbuster',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'Bom Tấn Hành Động 9:16',
        tagline: 'Tàn lửa bốc khói, Teal & Orange, chữ kim loại 3D',
        recommendedImages: '2 ảnh',
        idealSlots: 2,
        slotLabels: ['Nhân vật chính hành động', 'Cảnh cháy nổ nền'],
        badge: 'ACTION',
        color: '#ea580c',
        description: 'Màu phim Hollywood chuẩn Teal & Orange, tàn lửa bay rực rỡ, chữ kim loại dập nổi 3D và hàng chữ credit đạo diễn.'
    },
    {
        id: 'movie_916_anime_shinkai',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'Anime Nhật Bản Shinkai 9:16',
        tagline: 'Mây trắng bồng bềnh trời xanh & vệt sao băng rơi',
        recommendedImages: '2 ảnh',
        idealSlots: 2,
        slotLabels: ['Nhân vật ngước nhìn trời', 'Cảnh thành phố anime'],
        badge: 'ANIME SKY',
        color: '#06b6d4',
        description: 'Lấy cảm hứng từ nét vẽ Makoto Shinkai với bầu trời xanh biếc, đám mây trắng cuộn trào và vệt sao băng phát sáng diệu kỳ.'
    },
    {
        id: 'movie_916_wuxia_fantasy',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'Cổ Trang Tiên Hiệp 9:16',
        tagline: 'Mây mù non cao, hoa đào rơi & thư pháp thủy mặc',
        recommendedImages: '2 ảnh',
        idealSlots: 2,
        slotLabels: ['Nhân vật cổ trang chính', 'Cảnh non nước hữu tình'],
        badge: 'CỔ TRANG',
        color: '#f43f5e',
        description: 'Tranh thủy mặc non nước hữu tình, cánh hoa đào rơi trong gió và chữ thư pháp mực tàu uyển chuyển.'
    },
    {
        id: 'movie_916_cyberpunk_neon',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'Viễn Tưởng Cyberpunk 9:16',
        tagline: 'Đèn neon Cyan & Magenta, scanlines tương lai',
        recommendedImages: '2 ảnh',
        idealSlots: 2,
        slotLabels: ['Chân dung ánh neon', 'Đường phố tương lai'],
        badge: 'CYBERPUNK',
        color: '#a855f7',
        description: 'Ánh sáng neon 2 màu hồng tím và xanh ngọc, đường quét scanlines của màn hình tương lai và mã định danh kỹ thuật số.'
    },
    {
        id: 'movie_916_fairytale_disney',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'Cổ Tích Disney 9:16',
        tagline: 'Bụi phép thuật lung linh & lâu đài kỳ ảo',
        recommendedImages: '2 ảnh',
        idealSlots: 2,
        slotLabels: ['Công chúa / Hoàng tử', 'Lâu đài cổ tích'],
        badge: 'CỔ TÍCH',
        color: '#eab308',
        description: 'Hạt bụi phép thuật vàng óng ánh tỏa sáng quanh nhân vật, bóng lâu đài hoàng hôn và font chữ truyện thần tiên.'
    },
    {
        id: 'movie_916_indie_sundance',
        category: 'phim_anh',
        aspectRatio: '9:16',
        name: 'Phim Nghệ Thuật Cannes 9:16',
        tagline: 'Vòng nguyệt quế liên hoan phim & bố cục tối giản',
        recommendedImages: '1 ảnh',
        idealSlots: 1,
        slotLabels: ['Ảnh nghệ thuật độc lập'],
        badge: 'CANNES INDIE',
        color: '#e2e8f0',
        description: 'Chuẩn phong cách poster các tác phẩm đoạt giải Cannes / Sundance với vòng lá nguyệt quế vàng và chữ đạo diễn tối giản.'
    },

    // -------------------------------------------------------------------------
    // 4. PHIM ẢNH 16:9 (15 Mẫu Ngang)
    // -------------------------------------------------------------------------
    {
        id: 'movie_169_cinema_widescreen',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'Màn Bạc Cinema 2.39:1',
        tagline: 'Viền đen letterbox rạp chiếu phim & chữ vàng kim',
        recommendedImages: '1-3 ảnh',
        idealSlots: 2,
        slotLabels: ['Đại cảnh chiếu rạp', 'Cận cảnh diễn viên'],
        badge: '2.39:1 RẠP',
        color: '#ca8a04',
        description: 'Tỷ lệ màn ảnh rộng Anamorphic 2.39:1 với 2 dải đen cinematic letterbox, chữ vàng kim sang trọng của các tác phẩm điện ảnh.'
    },
    {
        id: 'movie_169_kdrama_banner',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'K-Drama Banner Ngang 16:9',
        tagline: '2 nhân vật 2 bên nhìn vào giữa & tựa phim sáng',
        recommendedImages: '3 ảnh',
        idealSlots: 3,
        slotLabels: ['Nữ chính mép trái', 'Nam chính mép phải', 'Bối cảnh gặp gỡ giữa'],
        badge: 'K-DRAMA TV',
        color: '#3b82f6',
        description: 'Banner ngang chiếu Smart TV / Web drama: 2 diễn viên chính 2 bên nhìn về tâm điểm, tựa đề phim nổi bật ở giữa.'
    },
    {
        id: 'movie_169_vieon_prime',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'VieON Prime Banner 16:9',
        tagline: 'Banner độc quyền phát sóng TV giờ vàng 19:00',
        recommendedImages: '2-3 ảnh',
        idealSlots: 3,
        slotLabels: ['Nhân vật chính diện', 'Khoảnh khắc kịch tính', 'Bối cảnh rừng cây'],
        badge: 'VIEON BANNER',
        color: '#16a34a',
        description: 'Banner ngang phát sóng độc quyền khung giờ vàng 19:00 trên ứng dụng VieON Smart TV với đom đóm và logo nhà đài.'
    },
    {
        id: 'movie_169_dong_thoai_field',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'Đồng Thoại Thảo Nguyên 16:9',
        tagline: 'Toàn cảnh thảo nguyên cỏ dại mênh mông & lời ca',
        recommendedImages: '3 ảnh',
        idealSlots: 3,
        slotLabels: ['Đôi uyên ương cận', 'Cây thông đại ngàn', 'Bóng hình xa xăm'],
        badge: 'THẢO NGUYÊN',
        color: '#78350f',
        description: 'Đồi cỏ vintage trải dài chiều ngang, cây thông cô đơn đứng sừng sững giữa trời và đoạn lời ca bài hát sâu lắng.'
    },
    {
        id: 'movie_169_wetv_landscape',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'WeTV Phố Hoàng Hôn 16:9',
        tagline: 'Cảnh hoàng hôn thành phố / bờ biển góc rộng WeTV',
        recommendedImages: '2 ảnh',
        idealSlots: 2,
        slotLabels: ['Toàn cảnh hẹn hò', 'Cận nụ cười đôi'],
        badge: 'WETV BANNER',
        color: '#0284c7',
        description: 'Góc rộng hoàng hôn phố thị lung linh kèm badge WeTV chính hãng, phù hợp cho bìa video YouTube hoặc màn hình TV.'
    },
    {
        id: 'movie_169_editing_timeline',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'Bàn Dựng Phim Hậu Kỳ 16:9',
        tagline: 'Chuỗi thước phim phân cảnh trải dài như phòng dựng',
        recommendedImages: '5-6 ảnh',
        idealSlots: 6,
        slotLabels: ['Take 01', 'Take 02', 'Take 03', 'Take 04', 'Take 05', 'Take 06'],
        badge: 'TIMELINE',
        color: '#64748b',
        description: 'Bố cục phòng dựng phim chuyên nghiệp với các mốc thời gian timecode, sóng âm thanh audio wave và dải cảnh quay.'
    },
    {
        id: 'movie_169_trailer_thumbnail',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'YouTube Trailer 4K 16:9',
        tagline: 'Banner thumbnail giật gân, nút Play đỏ & OFFICIAL TRAILER',
        recommendedImages: '2-3 ảnh',
        idealSlots: 3,
        slotLabels: ['Nhân vật tâm điểm', 'Cảnh hành động phụ', 'Logo phim'],
        badge: 'YOUTUBE 4K',
        color: '#e11d48',
        description: 'Thumbnail YouTube chuẩn 4K giật gân, nút bấm Play tam giác viền đỏ và nhãn OFFICIAL TEASER TRAILER nổi bật.'
    },
    {
        id: 'movie_169_tokyo_citylights',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'Tokyo City Lights 16:9',
        tagline: 'Đêm thành phố rực rỡ đèn neon & vệt xe chạy dài',
        recommendedImages: '2 ảnh',
        idealSlots: 2,
        slotLabels: ['Cặp đôi phố đêm', 'Đèn neon thành phố'],
        badge: 'TOKYO NIGHT',
        color: '#ec4899',
        description: 'Bầu không khí đô thị đêm Tokyo với đèn neon phản chiếu trên mặt đường ướt mưa và tiêu đề phim hiện đại.'
    },
    {
        id: 'movie_169_space_interstellar',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'Không Gian Vũ Trụ 16:9',
        tagline: 'Quầng hào quang hành tinh & dải ngân hà kỳ ảo',
        recommendedImages: '2 ảnh',
        idealSlots: 2,
        slotLabels: ['Nhân vật nhìn vũ trụ', 'Hành tinh / Trái Đất'],
        badge: 'SCI-FI SPACE',
        color: '#4338ca',
        description: 'Đường cong chân trời hành tinh ngoài vũ trụ bao la, tinh vân phát sáng huyền bí và font chữ viễn tưởng tinh xảo.'
    },
    {
        id: 'movie_169_vintage_drive_in',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'Rạp Phim Ngoài Trời 80s 16:9',
        tagline: 'Biển hiệu Drive-In Cinema nước Mỹ thập niên 80',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Màn chiếu ngoài trời', 'Xe cổ điển 1', 'Xe cổ điển 2', 'Bảng đèn neon'],
        badge: '80S RETRO',
        color: '#f97316',
        description: 'Hoài niệm văn hóa xem phim rạp ngoài trời từ trên xe hơi của Mỹ những năm 1980 với biển hiệu đèn neon vàng đỏ.'
    },
    {
        id: 'movie_169_broadway_marquee',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'Sân Khấu Kịch Broadway 16:9',
        tagline: 'Rèm nhung đỏ, đèn rọi sân khấu & bóng đèn tròn',
        recommendedImages: '3 ảnh',
        idealSlots: 3,
        slotLabels: ['Diễn viên tâm điểm', 'Vũ đoàn cánh gà', 'Chào khán giả'],
        badge: 'BROADWAY',
        color: '#b91c1c',
        description: 'Rèm nhung đỏ sang trọng mở ra ánh đèn sân khấu nghệ thuật Broadway, tiêu đề gắn các bóng đèn tròn rực rỡ.'
    },
    {
        id: 'movie_169_detective_casefile',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'Hồ Sơ Mật Vụ Án 16:9',
        tagline: 'Kẹp tài liệu mật thám tử & sợi chỉ đỏ nối bằng chứng',
        recommendedImages: '4-5 ảnh',
        idealSlots: 5,
        slotLabels: ['Nghi phạm chính', 'Manh mối 1', 'Manh mối 2', 'Bản đồ hiện trường', 'Dấu mộc Tuyệt Mật'],
        badge: 'TOP SECRET',
        color: '#713f12',
        description: 'Tập hồ sơ điều tra án mạng của thám tử với ảnh kẹp ghim giấy, sợi chỉ đỏ kết nối các manh mối và con dấu TUYỆT MẬT.'
    },
    {
        id: 'movie_169_music_album_gatefold',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'Bìa Đĩa Than Đôi 16:9',
        tagline: 'Bìa Gatefold đĩa than mở rộng có đĩa nhựa ló ra',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Bìa trước album', 'Nửa đĩa than nhô ra', 'Ảnh hậu trường 1', 'Ảnh hậu trường 2'],
        badge: 'VINYL LP',
        color: '#1e293b',
        description: 'Bìa đĩa than đôi (Gatefold Vinyl) mở rộng của các album nhạc phim bom tấn, với đĩa than nhựa đen bóng loáng.'
    },
    {
        id: 'movie_169_racing_speed',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'Đua Xe Tốc Độ 16:9',
        tagline: 'Vệt mờ chuyển động, mặt đường đua & font nghiêng',
        recommendedImages: '3 ảnh',
        idealSlots: 3,
        slotLabels: ['Xe đua bứt tốc', 'Tay đua chính', 'Đèn hậu xé gió'],
        badge: 'HIGH SPEED',
        color: '#ef4444',
        description: 'Cảm giác tốc độ xé gió với vệt sáng đèn xe kéo dài trên mặt đường nhựa, chữ in nghiêng thể thao tràn đầy năng lượng.'
    },
    {
        id: 'movie_169_epic_battlefield',
        category: 'phim_anh',
        aspectRatio: '16:9',
        name: 'Tráng Ca Sử Thi 16:9',
        tagline: 'Cảnh chiến trường hoàng hôn mờ khói & anh hùng ca',
        recommendedImages: '3 ảnh',
        idealSlots: 3,
        slotLabels: ['Đoàn quân xa xăm', 'Tướng lĩnh trung tâm', 'Lá cờ chiến thắng'],
        badge: 'EPIC SAGA',
        color: '#78350f',
        description: 'Màu sắc sử thi huyền thoại với khói lửa hoàng hôn mịt mù, bóng cờ bay phấp phới và khúc ca khải hoàn tráng lệ.'
    }
];

// Helper: Normalize template ID so legacy IDs map smoothly to their modern 9:16 or 16:9 equivalents
function normalizeTemplateId(id: PosterTemplateId): PosterTemplateId {
    const legacyMap: Record<string, PosterTemplateId> = {
        'tnt_wood_classic': 'kyyeu_169_wood_frame_3d',
        'bff_thanh_xuan': 'kyyeu_169_thanh_xuan_blend',
        'bento_catalog_8': 'kyyeu_916_bento_mobile',
        'grid_10_max': 'kyyeu_916_max10_grid',
        'magazine_vogue': 'kyyeu_916_vogue_editorial',
        'polaroid_moodboard': 'kyyeu_916_instax_washi',
        'newspaper_retro': 'kyyeu_916_newspaper_retro',
        'wall_gallery_5': 'kyyeu_169_wall_gallery',
        'cinema_film_strip': 'movie_916_kodak_strip',
        'story_9_16_music': 'movie_916_music_player',
        'kyyeu_tuoi_hoc_tro_aloha': 'kyyeu_169_aloha_bento',
        'kyyeu_cuon_film_sotay': 'kyyeu_916_film_sotay',
        'kyyeu_nang_xien_bff': 'kyyeu_169_nang_xien_bff',
        'kyyeu_dai_phim_uon_luon': 'kyyeu_169_curved_film',
        'kyyeu_scrapbook_vintage': 'kyyeu_916_scrapbook_vintage',
        'kyyeu_youth_dream_co': 'kyyeu_169_youth_dream',
        'kyyeu_khi_ta_con_tre_tennis': 'kyyeu_916_tennis_polaroid',
        'movie_wetv_romance': 'movie_916_wetv_romance',
        'movie_kdrama_split': 'movie_916_kdrama_split',
        'movie_pastel_dream': 'movie_916_pastel_bubble',
        'movie_vieon_fireworks': 'movie_916_vieon_firefly'
    };
    return legacyMap[id] || id;
}

// =============================================================================
// GRAPHIC ENGINE HELPER FUNCTIONS
// =============================================================================

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error('Không thể tải ảnh vào bộ nhớ canvas: ' + String(e)));
        img.src = src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:')
            ? src
            : `data:image/jpeg;base64,${src}`;
    });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawCoverImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number = 0,
    faces?: FaceBox[],
    cropBiasY: number = 0.3
) {
    ctx.save();
    if (radius > 0) {
        roundRect(ctx, x, y, w, h, radius);
        ctx.clip();
    }
    const crop = calculateSmartCrop(img, w, h, faces || [], cropBiasY);
    ctx.drawImage(img, crop.sx, crop.sy, crop.sWidth, crop.sHeight, x, y, w, h);
    ctx.restore();
}

function drawBlurredBackground(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number,
    blurPx: number = 28,
    overlayColor: string = 'rgba(15, 23, 42, 0.45)',
    faces?: FaceBox[]
) {
    ctx.save();
    try {
        ctx.filter = `blur(${blurPx}px)`;
    } catch {
        // Fallback
    }
    const bleed = blurPx * 2;
    drawCoverImage(ctx, img, -bleed, -bleed, w + bleed * 2, h + bleed * 2, 0, faces, 0.3);
    ctx.restore();

    ctx.fillStyle = overlayColor;
    ctx.fillRect(0, 0, w, h);
}

function drawFeatheredCoverImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    featherTop: number = 0,
    featherBottom: number = 0,
    faces?: FaceBox[],
    biasY: number = 0.3
) {
    const temp = document.createElement('canvas');
    temp.width = Math.max(1, Math.round(w));
    temp.height = Math.max(1, Math.round(h));
    const tCtx = temp.getContext('2d');
    if (!tCtx) {
        drawCoverImage(ctx, img, x, y, w, h, 0, faces, biasY);
        return;
    }

    drawCoverImage(tCtx, img, 0, 0, w, h, 0, faces, biasY);

    tCtx.save();
    tCtx.globalCompositeOperation = 'destination-in';
    const maskGrad = tCtx.createLinearGradient(0, 0, 0, h);
    if (featherTop > 0) {
        const topStop = Math.min(0.48, featherTop / h);
        maskGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        maskGrad.addColorStop(topStop, 'rgba(0, 0, 0, 1)');
    } else {
        maskGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    }
    if (featherBottom > 0) {
        const botStop = Math.max(0.52, 1 - featherBottom / h);
        maskGrad.addColorStop(botStop, 'rgba(0, 0, 0, 1)');
        maskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
        maskGrad.addColorStop(1, 'rgba(0, 0, 0, 1)');
    }
    tCtx.fillStyle = maskGrad;
    tCtx.fillRect(0, 0, w, h);
    tCtx.restore();

    ctx.drawImage(temp, x, y, w, h);
}

function drawOutlinedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    font: string,
    fillColor: string,
    strokeColor: string = '#ffffff',
    strokeWidth: number = 10,
    align: CanvasTextAlign = 'left'
) {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;

    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.strokeText(text, x, y);

    ctx.fillStyle = fillColor;
    ctx.shadowColor = 'transparent';
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawPlatformBadge(
    ctx: CanvasRenderingContext2D,
    platform: 'wetv' | 'vieon' | 'netflix' | 'cinema' | 'none' | undefined,
    cx: number,
    cy: number,
    scale: number = 1
) {
    if (!platform || platform === 'none') return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    if (platform === 'wetv') {
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        roundRect(ctx, -110, -28, 60, 56, 16);
        ctx.fillStyle = '#0ea5e9';
        ctx.fill();
        ctx.beginPath();
        roundRect(ctx, -98, -22, 46, 44, 12);
        ctx.fillStyle = '#f97316';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-82, -10);
        ctx.lineTo(-64, 0);
        ctx.lineTo(-82, 10);
        ctx.closePath();
        ctx.fill();
        ctx.font = '800 44px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('WeTV', -38, 2);
    } else if (platform === 'vieon') {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 12;
        ctx.font = '900 48px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Vie', -25, 0);
        ctx.beginPath();
        ctx.arc(28, 0, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('N', 66, 0);
        ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText('by DatVietVAC', 18, 34);
    } else if (platform === 'netflix') {
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 12;
        ctx.font = '900 46px "Oswald", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e50914';
        ctx.fillText('NETFLIX', 0, 0);
        ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('ORIGINAL SERIES', 0, 32);
    } else if (platform === 'cinema') {
        roundRect(ctx, -115, -24, 230, 48, 24);
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = '800 22px "Oswald", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★  CINEMA EDITION  ★', 0, 1);
    }
    ctx.restore();
}

function drawFilmCanister(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    rot: number,
    variant: 'fuji' | 'kodak'
) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;

    roundRect(ctx, -50, -70, 100, 140, 10);
    ctx.fillStyle = variant === 'fuji' ? '#059669' : '#facc15';
    ctx.fill();

    ctx.fillStyle = '#18181b';
    roundRect(ctx, -54, -76, 108, 20, 5);
    ctx.fill();
    roundRect(ctx, -54, 56, 108, 20, 5);
    ctx.fill();

    roundRect(ctx, -22, -92, 44, 18, 4);
    ctx.fill();

    ctx.fillStyle = variant === 'fuji' ? '#ffffff' : '#b91c1c';
    ctx.fillRect(-50, -25, 100, 55);

    ctx.shadowColor = 'transparent';
    ctx.textAlign = 'center';
    ctx.font = '900 26px "Oswald", sans-serif';
    ctx.fillStyle = variant === 'fuji' ? '#059669' : '#ffffff';
    ctx.fillText(variant === 'fuji' ? 'FUJIFILM' : 'KODAK', 0, -2);
    ctx.font = '800 22px monospace';
    ctx.fillText(variant === 'fuji' ? '200' : '400', 0, 22);
    ctx.restore();
}

function drawDeckleEdgeCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = '#faf6ee') {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    const step = 18;
    ctx.moveTo(x, y);
    for (let ix = x; ix < x + w; ix += step) ctx.lineTo(ix, y + ((ix / step) % 2 === 0 ? -4 : 4));
    for (let iy = y; iy < y + h; iy += step) ctx.lineTo(x + w + ((iy / step) % 2 === 0 ? -4 : 4), iy);
    for (let ix = x + w; ix > x; ix -= step) ctx.lineTo(ix, y + h + ((ix / step) % 2 === 0 ? -4 : 4));
    for (let iy = y + h; iy > y; iy -= step) ctx.lineTo(x + ((iy / step) % 2 === 0 ? -4 : 4), iy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
}

function drawSoapBubbles(ctx: CanvasRenderingContext2D, designW: number, designH: number) {
    const bubbles = [
        { x: 0.12, y: 0.25, r: 85 },
        { x: 0.88, y: 0.18, r: 70 },
        { x: 0.2, y: 0.58, r: 52 },
        { x: 0.85, y: 0.55, r: 110 },
        { x: 0.08, y: 0.78, r: 65 },
        { x: 0.92, y: 0.85, r: 80 }
    ];
    bubbles.forEach((b) => {
        const bx = b.x * designW;
        const by = b.y * designH;
        const g = ctx.createRadialGradient(bx - b.r * 0.3, by - b.r * 0.3, b.r * 0.1, bx, by, b.r);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        g.addColorStop(0.7, 'rgba(186, 230, 253, 0.18)');
        g.addColorStop(0.95, 'rgba(244, 114, 182, 0.28)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.save();
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawFireflies(ctx: CanvasRenderingContext2D, designW: number, designH: number, color = '#fde047') {
    const pts = [
        [0.12, 0.32, 8], [0.22, 0.62, 5], [0.35, 0.45, 7], [0.48, 0.22, 4],
        [0.62, 0.58, 9], [0.76, 0.35, 6], [0.88, 0.52, 8], [0.16, 0.82, 6],
        [0.42, 0.76, 5], [0.72, 0.81, 7], [0.91, 0.24, 5], [0.28, 0.18, 4]
    ];
    pts.forEach(([px, py, pr]) => {
        const cx = px * designW;
        const cy = py * designH;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr * 4);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, color);
        g.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.save();
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, pr * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function draw3DWoodFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frameW: number = 46) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.48)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = '#5c3818';
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // Top
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - frameW, y + frameW);
    ctx.lineTo(x + frameW, y + frameW);
    ctx.closePath();
    const gTop = ctx.createLinearGradient(x, y, x, y + frameW);
    gTop.addColorStop(0, '#cda16e');
    gTop.addColorStop(0.3, '#dfba89');
    gTop.addColorStop(1, '#784d26');
    ctx.fillStyle = gTop;
    ctx.fill();
    ctx.restore();

    // Bottom
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w - frameW, y + h - frameW);
    ctx.lineTo(x + frameW, y + h - frameW);
    ctx.closePath();
    const gBot = ctx.createLinearGradient(x, y + h - frameW, x, y + h);
    gBot.addColorStop(0, '#533116');
    gBot.addColorStop(1, '#3b200b');
    ctx.fillStyle = gBot;
    ctx.fill();
    ctx.restore();

    // Left
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + frameW, y + h - frameW);
    ctx.lineTo(x + frameW, y + frameW);
    ctx.closePath();
    const gLeft = ctx.createLinearGradient(x, y, x + frameW, y);
    gLeft.addColorStop(0, '#be905d');
    gLeft.addColorStop(1, '#5a3416');
    ctx.fillStyle = gLeft;
    ctx.fill();
    ctx.restore();

    // Right
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w - frameW, y + h - frameW);
    ctx.lineTo(x + w - frameW, y + frameW);
    ctx.closePath();
    const gRight = ctx.createLinearGradient(x + w - frameW, y, x + w, y);
    gRight.addColorStop(0, '#603919');
    gRight.addColorStop(1, '#45260e');
    ctx.fillStyle = gRight;
    ctx.fill();
    ctx.restore();
}

function drawFilmSprocketHoles(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    orientation: 'horizontal' | 'vertical'
) {
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    if (orientation === 'horizontal') {
        for (let ix = x + 18; ix < x + w - 24; ix += 48) {
            roundRect(ctx, ix, y + 8, 28, 20, 5);
            ctx.fill();
            roundRect(ctx, ix, y + h - 28, 28, 20, 5);
            ctx.fill();
        }
    } else {
        for (let iy = y + 18; iy < y + h - 24; iy += 48) {
            roundRect(ctx, x + 8, iy, 20, 28, 5);
            ctx.fill();
            roundRect(ctx, x + w - 28, iy, 20, 28, 5);
            ctx.fill();
        }
    }
    ctx.restore();
}

// =============================================================================
// MAIN STUDIO POSTER RENDER FUNCTION
// =============================================================================
export async function renderStudioPoster(
    images: string[],
    options: PosterOptions
): Promise<string> {
    if (!images || images.length === 0) {
        throw new Error('Cần ít nhất 1 ảnh để tạo poster.');
    }

    if (typeof document !== 'undefined' && document.fonts) {
        try {
            await document.fonts.ready;
        } catch {
            // Safe
        }
    }

    const loadedImages: HTMLImageElement[] = [];
    for (const src of images) {
        try {
            const img = await loadImage(src);
            loadedImages.push(img);
        } catch (e) {
            console.warn('Bỏ qua 1 ảnh không tải được:', e);
        }
    }

    if (loadedImages.length === 0) {
        throw new Error('Không có ảnh hợp lệ để xử lý poster.');
    }

    const faceMap = new Map<HTMLImageElement, FaceBox[]>();
    await Promise.all(
        loadedImages.map(async (img) => {
            try {
                const faces = await detectFacesInImage(img);
                faceMap.set(img, faces);
            } catch (err) {
                console.warn('[Poster] Face detect fallback for image:', err);
                faceMap.set(img, []);
            }
        })
    );

    const getImg = (index: number) => loadedImages[index % loadedImages.length];
    const getFaces = (index: number) => faceMap.get(getImg(index)) || [];

    // Normalize ID
    const targetId = normalizeTemplateId(options.templateId);
    const meta = POSTER_TEMPLATES.find((t) => t.id === targetId) || POSTER_TEMPLATES[0];

    // Determine Canvas Base Dimensions strictly according to ratio
    const is916 = meta.aspectRatio === '9:16';
    const designW = is916 ? 1350 : 2400;
    const designH = is916 ? 2400 : 1350;

    const resolutionScale = options.resolution === '2K' ? 1.0 : 0.8;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(designW * resolutionScale);
    canvas.height = Math.round(designH * resolutionScale);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ Canvas 2D.');

    ctx.scale(resolutionScale, resolutionScale);

    // Text & options
    const biasY = options.cropBiasY ?? 0.3;
    const concept = options.conceptName?.trim() || (is916 ? 'Tuổi Học Trò' : 'Thanh Xuân');
    const studio = options.studioName?.trim() || 'TNT MEDIA';
    const slogan = options.slogan?.trim() || 'TOP 10 KỶ YẾU CÓ TÂM';
    const hotline = options.hotline?.trim() || '094 191 59 68';
    const yearTag = options.yearTag?.trim() || 'kỷ yếu 2025-2026';
    const quoteText = options.quoteText?.trim() || 'Điều đẹp đẽ không phải tuổi thanh xuân, mà là trong tuổi thanh xuân đó có họ.';
    const movieTitle = options.movieTitle?.trim() || 'TÌNH YÊU ANH DÀNH CHO EM';
    const movieSubtitle = options.movieSubtitle?.trim() || 'One Of A Kind Romance';
    const actors = options.actors?.trim() || 'TUẤN ANH  ✕  THU TRANG';
    const platform = options.platform ?? 'wetv';
    const broadcastTime = options.broadcastTime?.trim() || '19:00 Mỗi ngày | TRỌN BỘ';
    const releaseDate = options.releaseDate?.trim() || '28.12.2026';

    // Set clean default light background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, designW, designH);

    // =========================================================================
    // RENDERING LOGIC FOR ALL 60 TEMPLATES
    // =========================================================================

    // --- 1. KỶ YẾU 9:16 (15 Mẫu) ---
    if (targetId === 'kyyeu_916_film_sotay') {
        // 1. Sổ tay ô ly
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, designW, designH);
        ctx.save();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        for (let x = 40; x < designW; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, designH); ctx.stroke(); }
        for (let y = 40; y < designH; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(designW, y); ctx.stroke(); }
        ctx.restore();

        drawOutlinedText(ctx, `Top cuộn film chụp ${concept}`, designW / 2, 170, 'italic 700 68px "Dancing Script", cursive', '#1d4ed8', '#ffffff', 8, 'center');
        
        const cards = [
            { x: 100, y: 260, w: 540, h: 480, rot: -0.04, i: 0 },
            { x: 690, y: 310, w: 560, h: 500, rot: 0.03, i: 1 },
            { x: 90, y: 800, w: 520, h: 540, rot: 0.02, i: 2 },
            { x: 670, y: 860, w: 580, h: 520, rot: -0.03, i: 3 },
            { x: 120, y: 1400, w: 540, h: 520, rot: -0.02, i: 4 },
            { x: 700, y: 1440, w: 540, h: 520, rot: 0.04, i: 5 }
        ];
        cards.forEach((c) => {
            ctx.save();
            ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
            ctx.rotate(c.rot);
            ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
            roundRect(ctx, c.x, c.y, c.w, c.h, 12);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(15,23,42,0.25)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
            ctx.fill();
            drawCoverImage(ctx, getImg(c.i), c.x + 16, c.y + 16, c.w - 32, c.h - 32, 6, getFaces(c.i), biasY);
            ctx.restore();
        });
        drawFilmCanister(ctx, 1150, 720, 0.85, 0.2, 'fuji');
        drawFilmCanister(ctx, 220, 1980, 0.95, -0.15, 'kodak');
        ctx.save(); ctx.textAlign = 'center'; ctx.font = '700 24px "Plus Jakarta Sans", sans-serif'; ctx.fillStyle = '#475569';
        ctx.fillText(`${studio.toUpperCase()}  •  ${yearTag}  •  Hotline: ${hotline}`, designW / 2, designH - 50); ctx.restore();
    }
    else if (targetId === 'kyyeu_916_tennis_polaroid') {
        // 2. Tennis Polaroid
        const h3 = designH / 3;
        drawCoverImage(ctx, getImg(0), 0, 0, designW, h3 + 60, 0, getFaces(0), biasY);
        drawFeatheredCoverImage(ctx, getImg(1), 0, h3, designW, h3 + 60, 60, 60, getFaces(1), biasY);
        drawFeatheredCoverImage(ctx, getImg(2), 0, h3 * 2, designW, h3, 60, 0, getFaces(2), biasY);

        drawOutlinedText(ctx, concept || 'Khi ta còn trẻ', designW - 80, h3 + 70, 'italic 700 88px "Dancing Script", cursive', '#ffffff', 'rgba(15,23,42,0.6)', 10, 'right');

        const pols = [{ x: 140, y: h3 + 90, w: 480, h: 450, rot: -0.05, i: 3 }, { x: 700, y: h3 + 170, w: 500, h: 460, rot: 0.06, i: 4 }];
        pols.forEach(p => {
            ctx.save();
            ctx.translate(p.x + p.w / 2, p.y + p.h / 2); ctx.rotate(p.rot); ctx.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));
            roundRect(ctx, p.x, p.y, p.w, p.h, 10); ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 24; ctx.fill();
            drawCoverImage(ctx, getImg(p.i), p.x + 16, p.y + 16, p.w - 32, p.h - 80, 4, getFaces(p.i), biasY);
            ctx.restore();
        });
    }
    else if (targetId === 'kyyeu_916_scrapbook_vintage') {
        // 3. Scrapbook
        drawBlurredBackground(ctx, getImg(0), designW, designH, 24, 'rgba(30,41,59,0.5)', getFaces(0));
        ctx.fillStyle = '#dc2626'; ctx.fillRect(0, designH / 2 + 100, designW, 30);
        const scs = [
            { x: 100, y: 120, w: 560, h: 620, rot: -0.03, i: 0 },
            { x: 700, y: 140, w: 540, h: 620, rot: 0.03, i: 1 },
            { x: 120, y: 840, w: 520, h: 560, rot: 0.02, i: 2 },
            { x: 700, y: 850, w: 540, h: 580, rot: -0.02, i: 3 },
            { x: 260, y: 1480, w: 820, h: 680, rot: 0.01, i: 4 }
        ];
        scs.forEach(sc => {
            ctx.save();
            ctx.translate(sc.x + sc.w / 2, sc.y + sc.h / 2); ctx.rotate(sc.rot); ctx.translate(-(sc.x + sc.w / 2), -(sc.y + sc.h / 2));
            drawDeckleEdgeCard(ctx, sc.x, sc.y, sc.w, sc.h, '#faf6ee');
            drawCoverImage(ctx, getImg(sc.i), sc.x + 18, sc.y + 18, sc.w - 36, sc.h - 70, 4, getFaces(sc.i), biasY);
            ctx.restore();
        });
        drawOutlinedText(ctx, concept, designW / 2, designH - 100, 'italic 700 76px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.85)', 10, 'center');
    }
    else if (targetId === 'kyyeu_916_bento_mobile') {
        // 4. Bento Mobile 7 ô
        const pad = 50; const gap = 20;
        const heroH = 880;
        drawCoverImage(ctx, getImg(0), pad, pad, designW - 2 * pad, heroH, 24, getFaces(0), biasY);
        const w2 = (designW - 2 * pad - gap) / 2;
        const rowH = 420;
        for (let r = 0; r < 3; r++) {
            const ry = pad + heroH + gap + r * (rowH + gap);
            drawCoverImage(ctx, getImg(1 + r * 2), pad, ry, w2, rowH, 18, getFaces(1 + r * 2), biasY);
            drawCoverImage(ctx, getImg(2 + r * 2), pad + w2 + gap, ry, w2, rowH, 18, getFaces(2 + r * 2), biasY);
        }
        drawOutlinedText(ctx, concept, pad + 30, pad + 80, '900 68px "Oswald", sans-serif', options.accentColor, '#ffffff', 10);
    }
    else if (targetId === 'kyyeu_916_max10_grid') {
        // 5. Max 10 Grid Dọc
        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, designW, designH);
        const pad = 45; const gap = 16;
        drawOutlinedText(ctx, `${concept.toUpperCase()}  •  MAX 10`, designW / 2, pad + 65, '900 52px "Oswald", sans-serif', '#ffffff', 'transparent', 0, 'center');
        const t1Y = pad + 120; const t1W = (designW - 2 * pad - gap) / 2; const t1H = 640;
        drawCoverImage(ctx, getImg(0), pad, t1Y, t1W, t1H, 18, getFaces(0), biasY);
        drawCoverImage(ctx, getImg(1), pad + t1W + gap, t1Y, t1W, t1H, 18, getFaces(1), biasY);

        const t2Y = t1Y + t1H + gap; const t2W = (designW - 2 * pad - 2 * gap) / 3; const t2H = 580;
        for (let i = 0; i < 3; i++) drawCoverImage(ctx, getImg(2 + i), pad + i * (t2W + gap), t2Y, t2W, t2H, 16, getFaces(2 + i), biasY);

        const t3Y = t2Y + t2H + gap; const t3W = (designW - 2 * pad - 4 * gap) / 5; const t3H = 680;
        for (let i = 0; i < 5; i++) drawCoverImage(ctx, getImg(5 + i), pad + i * (t3W + gap), t3Y, t3W, t3H, 14, getFaces(5 + i), biasY);

        ctx.save(); ctx.textAlign = 'center'; ctx.font = '700 24px "Plus Jakarta Sans", sans-serif'; ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${studio.toUpperCase()}  •  ${yearTag}  •  ${slogan}`, designW / 2, designH - 45); ctx.restore();
    }
    else if (targetId === 'kyyeu_916_vogue_editorial') {
        // 6. Vogue 9:16
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        const gT = ctx.createLinearGradient(0, 0, 0, 420); gT.addColorStop(0, 'rgba(0,0,0,0.7)'); gT.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gT; ctx.fillRect(0, 0, designW, 420);
        const gB = ctx.createLinearGradient(0, designH - 580, 0, designH); gB.addColorStop(0, 'rgba(0,0,0,0)'); gB.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = gB; ctx.fillRect(0, designH - 580, designW, 580);

        ctx.save(); ctx.textAlign = 'center'; ctx.font = '900 180px "Playfair Display", serif'; ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20; ctx.fillText('VOGUE', designW / 2, 210);
        ctx.font = '700 24px "Plus Jakarta Sans", sans-serif'; ctx.fillText(`${studio.toUpperCase()}  •  ${yearTag.toUpperCase()}`, designW / 2, 265); ctx.restore();

        const tw = 200; const th = 270; const ty = designH - th - 80; const sx = designW - 3 * tw - 2 * 20 - 70;
        for (let i = 0; i < 3; i++) {
            roundRect(ctx, sx + i * (tw + 20), ty, tw, th, 14); ctx.fillStyle = '#ffffff'; ctx.fill();
            drawCoverImage(ctx, getImg(1 + i), sx + i * (tw + 20) + 6, ty + 6, tw - 12, th - 12, 10, getFaces(1 + i), biasY);
        }
        drawOutlinedText(ctx, concept, 70, designH - 240, 'italic 700 68px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.7)', 10);
    }
    else if (targetId === 'kyyeu_916_newspaper_retro') {
        // 7. Newspaper Retro 9:16
        ctx.fillStyle = '#f6f1e8'; ctx.fillRect(0, 0, designW, designH);
        const pad = 50;
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3; ctx.strokeRect(pad, pad, designW - 2 * pad, designH - 2 * pad);
        ctx.save(); ctx.textAlign = 'center'; ctx.font = '900 84px "Playfair Display", serif'; ctx.fillStyle = '#0f172a';
        ctx.fillText('THE YOUTH TIMES', designW / 2, pad + 105); ctx.restore();

        const mainH = 920;
        drawCoverImage(ctx, getImg(0), pad + 20, pad + 160, designW - 2 * pad - 40, mainH, 0, getFaces(0), biasY);

        drawOutlinedText(ctx, `KỶ YẾU: ${concept.toUpperCase()}`, designW / 2, pad + 160 + mainH + 60, '900 46px "Playfair Display", serif', '#0f172a', 'transparent', 0, 'center');

        const colW = (designW - 2 * pad - 80) / 3; const colH = 480; const colY = pad + 160 + mainH + 100;
        for (let i = 0; i < 3; i++) drawCoverImage(ctx, getImg(1 + i), pad + 20 + i * (colW + 20), colY, colW, colH, 0, getFaces(1 + i), biasY);
    }
    else if (targetId === 'kyyeu_916_starry_night') {
        // 8. Dải Ngân Hà 9:16
        const g = ctx.createLinearGradient(0, 0, 0, designH); g.addColorStop(0, '#020617'); g.addColorStop(0.5, '#1e1b4b'); g.addColorStop(1, '#09090b');
        ctx.fillStyle = g; ctx.fillRect(0, 0, designW, designH);
        drawFireflies(ctx, designW, designH, '#93c5fd');
        const pad = 55;
        drawCoverImage(ctx, getImg(0), pad, 180, designW - 2 * pad, 960, 28, getFaces(0), biasY);
        const cw = (designW - 2 * pad - 30) / 2; const ch = 520; const cy = 1180;
        drawCoverImage(ctx, getImg(1), pad, cy, cw, ch, 20, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), pad + cw + 30, cy, cw, ch, 20, getFaces(2), biasY);
        drawCoverImage(ctx, getImg(3), pad, cy + ch + 30, designW - 2 * pad, 480, 20, getFaces(3), biasY);

        drawOutlinedText(ctx, `✨ ${concept} ✨`, designW / 2, 120, 'italic 700 64px "Dancing Script", cursive', '#e0e7ff', 'rgba(99,102,241,0.5)', 8, 'center');
    }
    else if (targetId === 'kyyeu_916_concert_ticket') {
        // 9. Concert Ticket 9:16
        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, designW, designH);
        const pad = 60; const boxH = designH - 2 * pad;
        roundRect(ctx, pad, pad, designW - 2 * pad, boxH, 24); ctx.fillStyle = '#1e293b'; ctx.fill();
        drawCoverImage(ctx, getImg(0), pad + 25, pad + 25, designW - 2 * pad - 50, 1100, 16, getFaces(0), biasY);

        ctx.strokeStyle = '#64748b'; ctx.setLineDash([12, 12]);
        ctx.beginPath(); ctx.moveTo(pad, pad + 1160); ctx.lineTo(designW - pad, pad + 1160); ctx.stroke();
        ctx.setLineDash([]);

        const tw = (designW - 2 * pad - 60) / 2;
        drawCoverImage(ctx, getImg(1), pad + 25, pad + 1200, tw, 540, 14, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), pad + 25 + tw + 10, pad + 1200, tw, 540, 14, getFaces(2), biasY);

        drawOutlinedText(ctx, `LIVE CONCERT: ${concept.toUpperCase()}`, designW / 2, pad + 1840, '900 52px "Oswald", sans-serif', '#f43f5e', '#ffffff', 8, 'center');
        ctx.save(); ctx.textAlign = 'center'; ctx.font = '700 24px monospace'; ctx.fillStyle = '#94a3b8';
        ctx.fillText(`VIP PASS  •  NO. 2026-A12  •  ${studio}`, designW / 2, pad + 1920); ctx.restore();
    }
    else if (targetId === 'kyyeu_916_rainy_window') {
        // 10. Cửa Sổ Mưa 9:16
        drawBlurredBackground(ctx, getImg(0), designW, designH, 32, 'rgba(15,23,42,0.6)', getFaces(0));
        drawSoapBubbles(ctx, designW, designH);
        const pad = 65;
        drawCoverImage(ctx, getImg(1), pad, 220, designW - 2 * pad, 1050, 24, getFaces(1), biasY);
        const bw = (designW - 2 * pad - 24) / 2; const bh = 600; const by = 1320;
        drawCoverImage(ctx, getImg(2), pad, by, bw, bh, 20, getFaces(2), biasY);
        drawCoverImage(ctx, getImg(3), pad + bw + 24, by, bw, bh, 20, getFaces(3), biasY);

        drawOutlinedText(ctx, `Mưa rơi kỷ niệm...`, designW / 2, 150, 'italic 700 68px "Dancing Script", cursive', '#e0f2fe', 'rgba(0,0,0,0.5)', 8, 'center');
        drawOutlinedText(ctx, concept, designW / 2, designH - 120, '700 48px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.8)', 8, 'center');
    }
    else if (targetId === 'kyyeu_916_y2k_student_id') {
        // 11. Y2K Student ID 9:16
        ctx.fillStyle = '#e0e7ff'; ctx.fillRect(0, 0, designW, designH);
        const pad = 55;
        roundRect(ctx, pad, pad, designW - 2 * pad, designH - 2 * pad, 32); ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 24; ctx.fill();
        roundRect(ctx, pad, pad, designW - 2 * pad, 160, 32); ctx.fillStyle = '#4f46e5'; ctx.fill();

        ctx.save(); ctx.textAlign = 'center'; ctx.font = '900 48px "Oswald", sans-serif'; ctx.fillStyle = '#ffffff';
        ctx.fillText(`STUDENT IDENTITY CARD  •  ${yearTag}`, designW / 2, pad + 100); ctx.restore();

        drawCoverImage(ctx, getImg(0), pad + 40, pad + 210, designW - 2 * pad - 80, 1050, 20, getFaces(0), biasY);
        const sw = (designW - 2 * pad - 100) / 2; const sy = pad + 1300;
        drawCoverImage(ctx, getImg(1), pad + 40, sy, sw, 520, 16, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), pad + 40 + sw + 20, sy, sw, 520, 16, getFaces(2), biasY);

        drawOutlinedText(ctx, `CLASS: ${concept.toUpperCase()}`, designW / 2, designH - 140, '900 48px "Oswald", sans-serif', '#4f46e5', '#ffffff', 8, 'center');
    }
    else if (targetId === 'kyyeu_916_phuong_do') {
        // 12. Hoa Phượng Đỏ 9:16
        const g = ctx.createLinearGradient(0, 0, 0, designH); g.addColorStop(0, '#fef2f2'); g.addColorStop(1, '#fee2e2');
        ctx.fillStyle = g; ctx.fillRect(0, 0, designW, designH);
        const pad = 50;
        drawCoverImage(ctx, getImg(0), pad, 180, designW - 2 * pad, 1100, 24, getFaces(0), biasY);
        const pw = (designW - 2 * pad - 20) / 2; const py = 1320; const ph = 620;
        drawCoverImage(ctx, getImg(1), pad, py, pw, ph, 18, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), pad + pw + 20, py, pw, ph, 18, getFaces(2), biasY);

        drawOutlinedText(ctx, `Mùa Phượng Vĩ  •  ${concept}`, designW / 2, 110, 'italic 700 68px "Dancing Script", cursive', '#dc2626', '#ffffff', 8, 'center');
        ctx.save(); ctx.textAlign = 'center'; ctx.font = 'italic 600 24px "Playfair Display", serif'; ctx.fillStyle = '#991b1b';
        ctx.fillText(`“${quoteText.slice(0, 50)}...”`, designW / 2, designH - 80); ctx.restore();
    }
    else if (targetId === 'kyyeu_916_instax_washi') {
        // 13. Instax Washi Tape 9:16
        ctx.fillStyle = '#fef3c7'; ctx.fillRect(0, 0, designW, designH);
        drawOutlinedText(ctx, concept || 'Thanh Xuân Của Chúng Ta', designW / 2, 110, 'italic 700 68px "Dancing Script", cursive', '#78350f', '#ffffff', 8, 'center');
        const pos = [
            { x: 80, y: 180, w: 540, h: 620, rot: -0.04, i: 0 }, { x: 720, y: 200, w: 540, h: 620, rot: 0.03, i: 1 },
            { x: 90, y: 840, w: 540, h: 620, rot: 0.02, i: 2 }, { x: 710, y: 860, w: 540, h: 620, rot: -0.03, i: 3 },
            { x: 80, y: 1500, w: 540, h: 620, rot: -0.02, i: 4 }, { x: 720, y: 1520, w: 540, h: 620, rot: 0.03, i: 5 }
        ];
        pos.forEach((p, idx) => {
            ctx.save();
            ctx.translate(p.x + p.w / 2, p.y + p.h / 2); ctx.rotate(p.rot); ctx.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));
            roundRect(ctx, p.x, p.y, p.w, p.h, 8); ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 18; ctx.fill();
            drawCoverImage(ctx, getImg(p.i), p.x + 20, p.y + 20, p.w - 40, p.h - 100, 4, getFaces(p.i), biasY);
            // Tape
            ctx.fillStyle = 'rgba(253, 224, 71, 0.75)'; ctx.fillRect(p.x + p.w / 2 - 70, p.y - 12, 140, 28);
            ctx.restore();
        });
    }
    else if (targetId === 'kyyeu_916_chalkboard_art') {
        // 14. Chalkboard 9:16
        ctx.fillStyle = '#064e3b'; ctx.fillRect(0, 0, designW, designH);
        const pad = 55;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 4; ctx.strokeRect(pad, pad, designW - 2 * pad, designH - 2 * pad);
        drawOutlinedText(ctx, `✎ ${concept} ✎`, designW / 2, pad + 90, '700 58px "Caveat", cursive, sans-serif', '#ffffff', 'transparent', 0, 'center');

        drawCoverImage(ctx, getImg(0), pad + 30, pad + 150, designW - 2 * pad - 60, 960, 16, getFaces(0), biasY);
        const cw = (designW - 2 * pad - 80) / 2; const cy = pad + 1150;
        drawCoverImage(ctx, getImg(1), pad + 30, cy, cw, 460, 12, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), pad + 30 + cw + 20, cy, cw, 460, 12, getFaces(2), biasY);
        drawCoverImage(ctx, getImg(3), pad + 30, cy + 490, cw, 460, 12, getFaces(3), biasY);
        drawCoverImage(ctx, getImg(4), pad + 30 + cw + 20, cy + 490, cw, 460, 12, getFaces(4), biasY);
    }
    else if (targetId === 'kyyeu_916_korean_minimal') {
        // 15. Korean Minimal 9:16
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, designW, designH);
        const pad = 80;
        drawCoverImage(ctx, getImg(0), pad, 200, designW - 2 * pad, 1200, 8, getFaces(0), biasY);
        const kw = (designW - 2 * pad - 30) / 2;
        drawCoverImage(ctx, getImg(1), pad, 1440, kw, 640, 6, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), pad + kw + 30, 1440, kw, 640, 6, getFaces(2), biasY);

        ctx.save(); ctx.textAlign = 'center'; ctx.font = '600 32px "Playfair Display", serif'; ctx.fillStyle = '#0f172a';
        ctx.fillText(concept.toUpperCase(), designW / 2, 120);
        ctx.font = '500 20px "Plus Jakarta Sans", sans-serif'; ctx.fillStyle = '#64748b';
        ctx.fillText(`${studio}  •  ${yearTag}`, designW / 2, 160); ctx.restore();
    }

    // --- 2. KỶ YẾU 16:9 (15 Mẫu Ngang) ---
    else if (targetId === 'kyyeu_169_aloha_bento') {
        // 1. Aloha Bento 16:9
        const g = ctx.createLinearGradient(0, 0, designW, 0); g.addColorStop(0, '#f59e0b'); g.addColorStop(1, '#b45309');
        ctx.fillStyle = g; ctx.fillRect(0, 0, designW, designH);
        const pad = 40; const gap = 16;
        const colW = (designW - 2 * pad - 3 * gap) / 4; const rowH = (designH - 2 * pad - gap - 100) / 2;
        for (let c = 0; c < 4; c++) {
            drawCoverImage(ctx, getImg(c), pad + c * (colW + gap), pad, colW, rowH, 14, getFaces(c), biasY);
            drawCoverImage(ctx, getImg(4 + c), pad + c * (colW + gap), pad + rowH + gap, colW, rowH, 14, getFaces(4 + c), biasY);
        }
        drawOutlinedText(ctx, `Concept ${concept}`, designW / 2, designH - 30, 'italic 700 68px "Dancing Script", cursive', '#ffffff', 'rgba(120,53,15,0.7)', 10, 'center');
    }
    else if (targetId === 'kyyeu_169_curved_film') {
        // 2. Dải Phim Uốn 16:9
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), 0.35);
        ctx.save(); ctx.textAlign = 'center'; ctx.font = 'italic 600 34px "Playfair Display", serif'; ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 12; ctx.fillText(`“${quoteText}”`, designW / 2, 90); ctx.restore();

        const filmY = 220; const filmH = 880;
        roundRect(ctx, 40, filmY, designW - 80, filmH, 20); ctx.fillStyle = '#312e81'; ctx.fill();
        drawFilmSprocketHoles(ctx, 40, filmY, designW - 80, filmH, 'horizontal');

        const fw = (designW - 160 - 2 * 30) / 3; const fh = filmH - 140;
        for (let i = 0; i < 3; i++) drawCoverImage(ctx, getImg(1 + i), 80 + i * (fw + 30), filmY + 70, fw, fh, 10, getFaces(1 + i), biasY);
        drawOutlinedText(ctx, `${studio.toUpperCase()}  •  ${concept.toUpperCase()}`, designW / 2, designH - 45, '800 28px "Plus Jakarta Sans", sans-serif', '#ffffff', 'rgba(0,0,0,0.8)', 6, 'center');
    }
    else if (targetId === 'kyyeu_169_nang_xien_bff') {
        // 3. Nắng Xiên 16:9 (9 ô)
        ctx.fillStyle = '#29180c'; ctx.fillRect(0, 0, designW, designH);
        const pad = 30; const gap = 14;
        const w1 = 550; const w2 = 800; const w3 = 550; const w4 = designW - 2 * pad - gap * 3 - w1 - w2 - w3;
        const hTop = 750; const hBot = designH - 2 * pad - gap - hTop;
        drawCoverImage(ctx, getImg(0), pad, pad, w1, hTop, 0, getFaces(0), biasY);
        drawCoverImage(ctx, getImg(1), pad + w1 + gap, pad, w2, hTop, 0, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), pad + w1 + w2 + 2 * gap, pad, w3, hTop, 0, getFaces(2), biasY);
        drawCoverImage(ctx, getImg(3), pad + w1 + w2 + w3 + 3 * gap, pad, w4, hTop, 0, getFaces(3), biasY);

        const bw = (designW - 2 * pad - 4 * gap) / 5;
        for (let i = 0; i < 5; i++) drawCoverImage(ctx, getImg(4 + i), pad + i * (bw + gap), pad + hTop + gap, bw, hBot, 0, getFaces(4 + i), biasY);
    }
    else if (targetId === 'kyyeu_169_youth_dream') {
        // 4. Youth Dream 16:9
        ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, designW, designH);
        const pad = 40; const gap = 20;
        const colW = (designW - 2 * pad - 3 * gap) / 4; const h = designH - 2 * pad - 70;
        for (let i = 0; i < 4; i++) drawCoverImage(ctx, getImg(i), pad + i * (colW + gap), pad, colW, h, 18, getFaces(i), biasY);
        drawOutlinedText(ctx, `CONCEPT YOUTH DREAM  •  ${concept.toUpperCase()}`, designW / 2, designH - 25, '900 32px "Oswald", sans-serif', '#059669', '#ffffff', 6, 'center');
    }
    else if (targetId === 'kyyeu_169_wood_frame_3d') {
        // 5. Wood Frame 16:9
        drawBlurredBackground(ctx, getImg(0), designW, designH, 28, 'rgba(15,23,42,0.45)', getFaces(0));
        const pad = 45; const fW = 1250; const fH = designH - 2 * pad;
        draw3DWoodFrame(ctx, pad, pad, fW, fH, 40);
        drawCoverImage(ctx, getImg(0), pad + 40, pad + 40, fW - 80, fH - 80, 0, getFaces(0), biasY);

        const rX = pad + fW + 30; const rW = designW - rX - pad; const rH = (fH - 20) / 2;
        drawCoverImage(ctx, getImg(1), rX, pad, rW, rH, 18, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), rX, pad + rH + 20, rW, rH, 18, getFaces(2), biasY);
        drawOutlinedText(ctx, concept, rX + 20, pad + 60, '900 48px "Oswald", sans-serif', '#ffffff', 'rgba(0,0,0,0.7)', 8);
    }
    else if (targetId === 'kyyeu_169_thanh_xuan_blend') {
        // 6. Thanh Xuân Blend 16:9
        const leftW = 1350; const rightW = designW - leftW;
        const slotW = leftW / 3;
        for (let i = 0; i < 3; i++) {
            drawCoverImage(ctx, getImg(i), i * slotW, 0, slotW + 50, designH, 0, getFaces(i), biasY);
        }
        drawCoverImage(ctx, getImg(3), leftW, 0, rightW, designH, 0, getFaces(3), biasY);
        drawOutlinedText(ctx, concept || 'Thanh Xuân', leftW / 2, designH / 2, 'italic 700 96px "Dancing Script", cursive', '#ffffff', 'rgba(0,0,0,0.6)', 12, 'center');
    }
    else if (targetId === 'kyyeu_169_wall_gallery') {
        // 7. Wall Gallery 16:9
        const g = ctx.createRadialGradient(designW / 2, 200, 100, designW / 2, designH / 2, designW);
        g.addColorStop(0, '#f8fafc'); g.addColorStop(1, '#94a3b8'); ctx.fillStyle = g; ctx.fillRect(0, 0, designW, designH);
        const specs = [{ w: 360, h: 540 }, { w: 460, h: 720 }, { w: 600, h: 900 }, { w: 460, h: 720 }, { w: 360, h: 540 }];
        const gap = 30; const totalW = specs.reduce((a, b) => a + b.w, 0) + 4 * gap;
        let cx = (designW - totalW) / 2;
        specs.forEach((sp, i) => {
            const cy = (designH - sp.h) / 2;
            draw3DWoodFrame(ctx, cx, cy, sp.w, sp.h, 24);
            drawCoverImage(ctx, getImg(i), cx + 24, cy + 24, sp.w - 48, sp.h - 48, 0, getFaces(i), biasY);
            cx += sp.w + gap;
        });
    }
    else if (targetId === 'kyyeu_169_grand_panorama') {
        // 8. Grand Panorama 16:9
        const topH = 880; const gap = 16; const pad = 35;
        drawCoverImage(ctx, getImg(0), pad, pad, designW - 2 * pad, topH, 16, getFaces(0), biasY);
        const subW = (designW - 2 * pad - 5 * gap) / 6; const subH = designH - pad * 2 - topH - gap;
        for (let i = 0; i < 6; i++) drawCoverImage(ctx, getImg(1 + i), pad + i * (subW + gap), pad + topH + gap, subW, subH, 12, getFaces(1 + i), biasY);
    }
    else if (targetId === 'kyyeu_169_cork_bulletin') {
        // 9. Cork Bulletin 16:9
        ctx.fillStyle = '#b45309'; ctx.fillRect(0, 0, designW, designH);
        const pad = 40;
        roundRect(ctx, pad, pad, designW - 2 * pad, designH - 2 * pad, 16); ctx.fillStyle = '#d97706'; ctx.fill();
        const pCards = [
            { x: 100, y: 120, w: 480, h: 480, rot: -0.04, i: 0 }, { x: 640, y: 100, w: 680, h: 520, rot: 0.02, i: 1 },
            { x: 1380, y: 110, w: 520, h: 480, rot: -0.03, i: 2 }, { x: 1960, y: 140, w: 360, h: 460, rot: 0.04, i: 3 },
            { x: 180, y: 680, w: 660, h: 520, rot: 0.03, i: 4 }, { x: 920, y: 690, w: 800, h: 520, rot: -0.02, i: 5 }
        ];
        pCards.forEach(p => {
            ctx.save();
            ctx.translate(p.x + p.w / 2, p.y + p.h / 2); ctx.rotate(p.rot); ctx.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));
            roundRect(ctx, p.x, p.y, p.w, p.h, 6); ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 16; ctx.fill();
            drawCoverImage(ctx, getImg(p.i), p.x + 14, p.y + 14, p.w - 28, p.h - 28, 4, getFaces(p.i), biasY);
            ctx.restore();
        });
    }
    else if (targetId === 'kyyeu_169_yellow_bus') {
        // 10. Yellow Bus 16:9
        ctx.fillStyle = '#fef08a'; ctx.fillRect(0, 0, designW, designH);
        drawCoverImage(ctx, getImg(0), 40, 40, 1100, designH - 80, 20, getFaces(0), biasY);
        const rw = (designW - 1100 - 120) / 2; const rh = (designH - 100) / 2;
        drawCoverImage(ctx, getImg(1), 1180, 40, rw, rh, 14, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), 1180 + rw + 20, 40, rw, rh, 14, getFaces(2), biasY);
        drawCoverImage(ctx, getImg(3), 1180, 40 + rh + 20, rw, rh, 14, getFaces(3), biasY);
        drawCoverImage(ctx, getImg(4), 1180 + rw + 20, 40 + rh + 20, rw, rh, 14, getFaces(4), biasY);
    }
    else if (targetId === 'kyyeu_169_contact_sheet') {
        // 11. Contact Sheet 16:9
        ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, designW, designH);
        const pad = 40; const gap = 16; const fw = (designW - 2 * pad - 3 * gap) / 4; const fh = (designH - 2 * pad - gap) / 2;
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 4; c++) {
                const idx = r * 4 + c;
                drawCoverImage(ctx, getImg(idx), pad + c * (fw + gap), pad + r * (fh + gap), fw, fh, 4, getFaces(idx), biasY);
            }
        }
    }
    else if (targetId === 'kyyeu_169_open_yearbook') {
        // 12. Open Yearbook 16:9
        ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, designW, designH);
        const pad = 45; const pageW = (designW - 2 * pad - 20) / 2; const pageH = designH - 2 * pad;
        // Left
        drawCoverImage(ctx, getImg(0), pad, pad, pageW, pageH, 8, getFaces(0), biasY);
        // Right
        const rw = (pageW - 20) / 2; const rh = (pageH - 20) / 2;
        drawCoverImage(ctx, getImg(1), pad + pageW + 20, pad, rw, rh, 6, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), pad + pageW + 20 + rw + 20, pad, rw, rh, 6, getFaces(2), biasY);
        drawCoverImage(ctx, getImg(3), pad + pageW + 20, pad + rh + 20, rw, rh, 6, getFaces(3), biasY);
        drawCoverImage(ctx, getImg(4), pad + pageW + 20 + rw + 20, pad + rh + 20, rw, rh, 6, getFaces(4), biasY);
    }
    else if (targetId === 'kyyeu_169_sunset_silhouette') {
        // 13. Sunset Silhouette 16:9
        const g = ctx.createLinearGradient(0, 0, 0, designH); g.addColorStop(0, '#f97316'); g.addColorStop(0.6, '#ea580c'); g.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = g; ctx.fillRect(0, 0, designW, designH);
        const pad = 40; const gap = 20; const w = (designW - 2 * pad - 3 * gap) / 4;
        for (let i = 0; i < 4; i++) drawCoverImage(ctx, getImg(i), pad + i * (w + gap), pad, w, designH - 2 * pad - 80, 16, getFaces(i), biasY);
        drawOutlinedText(ctx, `HOÀNG HÔN THANH XUÂN  •  ${concept.toUpperCase()}`, designW / 2, designH - 35, '800 34px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.6)', 6, 'center');
    }
    else if (targetId === 'kyyeu_169_sports_day') {
        // 14. Sports Day 16:9
        ctx.fillStyle = '#0284c7'; ctx.fillRect(0, 0, designW, designH);
        const pad = 35; const gap = 16; const sw = (designW - 2 * pad - 4 * gap) / 5;
        for (let i = 0; i < 5; i++) drawCoverImage(ctx, getImg(i), pad + i * (sw + gap), pad, sw, designH - 2 * pad - 70, 12, getFaces(i), biasY);
        drawOutlinedText(ctx, `SPORTS FESTIVAL  •  ${concept.toUpperCase()}`, designW / 2, designH - 28, '900 34px "Oswald", sans-serif', '#ffffff', 'rgba(0,0,0,0.7)', 6, 'center');
    }
    else if (targetId === 'kyyeu_169_nordic_lookbook') {
        // 15. Nordic Lookbook 16:9
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, designW, designH);
        const pad = 60; const gap = 24; const nw = (designW - 2 * pad - 4 * gap) / 5;
        for (let i = 0; i < 5; i++) drawCoverImage(ctx, getImg(i), pad + i * (nw + gap), pad, nw, designH - 2 * pad - 90, 4, getFaces(i), biasY);
        ctx.save(); ctx.textAlign = 'center'; ctx.font = '600 24px "Plus Jakarta Sans", sans-serif'; ctx.fillStyle = '#334155';
        ctx.fillText(`LOOKBOOK  •  ${concept.toUpperCase()}  •  ${yearTag}`, designW / 2, designH - 45); ctx.restore();
    }

    // --- 3. PHIM ẢNH 9:16 (15 Mẫu Dọc) ---
    else if (targetId === 'movie_916_wetv_romance') {
        // 1. WeTV Romance 9:16
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawSoapBubbles(ctx, designW, designH);
        const botV = ctx.createLinearGradient(0, designH - 750, 0, designH); botV.addColorStop(0, 'rgba(15,23,42,0)'); botV.addColorStop(1, 'rgba(15,23,42,0.92)');
        ctx.fillStyle = botV; ctx.fillRect(0, designH - 750, designW, 750);
        drawOutlinedText(ctx, movieTitle, designW / 2, designH - 310, '900 84px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.7)', 14, 'center');
        drawPlatformBadge(ctx, platform, designW / 2, designH - 120, 1.25);
    }
    else if (targetId === 'movie_916_kdrama_split') {
        // 2. K-Drama Split 9:16
        const topH = 1200; const halfW = designW / 2;
        drawCoverImage(ctx, getImg(0), 0, 0, halfW, topH, 0, getFaces(0), biasY);
        drawCoverImage(ctx, getImg(1), halfW, 0, halfW, topH, 0, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), 0, topH, designW, designH - topH, 0, getFaces(2), biasY);
        drawOutlinedText(ctx, movieTitle || 'Tiếng Yêu này ANH Dịch được không?', designW / 2, topH + 18, '900 68px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.85)', 12, 'center');
    }
    else if (targetId === 'movie_916_pastel_bubble') {
        // 3. Pastel Bubble 9:16
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawSoapBubbles(ctx, designW, designH);
        drawOutlinedText(ctx, 'Tình Yêu', designW / 2, designH - 340, 'italic 700 96px "Dancing Script", cursive', '#ffffff', 'rgba(0,0,0,0.5)', 12, 'center');
        drawOutlinedText(ctx, 'ĐỘC NHẤT', designW / 2, designH - 220, '900 128px "Oswald", sans-serif', '#f472b6', '#ffffff', 16, 'center');
    }
    else if (targetId === 'movie_916_vieon_firefly') {
        // 4. VieON Firefly 9:16
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawFireflies(ctx, designW, designH, '#86efac');
        drawPlatformBadge(ctx, 'vieon', designW - 180, 85, 1.1);
        drawOutlinedText(ctx, movieTitle, designW / 2, designH - 280, '900 86px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.65)', 12, 'center');
    }
    else if (targetId === 'movie_916_dong_thoai') {
        // 5. Đồng Thoại 9:16
        ctx.fillStyle = '#e5decf'; ctx.fillRect(0, 0, designW, designH);
        drawCoverImage(ctx, getImg(1), 0, designH - 1200, designW, 1200, 0, getFaces(1), biasY);
        drawFeatheredCoverImage(ctx, getImg(0), 0, 0, designW, 1100, 0, 300, getFaces(0), biasY);
        drawOutlinedText(ctx, movieTitle || 'ĐỒNG THOẠI', designW / 2, 1050, '900 68px "Playfair Display", serif', '#ffffff', 'rgba(69,26,3,0.65)', 10, 'center');
    }
    else if (targetId === 'movie_916_music_player') {
        // 6. Music Player 9:16
        drawBlurredBackground(ctx, getImg(0), designW, designH, 32, 'rgba(15,23,42,0.55)', getFaces(0));
        drawCoverImage(ctx, getImg(0), 75, 230, designW - 150, 1000, 36, getFaces(0), biasY);
        const subW = (designW - 180) / 2;
        drawCoverImage(ctx, getImg(1), 75, 1270, subW, 520, 24, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), 75 + subW + 30, 1270, subW, 520, 24, getFaces(2), biasY);
        drawOutlinedText(ctx, movieTitle, designW / 2, 140, '900 54px "Oswald", sans-serif', '#ffffff', 'rgba(0,0,0,0.5)', 8, 'center');
    }
    else if (targetId === 'movie_916_kodak_strip') {
        // 7. Kodak Strip 9:16
        ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, designW, designH);
        const stripX = 60; const stripW = designW - 120;
        drawFilmSprocketHoles(ctx, stripX, 100, stripW, designH - 200, 'vertical');
        const innerX = stripX + 50; const innerW = stripW - 100; const frameH = 460;
        for (let i = 0; i < 4; i++) drawCoverImage(ctx, getImg(i), innerX, 150 + i * (frameH + 30), innerW, frameH, 8, getFaces(i), biasY);
    }
    else if (targetId === 'movie_916_neo_noir') {
        // 8. Neo-Noir 9:16
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        const g = ctx.createLinearGradient(0, 0, 0, designH); g.addColorStop(0, 'rgba(0,0,0,0.8)'); g.addColorStop(0.5, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, designW, designH);
        drawOutlinedText(ctx, movieTitle, designW / 2, designH - 240, '900 84px "Playfair Display", serif', '#dc2626', '#000000', 14, 'center');
    }
    else if (targetId === 'movie_916_campus_kdrama') {
        // 9. Campus K-Drama 9:16
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        const botG = ctx.createLinearGradient(0, designH - 650, 0, designH); botG.addColorStop(0, 'rgba(0,0,0,0)'); botG.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = botG; ctx.fillRect(0, designH - 650, designW, 650);
        drawOutlinedText(ctx, movieTitle, designW / 2, designH - 260, '700 76px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.6)', 10, 'center');
    }
    else if (targetId === 'movie_916_action_blockbuster') {
        // 10. Action Blockbuster 9:16
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawFireflies(ctx, designW, designH, '#f97316');
        drawOutlinedText(ctx, movieTitle.toUpperCase(), designW / 2, designH - 280, '900 96px "Oswald", sans-serif', '#f59e0b', '#000000', 16, 'center');
    }
    else if (targetId === 'movie_916_anime_shinkai') {
        // 11. Anime Shinkai 9:16
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawSoapBubbles(ctx, designW, designH);
        drawOutlinedText(ctx, movieTitle, designW / 2, designH - 260, 'italic 900 84px "Playfair Display", serif', '#ffffff', 'rgba(14,165,233,0.7)', 12, 'center');
    }
    else if (targetId === 'movie_916_wuxia_fantasy') {
        // 12. Wuxia Fantasy 9:16
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawFireflies(ctx, designW, designH, '#fda4af');
        drawOutlinedText(ctx, movieTitle, designW / 2, designH - 280, '700 92px "Dancing Script", cursive', '#fecdd3', 'rgba(0,0,0,0.8)', 12, 'center');
    }
    else if (targetId === 'movie_916_cyberpunk_neon') {
        // 13. Cyberpunk 9:16
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        const g = ctx.createLinearGradient(0, 0, 0, designH); g.addColorStop(0, 'rgba(6,182,212,0.25)'); g.addColorStop(1, 'rgba(217,70,239,0.4)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, designW, designH);
        drawOutlinedText(ctx, movieTitle.toUpperCase(), designW / 2, designH - 260, '900 92px "Oswald", sans-serif', '#22d3ee', '#c084fc', 12, 'center');
    }
    else if (targetId === 'movie_916_fairytale_disney') {
        // 14. Fairytale Disney 9:16
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawFireflies(ctx, designW, designH, '#fde047');
        drawOutlinedText(ctx, movieTitle, designW / 2, designH - 260, 'italic 700 88px "Playfair Display", serif', '#fef08a', 'rgba(0,0,0,0.75)', 12, 'center');
    }
    else if (targetId === 'movie_916_indie_sundance') {
        // 15. Indie Sundance 9:16
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawOutlinedText(ctx, '★ OFFICIAL SELECTION CANNES ★', designW / 2, 220, '700 28px "Oswald", sans-serif', '#facc15', 'transparent', 0, 'center');
        drawOutlinedText(ctx, movieTitle.toUpperCase(), designW / 2, designH - 240, '900 78px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.7)', 10, 'center');
    }

    // --- 4. PHIM ẢNH 16:9 (15 Mẫu Ngang) ---
    else if (targetId === 'movie_169_cinema_widescreen') {
        // 1. Cinema Widescreen 2.39:1
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, designW, designH);
        const barH = 140; const h = designH - 2 * barH;
        drawCoverImage(ctx, getImg(0), 0, barH, designW, h, 0, getFaces(0), biasY);
        drawOutlinedText(ctx, movieTitle.toUpperCase(), designW / 2, designH - barH - 40, '900 72px "Oswald", sans-serif', '#fbbf24', '#000000', 12, 'center');
    }
    else if (targetId === 'movie_169_kdrama_banner') {
        // 2. K-Drama Banner 16:9
        const halfW = designW / 2;
        drawCoverImage(ctx, getImg(0), 0, 0, halfW, designH, 0, getFaces(0), biasY);
        drawCoverImage(ctx, getImg(1), halfW, 0, halfW, designH, 0, getFaces(1), biasY);
        const midG = ctx.createLinearGradient(halfW - 200, 0, halfW + 200, 0); midG.addColorStop(0, 'rgba(0,0,0,0)'); midG.addColorStop(0.5, 'rgba(0,0,0,0.85)'); midG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = midG; ctx.fillRect(halfW - 200, 0, 400, designH);
        drawOutlinedText(ctx, movieTitle, designW / 2, designH / 2 + 20, '900 68px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.8)', 12, 'center');
    }
    else if (targetId === 'movie_169_vieon_prime') {
        // 3. VieON Prime 16:9
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawFireflies(ctx, designW, designH, '#86efac');
        drawPlatformBadge(ctx, 'vieon', designW - 220, 80, 1.2);
        drawOutlinedText(ctx, movieTitle, 80, designH - 120, '900 72px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.8)', 10);
    }
    else if (targetId === 'movie_169_dong_thoai_field') {
        // 4. Đồng Thoại Field 16:9
        ctx.fillStyle = '#e5decf'; ctx.fillRect(0, 0, designW, designH);
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawOutlinedText(ctx, movieTitle || 'ĐỒNG THOẠI', designW / 2, designH - 120, '900 68px "Playfair Display", serif', '#ffffff', 'rgba(69,26,3,0.7)', 10, 'center');
    }
    else if (targetId === 'movie_169_wetv_landscape') {
        // 5. WeTV Landscape 16:9
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawPlatformBadge(ctx, 'wetv', designW - 200, 80, 1.2);
        drawOutlinedText(ctx, movieTitle, 80, designH - 120, '900 72px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.8)', 10);
    }
    else if (targetId === 'movie_169_editing_timeline') {
        // 6. Editing Timeline 16:9
        ctx.fillStyle = '#18181b'; ctx.fillRect(0, 0, designW, designH);
        const pad = 40; const gap = 16; const fw = (designW - 2 * pad - 5 * gap) / 6; const fh = designH - 2 * pad - 120;
        for (let i = 0; i < 6; i++) drawCoverImage(ctx, getImg(i), pad + i * (fw + gap), pad + 60, fw, fh, 8, getFaces(i), biasY);
        drawOutlinedText(ctx, `TIMELINE: ${movieTitle.toUpperCase()}`, designW / 2, 60, '800 32px "Oswald", sans-serif', '#38bdf8', 'transparent', 0, 'center');
    }
    else if (targetId === 'movie_169_trailer_thumbnail') {
        // 7. Trailer Thumbnail 16:9
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        roundRect(ctx, designW / 2 - 60, designH / 2 - 60, 120, 120, 60); ctx.fillStyle = '#dc2626'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 24; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(designW / 2 - 16, designH / 2 - 28); ctx.lineTo(designW / 2 + 32, designH / 2); ctx.lineTo(designW / 2 - 16, designH / 2 + 28); ctx.closePath(); ctx.fill();
        drawOutlinedText(ctx, `OFFICIAL 4K TRAILER  •  ${movieTitle.toUpperCase()}`, designW / 2, designH - 80, '900 48px "Oswald", sans-serif', '#ffffff', '#000000', 10, 'center');
    }
    else if (targetId === 'movie_169_tokyo_citylights') {
        // 8. Tokyo City Lights 16:9
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawSoapBubbles(ctx, designW, designH);
        drawOutlinedText(ctx, movieTitle, designW / 2, designH - 120, 'italic 900 72px "Playfair Display", serif', '#f43f5e', '#ffffff', 10, 'center');
    }
    else if (targetId === 'movie_169_space_interstellar') {
        // 9. Space Interstellar 16:9
        ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, designW, designH);
        drawFireflies(ctx, designW, designH, '#60a5fa');
        drawCoverImage(ctx, getImg(0), 100, 100, designW - 200, designH - 260, 18, getFaces(0), biasY);
        drawOutlinedText(ctx, movieTitle.toUpperCase(), designW / 2, designH - 60, '900 48px "Oswald", sans-serif', '#93c5fd', '#000000', 8, 'center');
    }
    else if (targetId === 'movie_169_vintage_drive_in') {
        // 10. Vintage Drive-In 16:9
        ctx.fillStyle = '#431407'; ctx.fillRect(0, 0, designW, designH);
        const pad = 40; const gap = 20; const w = (designW - 2 * pad - 3 * gap) / 4;
        for (let i = 0; i < 4; i++) drawCoverImage(ctx, getImg(i), pad + i * (w + gap), pad + 60, w, designH - 2 * pad - 120, 12, getFaces(i), biasY);
        drawOutlinedText(ctx, `DRIVE-IN CINEMA  •  ${movieTitle.toUpperCase()}`, designW / 2, 60, '900 36px "Oswald", sans-serif', '#fbbf24', '#000000', 8, 'center');
    }
    else if (targetId === 'movie_169_broadway_marquee') {
        // 11. Broadway Marquee 16:9
        ctx.fillStyle = '#450a0a'; ctx.fillRect(0, 0, designW, designH);
        const pad = 50; const gap = 24; const w = (designW - 2 * pad - 2 * gap) / 3;
        for (let i = 0; i < 3; i++) drawCoverImage(ctx, getImg(i), pad + i * (w + gap), pad + 70, w, designH - 2 * pad - 140, 16, getFaces(i), biasY);
        drawOutlinedText(ctx, `★ BROADWAY PREMIERE: ${movieTitle.toUpperCase()} ★`, designW / 2, designH - 50, '900 42px "Oswald", sans-serif', '#fef08a', '#000000', 8, 'center');
    }
    else if (targetId === 'movie_169_detective_casefile') {
        // 12. Detective Casefile 16:9
        ctx.fillStyle = '#78350f'; ctx.fillRect(0, 0, designW, designH);
        const pad = 40; const gap = 20; const w = (designW - 2 * pad - 4 * gap) / 5;
        for (let i = 0; i < 5; i++) drawCoverImage(ctx, getImg(i), pad + i * (w + gap), pad + 50, w, designH - 2 * pad - 120, 4, getFaces(i), biasY);
        drawOutlinedText(ctx, `CONFIDENTIAL CASE: ${movieTitle.toUpperCase()}`, designW / 2, designH - 45, '900 34px monospace', '#facc15', '#000000', 6, 'center');
    }
    else if (targetId === 'movie_169_music_album_gatefold') {
        // 13. Music Album Gatefold 16:9
        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, designW, designH);
        const pad = 40; const half = (designW - 2 * pad - 20) / 2;
        drawCoverImage(ctx, getImg(0), pad, pad, half, designH - 2 * pad, 12, getFaces(0), biasY);
        drawCoverImage(ctx, getImg(1), pad + half + 20, pad, half, designH - 2 * pad, 12, getFaces(1), biasY);
        drawOutlinedText(ctx, movieTitle, designW / 2, designH - 80, '900 52px "Playfair Display", serif', '#ffffff', '#000000', 10, 'center');
    }
    else if (targetId === 'movie_169_racing_speed') {
        // 14. Racing Speed 16:9
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawOutlinedText(ctx, movieTitle.toUpperCase(), designW / 2, designH - 100, 'italic 900 84px "Oswald", sans-serif', '#ef4444', '#ffffff', 12, 'center');
    }
    else if (targetId === 'movie_169_epic_battlefield') {
        // 15. Epic Battlefield 16:9
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);
        drawFireflies(ctx, designW, designH, '#f97316');
        drawOutlinedText(ctx, movieTitle.toUpperCase(), designW / 2, designH - 120, '900 84px "Playfair Display", serif', '#fef08a', 'rgba(0,0,0,0.85)', 12, 'center');
    }
    else {
        // Fallback default clean card
        drawCoverImage(ctx, getImg(0), 40, 40, designW - 80, designH - 80, 20, getFaces(0), biasY);
        drawOutlinedText(ctx, concept, designW / 2, designH - 80, '900 64px "Oswald", sans-serif', '#ffffff', 'rgba(0,0,0,0.6)', 10, 'center');
    }

    return canvas.toDataURL('image/jpeg', 0.95);
}
