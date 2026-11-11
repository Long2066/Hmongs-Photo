/**
 * Poster & Catalog Studio Rendering Engine
 * Client-side High-DPI Canvas 2D Graphic Engine
 * Renders 10 distinct studio-grade poster templates with zero API cost and instant speed.
 */

import { detectFacesInImage, calculateSmartCrop, type FaceBox } from './aiFaceDetectService';

export type PosterCategory = 'ky_yeu' | 'phim_anh';

export type PosterTemplateId =
    // Chủ đề Kỷ Yếu (hiện có + 7 mẫu mới từ ảnh 1-7)
    | 'tnt_wood_classic'
    | 'bff_thanh_xuan'
    | 'bento_catalog_8'
    | 'grid_10_max'
    | 'magazine_vogue'
    | 'polaroid_moodboard'
    | 'newspaper_retro'
    | 'wall_gallery_5'
    | 'kyyeu_tuoi_hoc_tro_aloha'
    | 'kyyeu_cuon_film_sotay'
    | 'kyyeu_nang_xien_bff'
    | 'kyyeu_dai_phim_uon_luon'
    | 'kyyeu_scrapbook_vintage'
    | 'kyyeu_youth_dream_co'
    | 'kyyeu_khi_ta_con_tre_tennis'
    // Chủ đề Phim Ảnh (2 mẫu điện ảnh sẵn có + 5 mẫu mới từ ảnh 8-12)
    | 'movie_wetv_romance'
    | 'movie_kdrama_split'
    | 'movie_pastel_dream'
    | 'movie_vieon_fireworks'
    | 'movie_dong_thoai'
    | 'cinema_film_strip'
    | 'story_9_16_music';

export interface PosterOptions {
    templateId: PosterTemplateId;
    category?: PosterCategory;
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
    name: string;
    tagline: string;
    recommendedImages: string;
    idealSlots: number;
    slotLabels: string[];
    aspectRatio: '1:1' | '4:3' | '3:4' | '4:5' | '9:16' | '16:10';
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

export const POSTER_TEMPLATES: PosterTemplateMeta[] = [
    // =========================================================================
    // CHỦ ĐỀ 1: KỶ YẾU HỌC ĐƯỜNG
    // =========================================================================
    {
        id: 'tnt_wood_classic',
        category: 'ky_yeu',
        name: 'TNT Khung Gỗ 3D',
        tagline: 'Chuẩn poster TNT Media mẫu thực tế',
        recommendedImages: '5 ảnh (1-6 ảnh)',
        idealSlots: 5,
        slotLabels: ['Ảnh trên trái', 'Ảnh trên giữa', 'Ảnh trên phải', 'Ảnh lớn Khung Gỗ 3D', 'Chân dung đứng dưới'],
        aspectRatio: '1:1',
        badge: 'HOT NHẤT',
        color: '#e11d48',
        description: 'Khung gỗ 3D nổi bật, 3 ô chân dung trên, cụm icon Facebook thả tim/like và hotline studio.'
    },
    {
        id: 'bff_thanh_xuan',
        category: 'ky_yeu',
        name: 'Thanh Xuân Blend',
        tagline: 'Phóng sự điện ảnh phong cách BFF Media',
        recommendedImages: '4 ảnh (cố định 4)',
        idealSlots: 4,
        slotLabels: ['Ảnh trái trên', 'Ảnh trái giữa', 'Ảnh trái dưới', 'Ảnh Hero dọc bên phải'],
        aspectRatio: '4:3',
        badge: 'ĐIỆN ẢNH',
        color: '#0284c7',
        description: '1 ảnh dọc toàn thân bên phải + 3 ảnh ngang xếp tầng bên trái hòa trộn viền mờ mềm mại.'
    },
    {
        id: 'bento_catalog_8',
        category: 'ky_yeu',
        name: 'Bento Catalog 8 Ô',
        tagline: 'Lưới Bento hiện đại chuẩn Studio',
        recommendedImages: '8 ảnh (đầy đủ)',
        idealSlots: 8,
        slotLabels: ['Ảnh Hero Lớn trái', 'Chân dung phải 1', 'Chân dung phải 2', 'Hàng giữa 1', 'Hàng giữa 2', 'Ô ngang giữa phải', 'Ô ngang đáy trái', 'Ô ngang đáy phải'],
        aspectRatio: '1:1',
        badge: 'BENTO GRID',
        color: '#8b5cf6',
        description: '1 ô Hero lớn góc trái cho ảnh tập thể + 7 ô vệ tinh xung quanh, thẻ nhận diện thương hiệu.'
    },
    {
        id: 'kyyeu_tuoi_hoc_tro_aloha',
        category: 'ky_yeu',
        name: 'Tuổi Học Trò (Aloha Vàng)',
        tagline: 'Tone vàng nắng trường cổ & chữ thư pháp đáy',
        recommendedImages: '8 ảnh (đầy đủ)',
        idealSlots: 8,
        slotLabels: ['Hàng 1 trái', 'Đứng hành lang', 'Nhóm sân trường', 'Nhóm hành lang phải', 'Selfie góc giữa', 'Flycam tập thể', 'Nhóm ngồi gốc cây', 'Hành lang chạy nhảy'],
        aspectRatio: '1:1',
        badge: 'MỚI • ẢNH 1',
        color: '#d97706',
        description: 'Bố cục Bento trường cổ tone vàng nghệ ấm áp kèm hiệu ứng phản chiếu & chữ "Tuổi học trò" chân trang.'
    },
    {
        id: 'kyyeu_cuon_film_sotay',
        category: 'ky_yeu',
        name: 'Sổ Tay Cuộn Film Kỷ Yếu',
        tagline: 'Nền vở ô ly dán ảnh film nghiêng & lõi Fuji/Kodak',
        recommendedImages: '6 ảnh (4-6 ảnh)',
        idealSlots: 6,
        slotLabels: ['Ảnh góc trên trái', 'Tập thể lớp', 'Chân dung phải 1', 'Nữ sinh cột trái', 'Hai bạn lớp học', 'Chân dung bảng xanh'],
        aspectRatio: '4:5',
        badge: 'MỚI • ẢNH 2',
        color: '#2563eb',
        description: 'Trang vở học sinh kẻ ô ly xanh pastel, đính kèm các tấm ảnh film 35mm nghiêng và cuộn phim minh họa.'
    },
    {
        id: 'kyyeu_nang_xien_bff',
        category: 'ky_yeu',
        name: 'Nắng Xiên Cầu Thang 9 Ô',
        tagline: 'Bố cục kiến trúc ánh sáng & bóng đổ nghệ thuật',
        recommendedImages: '9 ảnh (đầy đủ)',
        idealSlots: 9,
        slotLabels: ['Cầu thang nắng 1', 'Nơ trắng quay lưng', 'Cầu thang nam', '2 bạn nắng cửa sổ', 'Nhìn sân trường 1', 'Chân dung đứng giữa', 'Nhóm cửa sổ kính', 'Tập thể sân trường', 'Hàng dài nữ sinh'],
        aspectRatio: '1:1',
        badge: 'MỚI • ẢNH 3',
        color: '#92400e',
        description: 'Lưới 9 ô kỷ yếu điện ảnh Chiaroscuro chuẩn BFF Media, tôn vinh các góc nắng xiên trường lớp.'
    },
    {
        id: 'kyyeu_dai_phim_uon_luon',
        category: 'ky_yeu',
        name: 'Dải Phim Uốn Lượn Thanh Xuân',
        tagline: 'Dải phim 35mm bay lượn giữa trời kèm Quote hay',
        recommendedImages: '4 ảnh (1 nền + 3 khung phim)',
        idealSlots: 4,
        slotLabels: ['Ảnh nền toàn cảnh', 'Khung phim trái', 'Khung phim giữa', 'Khung phim phải'],
        aspectRatio: '1:1',
        badge: 'MỚI • ẢNH 4',
        color: '#4f46e5',
        description: '3 khoảnh khắc lớp lồng ghép trên cuộn dải phim uốn cong nổi bật phía trên nền kỷ yếu & trích dẫn thanh xuân.'
    },
    {
        id: 'kyyeu_scrapbook_vintage',
        category: 'ky_yeu',
        name: 'Nhật Ký Giấy Rách Cổ Điển',
        tagline: 'Khung ảnh viền giấy rách lưu bút & ruy băng đỏ',
        recommendedImages: '5 ảnh',
        idealSlots: 5,
        slotLabels: ['Tập thể lớn góc trái', 'Nhóm cây xanh trên phải', 'Chụp từ trên cao', 'Nhóm cầu thang dưới', 'Cổng trường toàn lớp'],
        aspectRatio: '4:3',
        badge: 'MỚI • ẢNH 5',
        color: '#b45309',
        description: '5 khung giấy rách vintage có nét chữ lưu bút viết tay, đường ruy băng đỏ chạy ngang và nền trường mờ.'
    },
    {
        id: 'kyyeu_youth_dream_co',
        category: 'ky_yeu',
        name: 'Youth Dream (Cỏ Xanh Tươi)',
        tagline: 'Phong cách Kỷ Yếu Sài Gòn trẻ trung, nền sáng',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Nhóm nhỏ bên trái', 'Hero cận mặt cười rạng rỡ', 'Ảnh đồng cỏ lớn đáy trái', 'Nhóm nằm bãi cỏ phải'],
        aspectRatio: '1:1',
        badge: 'MỚI • ẢNH 6',
        color: '#059669',
        description: '4 khung ảnh sáng bừng sức sống trên nền màu nước dịu nhẹ kèm logo studio & tag Concept Youth Dream.'
    },
    {
        id: 'kyyeu_khi_ta_con_tre_tennis',
        category: 'ky_yeu',
        name: 'Khi Ta Còn Trẻ (3 Tầng Polaroid)',
        tagline: '3 tầng ảnh hòa trộn mượt + 2 thẻ Polaroid nghiêng',
        recommendedImages: '5 ảnh',
        idealSlots: 5,
        slotLabels: ['Tầng trên cùng', 'Tầng giữa sân tập', 'Tầng dưới đồng loạt', 'Thẻ Polaroid trên', 'Thẻ Polaroid dưới'],
        aspectRatio: '3:4',
        badge: 'MỚI • ẢNH 7',
        color: '#0d9488',
        description: 'Bố cục ghép 3 lớp chuyển cảnh mềm mại kèm chữ "Khi ta còn trẻ" và 2 tấm Polaroid ghim nổi.'
    },
    {
        id: 'grid_10_max',
        category: 'ky_yeu',
        name: 'Album Đầy Đủ 10 Ảnh',
        tagline: 'Khoe trọn vẹn cả 10 ảnh tải lên',
        recommendedImages: '10 ảnh (đầy đủ)',
        idealSlots: 10,
        slotLabels: ['Lớn 1', 'Lớn 2', 'Vừa 1', 'Vừa 2', 'Vừa 3', 'Nhỏ 1', 'Nhỏ 2', 'Nhỏ 3', 'Nhỏ 4', 'Nhỏ 5'],
        aspectRatio: '4:5',
        badge: 'MAX 10 ẢNH',
        color: '#10b981',
        description: 'Bố cục 3 tầng khoa học (2 ảnh lớn, 3 ảnh vừa, 5 ảnh nhỏ) chuẩn tỉ lệ đăng Facebook & Instagram.'
    },
    {
        id: 'magazine_vogue',
        category: 'ky_yeu',
        name: 'Bìa Tạp Chí Vogue',
        tagline: 'Thời trang kỷ yếu High-End Editorial',
        recommendedImages: '3-4 ảnh',
        idealSlots: 4,
        slotLabels: ['Ảnh bìa toàn màn', 'Ảnh phụ nhỏ 1', 'Ảnh phụ nhỏ 2', 'Ảnh phụ nhỏ 3'],
        aspectRatio: '3:4',
        badge: 'FASHION',
        color: '#0f172a',
        description: 'Ảnh Hero bìa lớn, typography Vogue Masthead in hoa quyền lực, mã vạch barcode và ảnh hậu trường.'
    },
    {
        id: 'polaroid_moodboard',
        category: 'ky_yeu',
        name: 'Bảng Kỷ Niệm Polaroid',
        tagline: 'Góc lưu bút Instax Washi Tape',
        recommendedImages: '5-7 ảnh',
        idealSlots: 6,
        slotLabels: ['Kỷ Niệm #1', 'Kỷ Niệm #2', 'Kỷ Niệm #3', 'Kỷ Niệm #4', 'Kỷ Niệm #5', 'Tốt Nghiệp'],
        aspectRatio: '1:1',
        badge: 'HOÀI NIỆM',
        color: '#d97706',
        description: 'Các tấm ảnh Polaroid nghiêng nghệ thuật ghim băng dính giấy washi tape trong suốt và bóng đổ 3D.'
    },
    {
        id: 'newspaper_retro',
        category: 'ky_yeu',
        name: 'Bản Tin Kỷ Yếu Cổ Điển',
        tagline: 'Trang nhất The Vintage Times 90s',
        recommendedImages: '4-5 ảnh',
        idealSlots: 4,
        slotLabels: ['Ảnh bìa Trang nhất', 'Cột trái', 'Cột giữa', 'Cột phải'],
        aspectRatio: '3:4',
        badge: 'RETRO BÁO CHÍ',
        color: '#78350f',
        description: 'Nền giấy báo ngả vàng retro, tiêu đề báo in cổ điển, đường kẻ đôi và chia cột bài báo thanh lịch.'
    },
    {
        id: 'wall_gallery_5',
        category: 'ky_yeu',
        name: 'Bộ 5 Tranh Treo Tường',
        tagline: 'Demo bộ tranh ép gỗ phòng khách/lớp',
        recommendedImages: '5 ảnh',
        idealSlots: 5,
        slotLabels: ['Khung nhỏ trái', 'Khung vừa trái', 'Khung Lớn Giữa', 'Khung vừa phải', 'Khung nhỏ phải'],
        aspectRatio: '16:10',
        badge: 'TRANH TREO',
        color: '#475569',
        description: 'Bộ 5 bức tranh khung gỗ 3D đối xứng treo trên tường phòng triển lãm, ánh sáng rọi sang trọng.'
    },

    // =========================================================================
    // CHỦ ĐỀ 2: POSTER PHIM ẢNH & ĐIỆN ẢNH (Ảnh 8 - 12 + 2 Mẫu sẵn có)
    // =========================================================================
    {
        id: 'movie_wetv_romance',
        category: 'phim_anh',
        name: 'Phim Ngôn Tình (Style WeTV)',
        tagline: 'Poster phim lãng mạn khổ dọc + Bokeh ánh đèn',
        recommendedImages: '1-2 ảnh (1 ảnh đôi hoặc 2 chân dung)',
        idealSlots: 2,
        slotLabels: ['Ảnh chính cặp đôi (hoặc Nữ chính)', 'Ảnh Nam chính (tùy chọn ghép đôi)'],
        aspectRatio: '3:4',
        badge: 'PHIM • ẢNH 8',
        color: '#e11d48',
        description: 'Thiết kế điện ảnh lãng mạn giống WeTV, ánh sáng bokeh ấm áp, tiêu đề thanh mảnh + logo đài phát sóng.'
    },
    {
        id: 'movie_kdrama_split',
        category: 'phim_anh',
        name: 'K-Drama Song Hành Đối Xứng',
        tagline: '2 chân dung nam/nữ ở trên + 1 cảnh gặp gỡ bên dưới',
        recommendedImages: '3 ảnh',
        idealSlots: 3,
        slotLabels: ['Chân dung Nữ (Trên trái)', 'Chân dung Nam (Trên phải)', 'Cảnh gặp gỡ cặp đôi (Nửa dưới)'],
        aspectRatio: '4:5',
        badge: 'PHIM • ẢNH 9',
        color: '#3b82f6',
        description: 'Chia tầng K-Drama kinh điển: 2 chân dung tách đôi tầng trên, cảnh đối thoại tình cảm tầng dưới & chữ giữa.'
    },
    {
        id: 'movie_pastel_dream',
        category: 'phim_anh',
        name: 'Tình Yêu Độc Nhất Pastel',
        tagline: 'Bầu trời xanh dịu, bong bóng xà phòng & Font Trái Tim',
        recommendedImages: '1 ảnh đôi lãng mạn',
        idealSlots: 1,
        slotLabels: ['Ảnh cặp đôi chính diện'],
        aspectRatio: '3:4',
        badge: 'PHIM • ẢNH 10',
        color: '#ec4899',
        description: 'Ánh nắng bầu trời trong veo, hiệu ứng bong bóng xà phòng bay bổng cùng chữ thiết kế trái tim ngọt ngào.'
    },
    {
        id: 'movie_vieon_fireworks',
        category: 'phim_anh',
        name: 'Phim Truyền Hình (Style VieON)',
        tagline: 'Xanh thiên nhiên đom đóm + Badge Song Song & Giờ chiếu',
        recommendedImages: '1 ảnh đôi tựa lưng',
        idealSlots: 1,
        slotLabels: ['Ảnh chính đôi diễn viên'],
        aspectRatio: '4:5',
        badge: 'PHIM • ẢNH 11',
        color: '#16a34a',
        description: 'Tone rừng xanh mộng mơ cùng hạt ánh sáng đom đóm, badge phát sóng SONG SONG, logo VieON và lịch chiếu 19:00.'
    },
    {
        id: 'movie_dong_thoai',
        category: 'phim_anh',
        name: 'MV & Phim Nghệ Thuật (Đồng Thoại)',
        tagline: 'Hiệu ứng chồng hình thiên nhiên + Tên Diễn Viên & Ngày Chiếu',
        recommendedImages: '2 ảnh (1 cận mặt + 1 toàn cảnh)',
        idealSlots: 2,
        slotLabels: ['Ảnh cận mặt đôi (Tầng trên)', 'Ảnh toàn cảnh đôi đứng (Nửa dưới)'],
        aspectRatio: '4:5',
        badge: 'PHIM • ẢNH 12',
        color: '#78350f',
        description: 'Phong cách retro đồi cỏ hoài niệm với hiệu ứng hòa trộn Double Exposure, tên 2 diễn viên chính và ngày ra mắt.'
    },
    {
        id: 'cinema_film_strip',
        category: 'phim_anh',
        name: 'Cuộn Phim 35mm Điện Ảnh',
        tagline: 'Hoài niệm Kodak Portra 400',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Cảnh 01A', 'Cảnh 02A', 'Cảnh 03A', 'Cảnh 04A'],
        aspectRatio: '3:4',
        badge: 'VINTAGE FILM',
        color: '#ea580c',
        description: 'Dải phim 35mm màu đen có lỗ răng cưa phim thực tế, số khung 01A/02A và timestamp màu cam.'
    },
    {
        id: 'story_9_16_music',
        category: 'phim_anh',
        name: 'Story 9:16 + Trình Phát Nhạc',
        tagline: 'Chuẩn đăng Reels / TikTok / Story MV',
        recommendedImages: '4 ảnh',
        idealSlots: 4,
        slotLabels: ['Ảnh Bìa Lớn', 'Cảnh Phụ Trái', 'Cảnh Phụ Phải', 'Ảnh Đĩa Nhạc Tròn'],
        aspectRatio: '9:16',
        badge: 'STORY MV',
        color: '#ec4899',
        description: 'Khổ dọc 9:16 cho điện thoại, nền blur huyền ảo kèm Widget phát nhạc OST phim & bài hát sống động.'
    }
];

export const THEME_COLOR_PRESETS = [
    { id: 'cherry', name: 'Đỏ Cherry', hex: '#e11d48' },
    { id: 'teal', name: 'Xanh Ngọc', hex: '#0d9488' },
    { id: 'blue', name: 'Xanh Dương', hex: '#2563eb' },
    { id: 'amber', name: 'Vàng Hoàng Hôn', hex: '#d97706' },
    { id: 'purple', name: 'Tím Mộng Mơ', hex: '#7c3aed' },
    { id: 'slate', name: 'Đen Cổ Điển', hex: '#1e293b' }
];

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
        // Fallback if ctx.filter not supported
    }
    // Overdraw slightly to avoid transparent blur edges
    const bleed = blurPx * 2;
    drawCoverImage(ctx, img, -bleed, -bleed, w + bleed * 2, h + bleed * 2, 0, faces, 0.3);
    ctx.restore();

    ctx.fillStyle = overlayColor;
    ctx.fillRect(0, 0, w, h);
}

function draw3DWoodFrame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    frameW: number = 46
) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.48)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = '#5c3818';
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // 1. Top Rail
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
    gTop.addColorStop(0.7, '#b78753');
    gTop.addColorStop(1, '#784d26');
    ctx.fillStyle = gTop;
    ctx.fill();
    ctx.restore();

    // 2. Bottom Rail
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w - frameW, y + h - frameW);
    ctx.lineTo(x + frameW, y + h - frameW);
    ctx.closePath();
    const gBot = ctx.createLinearGradient(x, y + h - frameW, x, y + h);
    gBot.addColorStop(0, '#533116');
    gBot.addColorStop(0.5, '#784c25');
    gBot.addColorStop(1, '#3b200b');
    ctx.fillStyle = gBot;
    ctx.fill();
    ctx.restore();

    // 3. Left Rail
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + frameW, y + h - frameW);
    ctx.lineTo(x + frameW, y + frameW);
    ctx.closePath();
    const gLeft = ctx.createLinearGradient(x, y, x + frameW, y);
    gLeft.addColorStop(0, '#be905d');
    gLeft.addColorStop(0.5, '#926131');
    gLeft.addColorStop(1, '#5a3416');
    ctx.fillStyle = gLeft;
    ctx.fill();
    ctx.restore();

    // 4. Right Rail
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w - frameW, y + h - frameW);
    ctx.lineTo(x + w - frameW, y + frameW);
    ctx.closePath();
    const gRight = ctx.createLinearGradient(x + w - frameW, y, x + w, y);
    gRight.addColorStop(0, '#603919');
    gRight.addColorStop(0.5, '#855428');
    gRight.addColorStop(1, '#45260e');
    ctx.fillStyle = gRight;
    ctx.fill();
    ctx.restore();

    // Wood Grain Striations
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 235, 205, 0.16)';
    ctx.lineWidth = 1.5;
    for (let offset = frameW * 0.25; offset < frameW * 0.85; offset += 7) {
        ctx.strokeRect(x + offset, y + offset, w - 2 * offset, h - 2 * offset);
    }
    ctx.restore();

    // Inner Bevel Shadow
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + frameW, y + frameW, w - 2 * frameW, h - 2 * frameW);
    ctx.restore();
}

function drawReactionCluster(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number = 58) {
    const reactions = [
        { type: 'heart', bg: '#f43f5e', dx: -size * 0.85 },
        { type: 'like', bg: '#1877f2', dx: 0 },
        { type: 'wow', bg: '#fbbf24', dx: size * 0.85 }
    ];

    reactions.forEach((item) => {
        const cx = centerX + item.dx;
        const cy = centerY;
        const r = size * 0.52;

        // White border ring + shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();

        // Colored Circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = item.bg;
        ctx.fill();

        // Crisp vector icon inside circle (guaranteed identical across Windows/Mac/Android)
        ctx.fillStyle = '#ffffff';
        if (item.type === 'heart') {
            ctx.beginPath();
            const hr = r * 0.45;
            ctx.moveTo(cx, cy + hr * 0.75);
            ctx.bezierCurveTo(cx - hr * 1.4, cy - hr * 0.2, cx - hr * 0.7, cy - hr * 1.1, cx, cy - hr * 0.35);
            ctx.bezierCurveTo(cx + hr * 0.7, cy - hr * 1.1, cx + hr * 1.4, cy - hr * 0.2, cx, cy + hr * 0.75);
            ctx.fill();
        } else if (item.type === 'like') {
            ctx.font = `900 ${Math.round(r * 1.05)}px "Plus Jakarta Sans", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('👍', cx, cy + 2);
        } else {
            // Wow face vector
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(cx - r * 0.32, cy - r * 0.22, r * 0.13, 0, Math.PI * 2);
            ctx.arc(cx + r * 0.32, cy - r * 0.22, r * 0.13, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx, cy + r * 0.26, r * 0.2, r * 0.28, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    });
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

/**
 * Safe Feathered Image Drawing (NO broken destination-in cutout!)
 * Draws image into temp canvas and preserves 100% opaque body while feathering ONLY the requested top/bottom edge.
 */
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

/**
 * Word-wrapping canvas text helper
 */
function drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number = 3
): number {
    const words = text.split(/\s+/);
    let line = '';
    const lines: string[] = [];

    for (let i = 0; i < words.length; i++) {
        const testLine = line ? `${line} ${words[i]}` : words[i];
        if (ctx.measureText(testLine).width > maxWidth && line) {
            lines.push(line);
            line = words[i];
            if (lines.length >= maxLines - 1) break;
        } else {
            line = testLine;
        }
    }
    if (line && lines.length < maxLines) lines.push(line);

    lines.forEach((l, idx) => {
        ctx.fillText(l, x, y + idx * lineHeight);
    });
    return lines.length * lineHeight;
}

/**
 * Draw OTT Streaming Platform Logo (WeTV, VieON, Netflix, Cinema)
 */
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
        // WeTV Play Icon + Text
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
        // Play triangle
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
        // Green circle 'O'
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

/**
 * Draw 35mm Film Canister Vector
 */
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

    // Canister body
    roundRect(ctx, -50, -70, 100, 140, 10);
    ctx.fillStyle = variant === 'fuji' ? '#059669' : '#facc15';
    ctx.fill();

    // Top & bottom black caps
    ctx.fillStyle = '#18181b';
    roundRect(ctx, -54, -76, 108, 20, 5);
    ctx.fill();
    roundRect(ctx, -54, 56, 108, 20, 5);
    ctx.fill();

    // Top spool knob
    roundRect(ctx, -22, -92, 44, 18, 4);
    ctx.fill();

    // Label stripe
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

/**
 * Draw Soap Bubbles / Dreamy Light Bokeh
 */
function drawSoapBubbles(ctx: CanvasRenderingContext2D, designW: number, designH: number) {
    const bubbles = [
        { x: 0.12, y: 0.25, r: 95 },
        { x: 0.88, y: 0.18, r: 70 },
        { x: 0.2, y: 0.58, r: 52 },
        { x: 0.85, y: 0.55, r: 120 },
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

/**
 * Draw Glowing Firefly Particles
 */
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

/**
 * Draw Ripped Paper / Deckle Edge Card Frame
 */
function drawDeckleEdgeCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = '#f5eedc') {
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
            // Safe ignore
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

    // Parallel on-device AI Face Detection for every loaded image
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

    // Define base design space (designW x designH) per template
    let designW = 2000;
    let designH = 2000;

    switch (options.templateId) {
        case 'bff_thanh_xuan':
        case 'kyyeu_scrapbook_vintage':
            designW = 2200;
            designH = 1650;
            break;
        case 'grid_10_max':
        case 'kyyeu_cuon_film_sotay':
        case 'movie_kdrama_split':
        case 'movie_vieon_fireworks':
        case 'movie_dong_thoai':
            designW = 2000;
            designH = 2500;
            break;
        case 'magazine_vogue':
        case 'cinema_film_strip':
        case 'newspaper_retro':
        case 'kyyeu_khi_ta_con_tre_tennis':
        case 'movie_wetv_romance':
        case 'movie_pastel_dream':
            designW = 1800;
            designH = 2400;
            break;
        case 'story_9_16_music':
            designW = 1350;
            designH = 2400;
            break;
        case 'wall_gallery_5':
            designW = 2400;
            designH = 1500;
            break;
        default:
            designW = 2000;
            designH = 2000;
            break;
    }

    // HD uses 0.8x output scale (~1440-1920px), 2K uses full 1.0x (1800-2500px)
    const resolutionScale = options.resolution === '2K' ? 1 : 0.78;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(designW * resolutionScale);
    canvas.height = Math.round(designH * resolutionScale);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ Canvas 2D.');

    // Transform canvas so all drawing uses crisp exact design coordinates!
    ctx.scale(resolutionScale, resolutionScale);

    const biasY = options.cropBiasY ?? 0.3;
    const concept = options.conceptName?.trim() || 'Tuổi Học Trò';
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

    // =========================================================================
    // 1. TNT Khung Gỗ 3D (Mẫu 2 & 3 TNT Media)
    // =========================================================================
    if (options.templateId === 'tnt_wood_classic') {
        drawBlurredBackground(ctx, getImg(0), designW, designH, 30, 'rgba(15, 23, 42, 0.42)', getFaces(0));

        // Header Top-Left: "TOP 10+" + "Concept HOT"
        drawOutlinedText(
            ctx,
            'TOP 10+',
            115,
            168,
            '900 100px "Oswald", "Plus Jakarta Sans", sans-serif',
            options.accentColor,
            '#ffffff',
            18
        );
        drawOutlinedText(
            ctx,
            'Concept HOT',
            115,
            290,
            'italic 700 88px "Dancing Script", Georgia, cursive',
            options.accentColor,
            '#ffffff',
            15
        );

        // Header Top-Center: Watermark Logo
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '700 34px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText(`📷  ${studio.toUpperCase()}`, designW / 2, 138);
        ctx.restore();

        // Header Top-Right: Year Badge + Concept Label + Ribbon Sticker
        const rightEdge = designW - 115;
        ctx.save();
        ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
        const yearW = ctx.measureText(yearTag).width + 44;
        roundRect(ctx, rightEdge - yearW, 75, yearW, 54, 27);
        ctx.fillStyle = options.accentColor;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(yearTag, rightEdge - yearW / 2, 102);

        ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('CONCEPT', rightEdge, 165);
        ctx.restore();

        drawOutlinedText(
            ctx,
            `► ${concept}`,
            rightEdge,
            280,
            'italic 700 72px "Dancing Script", Georgia, cursive',
            options.accentColor,
            '#ffffff',
            14,
            'right'
        );

        // Top Row: 3 square rounded portrait cards
        const topY = 380;
        const topH = 560;
        const topW = 550;
        const gap = 60;
        for (let i = 0; i < 3; i++) {
            const sx = 115 + i * (topW + gap);
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 8;
            roundRect(ctx, sx, topY, topW, topH, 32);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.restore();

            drawCoverImage(ctx, getImg(i), sx, topY, topW, topH, 32, getFaces(i), biasY);

            ctx.save();
            roundRect(ctx, sx, topY, topW, topH, 32);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
        }

        // Bottom Row Left: Large Group Photo in 3D Wood Frame
        const botY = 990;
        const botH = 770;
        const woodX = 115;
        const woodW = 1160;
        const frameW = 48;

        draw3DWoodFrame(ctx, woodX, botY, woodW, botH, frameW);
        drawCoverImage(ctx, getImg(3), woodX + frameW, botY + frameW, woodW - 2 * frameW, botH - 2 * frameW, 0, getFaces(3), biasY);

        // Bottom Row Right: Tall Portrait + Facebook Emoji Cluster
        const rSlotX = 1335;
        const rSlotW = 550;
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 8;
        roundRect(ctx, rSlotX, botY, rSlotW, botH, 32);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();

        drawCoverImage(ctx, getImg(4), rSlotX, botY, rSlotW, botH, 32, getFaces(4), biasY);

        ctx.save();
        roundRect(ctx, rSlotX, botY, rSlotW, botH, 32);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        drawReactionCluster(ctx, rSlotX + rSlotW - 125, botY + botH - 30, 62);

        // Footer White Pill Bar
        const footerY = 1810;
        const footerH = 110;
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 8;
        roundRect(ctx, 115, footerY, designW - 230, footerH, 55);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.font = '800 34px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'left';
        ctx.fillText(`${studio.toUpperCase()}  |  ${slogan}`, 170, footerY + footerH / 2);

        // Dynamically measure right text so never overlaps
        ctx.textAlign = 'right';
        ctx.font = '800 36px "Plus Jakarta Sans", sans-serif';
        const hotW = ctx.measureText(hotline).width;
        ctx.fillStyle = '#0f172a';
        ctx.fillText(hotline, designW - 170, footerY + footerH / 2);
        ctx.font = '600 32px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText('Hotline: ', designW - 175 - hotW, footerY + footerH / 2);
        ctx.restore();
    }

    // =========================================================================
    // 2. Thanh Xuân Blend (BFF Media Style - Mẫu 1)
    // =========================================================================
    else if (options.templateId === 'bff_thanh_xuan') {
        // Explicit crisp base so uninitialized alpha never causes black boxes
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, designW, designH);

        const leftW = 1030;
        const rightW = designW - leftW;
        const slotH = Math.ceil(designH / 3);
        const seamOverlap = 85;

        for (let i = 0; i < 3; i++) {
            const curY = i * slotH;
            if (i === 0) {
                drawCoverImage(ctx, getImg(0), 0, 0, leftW, slotH + seamOverlap, 0, getFaces(0), biasY);
            } else {
                // Smooth alpha-feathered top seam onto preceding photo WITHOUT erasing lower body!
                drawFeatheredCoverImage(
                    ctx,
                    getImg(i),
                    0,
                    curY,
                    leftW,
                    Math.min(slotH + seamOverlap, designH - curY + seamOverlap),
                    seamOverlap,
                    0,
                    getFaces(i),
                    biasY
                );
            }
        }

        // Handwritten Calligraphy Title
        drawOutlinedText(
            ctx,
            concept || 'Thanh Xuân',
            leftW / 2,
            designH / 2 + 40,
            'italic 700 96px "Dancing Script", Georgia, cursive',
            '#ffffff',
            'rgba(15, 23, 42, 0.55)',
            12,
            'center'
        );

        // Soft dark bottom vignette on left side so Vietnamese quote reads sharply
        const botLeftVig = ctx.createLinearGradient(0, designH - 180, 0, designH);
        botLeftVig.addColorStop(0, 'rgba(15, 23, 42, 0)');
        botLeftVig.addColorStop(1, 'rgba(15, 23, 42, 0.72)');
        ctx.fillStyle = botLeftVig;
        ctx.fillRect(0, designH - 180, leftW, 180);

        // Customizable Vietnamese Quote bottom-left (replaces old hardcoded Chinese quote)
        ctx.save();
        ctx.textAlign = 'left';
        ctx.font = 'italic 600 26px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 10;
        const shortQuote = quoteText.length > 62 ? quoteText.slice(0, 62) + '...' : quoteText;
        ctx.fillText(`“${shortQuote}”`, 45, designH - 72);
        ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(`${studio.toUpperCase()}  •  ${yearTag}`, 45, designH - 36);
        ctx.restore();

        // Right Side: Large Vertical Hero Frame
        drawCoverImage(ctx, getImg(3), leftW, 0, rightW, designH, 0, getFaces(3), biasY);

        // Soft dreamy light bloom along seam & top-left corner
        const seamBloom = ctx.createLinearGradient(leftW - 20, 0, leftW + 100, 0);
        seamBloom.addColorStop(0, 'rgba(255, 255, 255, 0)');
        seamBloom.addColorStop(0.3, 'rgba(255, 255, 255, 0.35)');
        seamBloom.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = seamBloom;
        ctx.fillRect(leftW - 20, 0, 120, designH);

        // Bottom-right subtle logo
        ctx.save();
        ctx.textAlign = 'right';
        ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 12;
        ctx.fillText(studio.toUpperCase(), designW - 45, designH - 60);
        ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(`Hotline: ${hotline}`, designW - 45, designH - 28);
        ctx.restore();
    }

    // =========================================================================
    // 3. Bento Catalog 8 Ô (Modern Studio Grid)
    // =========================================================================
    else if (options.templateId === 'bento_catalog_8') {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, designW, designH);

        const pad = 65;
        const gap = 26;
        const col4 = 448;
        const wide2 = 922;

        // Top-Left: Big Hero
        drawCoverImage(ctx, getImg(0), pad, pad, wide2, 840, 28, getFaces(0), biasY);

        // Top-Right Info Banner + 2 Slots underneath
        const infoX = pad + wide2 + gap;
        ctx.save();
        roundRect(ctx, infoX, pad, wide2, 190, 28);
        ctx.fillStyle = options.accentColor;
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 48px "Oswald", "Plus Jakarta Sans", sans-serif';
        ctx.fillText(concept.toUpperCase(), infoX + 36, pad + 68);
        ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`${studio}  •  ${yearTag}`, infoX + 36, pad + 116);
        ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(`${slogan}  |  Hotline: ${hotline}`, infoX + 36, pad + 158);
        ctx.restore();

        drawCoverImage(ctx, getImg(1), infoX, pad + 216, col4, 624, 26, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), infoX + col4 + gap, pad + 216, col4, 624, 26, getFaces(2), biasY);

        // Middle Row (y = 931): 2 square + 1 wide
        const r2Y = pad + 840 + gap;
        const r2H = 480;
        drawCoverImage(ctx, getImg(3), pad, r2Y, col4, r2H, 26, getFaces(3), biasY);
        drawCoverImage(ctx, getImg(4), pad + col4 + gap, r2Y, col4, r2H, 26, getFaces(4), biasY);
        drawCoverImage(ctx, getImg(5), infoX, r2Y, wide2, r2H, 26, getFaces(5), biasY);

        // Bottom Row (y = 1437): 2 wide balanced slots
        const r3Y = r2Y + r2H + gap;
        const r3H = designH - r3Y - pad;
        drawCoverImage(ctx, getImg(6), pad, r3Y, wide2, r3H, 26, getFaces(6), biasY);
        drawCoverImage(ctx, getImg(7), infoX, r3Y, wide2, r3H, 26, getFaces(7), biasY);
    }

    // =========================================================================
    // 4. Album Đầy Đủ 10 Ảnh (Max 10 Grid)
    // =========================================================================
    else if (options.templateId === 'grid_10_max') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, designW, designH);

        const pad = 55;
        const gap = 20;

        // Top Header
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '900 58px "Oswald", "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${concept.toUpperCase()}  •  ALBUM KỶ YẾU`, designW / 2, pad + 70);
        ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = options.accentColor;
        ctx.fillText(`${studio.toUpperCase()}  |  ${yearTag}`, designW / 2, pad + 118);
        ctx.restore();

        // Tier 1: 2 Large Photos
        const t1Y = pad + 155;
        const t1W = (designW - 2 * pad - gap) / 2;
        const t1H = 680;
        drawCoverImage(ctx, getImg(0), pad, t1Y, t1W, t1H, 22, getFaces(0), biasY);
        drawCoverImage(ctx, getImg(1), pad + t1W + gap, t1Y, t1W, t1H, 22, getFaces(1), biasY);

        // Tier 2: 3 Medium Photos
        const t2Y = t1Y + t1H + gap;
        const t2W = (designW - 2 * pad - 2 * gap) / 3;
        const t2H = 620;
        for (let i = 0; i < 3; i++) {
            drawCoverImage(ctx, getImg(2 + i), pad + i * (t2W + gap), t2Y, t2W, t2H, 20, getFaces(2 + i), biasY);
        }

        // Tier 3: 5 Portrait Slots
        const t3Y = t2Y + t2H + gap;
        const t3W = (designW - 2 * pad - 4 * gap) / 5;
        const t3H = 740;
        for (let i = 0; i < 5; i++) {
            drawCoverImage(ctx, getImg(5 + i), pad + i * (t3W + gap), t3Y, t3W, t3H, 18, getFaces(5 + i), biasY);
        }

        // Bottom Brand Pill
        const fY = t3Y + t3H + 25;
        ctx.save();
        roundRect(ctx, pad, fY, designW - 2 * pad, 100, 50);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 30px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${studio.toUpperCase()}  •  ${slogan}  •  Hotline: ${hotline}`, designW / 2, fY + 50);
        ctx.restore();
    }

    // =========================================================================
    // 5. Bìa Tạp Chí Vogue Editorial
    // =========================================================================
    else if (options.templateId === 'magazine_vogue') {
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);

        // Editorial vignette top & bottom
        const gTop = ctx.createLinearGradient(0, 0, 0, 420);
        gTop.addColorStop(0, 'rgba(0, 0, 0, 0.68)');
        gTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gTop;
        ctx.fillRect(0, 0, designW, 420);

        const gBot = ctx.createLinearGradient(0, designH - 550, 0, designH);
        gBot.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gBot.addColorStop(1, 'rgba(0, 0, 0, 0.82)');
        ctx.fillStyle = gBot;
        ctx.fillRect(0, designH - 550, designW, 550);

        // Magazine Masthead
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '900 220px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 24;
        ctx.fillText('VOGUE', designW / 2, 235);

        ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`${studio.toUpperCase()}  •  GRADUATION SPECIAL EDITION  •  ${yearTag.toUpperCase()}`, designW / 2, 290);
        ctx.restore();

        // Editorial Headline Bottom Left
        ctx.save();
        ctx.textAlign = 'left';
        ctx.font = 'italic 700 72px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(concept, 75, designH - 250);
        ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(`${slogan}  •  Hotline: ${hotline}`, 75, designH - 200);
        ctx.restore();

        // 3 BTS Thumbnails Bottom Right
        const thumbW = 240;
        const thumbH = 310;
        const thumbY = designH - thumbH - 70;
        const startTX = designW - 3 * thumbW - 2 * 22 - 75;
        for (let i = 0; i < 3; i++) {
            const tx = startTX + i * (thumbW + 22);
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 18;
            roundRect(ctx, tx, thumbY, thumbW, thumbH, 16);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.restore();
            drawCoverImage(ctx, getImg(1 + i), tx + 8, thumbY + 8, thumbW - 16, thumbH - 16, 12, getFaces(1 + i), biasY);
        }

        // Vector Barcode Bottom Left
        const bx = 75;
        const by = designH - 145;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx, by, 260, 75);
        ctx.fillStyle = '#000000';
        for (let lx = 15; lx < 245; lx += (lx % 6 === 0 ? 8 : 5)) {
            ctx.fillRect(bx + lx, by + 10, lx % 3 === 0 ? 4 : 2, 42);
        }
        ctx.font = '700 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('9 782026 052814', bx + 130, by + 66);
    }

    // =========================================================================
    // 6. Bảng Kỷ Niệm Polaroid Washi Tape
    // =========================================================================
    else if (options.templateId === 'polaroid_moodboard') {
        ctx.fillStyle = '#f5ede2';
        ctx.fillRect(0, 0, designW, designH);

        // Header
        drawOutlinedText(
            ctx,
            concept || 'Thanh Xuân Của Chúng Ta',
            designW / 2,
            125,
            'italic 700 84px "Dancing Script", Georgia, cursive',
            '#451a03',
            '#ffffff',
            8,
            'center'
        );

        const polaroids = [
            { x: 110, y: 210, w: 550, h: 680, rot: -0.04, label: 'Kỷ Niệm #1' },
            { x: 725, y: 195, w: 550, h: 680, rot: 0.02, label: 'Kỷ Niệm #2' },
            { x: 1340, y: 220, w: 550, h: 680, rot: -0.03, label: 'Kỷ Niệm #3' },
            { x: 120, y: 970, w: 550, h: 680, rot: 0.03, label: 'Kỷ Niệm #4' },
            { x: 725, y: 990, w: 550, h: 680, rot: -0.02, label: 'Kỷ Niệm #5' },
            { x: 1330, y: 975, w: 550, h: 680, rot: 0.04, label: 'Tốt Nghiệp' }
        ];

        polaroids.forEach((p, idx) => {
            const cx = p.x + p.w / 2;
            const cy = p.y + p.h / 2;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(p.rot);
            ctx.translate(-cx, -cy);

            ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
            ctx.shadowBlur = 24;
            ctx.shadowOffsetY = 12;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.restore();

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(p.rot);
            ctx.translate(-cx, -cy);

            const pad = 28;
            drawCoverImage(ctx, getImg(idx), p.x + pad, p.y + pad, p.w - pad * 2, p.h - pad * 2 - 95, 6, getFaces(idx), biasY);

            ctx.font = 'italic 700 38px "Dancing Script", cursive';
            ctx.fillStyle = '#334155';
            ctx.textAlign = 'center';
            ctx.fillText(p.label, cx, p.y + p.h - 36);

            // Washi tape
            ctx.fillStyle = 'rgba(253, 224, 71, 0.72)';
            ctx.fillRect(cx - 85, p.y - 18, 170, 38);
            ctx.restore();
        });

        // Footer Note Bar
        ctx.save();
        roundRect(ctx, 110, 1760, designW - 220, 120, 60);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 16;
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '800 34px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#451a03';
        ctx.fillText(`${studio.toUpperCase()}  |  ${yearTag}  |  Hotline: ${hotline}`, designW / 2, 1820);
        ctx.restore();
    }

    // =========================================================================
    // 7. Cuộn Phim 35mm Điện Ảnh (Kodak Portra)
    // =========================================================================
    else if (options.templateId === 'cinema_film_strip') {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, designW, designH);

        const stripX = 75;
        const stripW = designW - 150;

        // Top Film Leader Label
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '900 48px "Oswald", monospace';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`KODAK PORTRA 400  •  ${concept.toUpperCase()}`, designW / 2, 110);
        ctx.restore();

        // Sprocket holes along left and right edge
        ctx.fillStyle = '#f8fafc';
        for (let y = 160; y < designH - 120; y += 56) {
            roundRect(ctx, stripX + 18, y, 36, 26, 6);
            ctx.fill();
            roundRect(ctx, stripX + stripW - 54, y, 36, 26, 6);
            ctx.fill();
        }

        const innerX = stripX + 80;
        const innerW = stripW - 160;
        const frameH = 460;
        const frameGap = 45;
        const startY = 190;

        for (let i = 0; i < 4; i++) {
            const fy = startY + i * (frameH + frameGap);
            drawCoverImage(ctx, getImg(i), innerX, fy, innerW, frameH, 10, getFaces(i), biasY);

            ctx.save();
            ctx.font = '700 24px monospace';
            ctx.fillStyle = '#f59e0b';
            ctx.fillText(`FRAME 0${i + 1}A  •  KODAK FILM`, innerX + 20, fy + frameH - 18);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#fb923c';
            ctx.fillText("'26 05 28", innerX + innerW - 20, fy + frameH - 18);
            ctx.restore();
        }

        // Bottom Film Strip Footer
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '700 30px monospace';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`${studio.toUpperCase()}  |  ${slogan}  |  HOTLINE: ${hotline}`, designW / 2, designH - 85);
        ctx.restore();
    }

    // =========================================================================
    // 8. Bản Tin Kỷ Yếu Cổ Điển (The Vintage Times)
    // =========================================================================
    else if (options.templateId === 'newspaper_retro') {
        ctx.fillStyle = '#f6f1e8';
        ctx.fillRect(0, 0, designW, designH);

        const pad = 65;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4;
        ctx.strokeRect(pad, pad, designW - 2 * pad, designH - 2 * pad);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(pad + 12, pad + 12, designW - 2 * (pad + 12), designH - 2 * (pad + 12));

        // Masthead
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '900 104px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#0f172a';
        ctx.fillText('THE YOUTH TIMES', designW / 2, pad + 125);

        ctx.font = '700 24px "Playfair Display", Georgia, serif';
        ctx.fillText(
            `ẤN PHẨM ĐẶC BIỆT  •  ${yearTag.toUpperCase()}  •  ${studio.toUpperCase()}  •  GIÁ BÁN: VÔ GIÁ`,
            designW / 2,
            pad + 170
        );

        ctx.beginPath();
        ctx.moveTo(pad + 25, pad + 195);
        ctx.lineTo(designW - pad - 25, pad + 195);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        // Main Cover Story Photo
        const mainY = pad + 220;
        const mainW = designW - 2 * pad - 50;
        const mainH = 980;
        drawCoverImage(ctx, getImg(0), pad + 25, mainY, mainW, mainH, 0, getFaces(0), biasY);

        // Big Newspaper Headline
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '900 50px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(`KỶ YẾU ${concept.toUpperCase()}: THANH XUÂN RỰC RỠ`, designW / 2, mainY + mainH + 72);
        ctx.restore();

        // Bottom 3 Story Columns
        const subY = mainY + mainH + 115;
        const subW = (mainW - 50) / 3;
        const subH = 520;
        const colTitles = ['KHOẢNH KHẮC ĐẸP', 'CÙNG NHAU TỎA SÁNG', 'MÃI MỘT TUỔI TRẺ'];
        for (let i = 0; i < 3; i++) {
            const sx = pad + 25 + i * (subW + 25);
            drawCoverImage(ctx, getImg(1 + i), sx, subY, subW, subH, 0, getFaces(1 + i), biasY);

            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = '800 24px "Playfair Display", Georgia, serif';
            ctx.fillStyle = '#1e293b';
            ctx.fillText(colTitles[i], sx + subW / 2, subY + subH + 45);
            ctx.font = '500 20px "Playfair Display", Georgia, serif';
            ctx.fillStyle = '#475569';
            ctx.fillText('Lưu giữ ký ức thanh xuân tươi đẹp.', sx + subW / 2, subY + subH + 80);
            ctx.restore();
        }

        // Newspaper Footer
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(`${studio.toUpperCase()}  •  ${slogan}  •  Hotline: ${hotline}`, designW / 2, designH - pad - 30);
        ctx.restore();
    }

    // =========================================================================
    // 9. Bộ 5 Tranh Gỗ Treo Tường 3D (Wall Art Gallery)
    // =========================================================================
    else if (options.templateId === 'wall_gallery_5') {
        const wallGrad = ctx.createRadialGradient(designW / 2, 100, 120, designW / 2, designH / 2, designW);
        wallGrad.addColorStop(0, '#f8fafc');
        wallGrad.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(0, 0, designW, designH);

        // Floor Baseboard Line
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(0, designH - 110, designW, 110);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, designH - 110, designW, 10);

        // Header Title
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '900 48px "Oswald", "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#1e293b';
        ctx.fillText(`BỘ 5 TRANH TREO TƯỜNG 3D  •  ${concept.toUpperCase()}`, designW / 2, 105);
        ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`${studio}  |  ${slogan}  |  Hotline: ${hotline}`, designW / 2, 152);
        ctx.restore();

        const centerY = 780;
        const gap = 42;
        const specs = [
            { w: 340, h: 520 },
            { w: 440, h: 680 },
            { w: 580, h: 860 },
            { w: 440, h: 680 },
            { w: 340, h: 520 }
        ];
        const totalW = specs.reduce((a, b) => a + b.w, 0) + 4 * gap;
        let curX = (designW - totalW) / 2;

        specs.forEach((sp, idx) => {
            const py = centerY - sp.h / 2;
            draw3DWoodFrame(ctx, curX, py, sp.w, sp.h, 28);
            drawCoverImage(ctx, getImg(idx), curX + 28, py + 28, sp.w - 56, sp.h - 56, 0, getFaces(idx), biasY);
            curX += sp.w + gap;
        });
    }

    // =========================================================================
    // 11. Bento Kỷ Yếu Tuổi Học Trò (Aloha Vàng Nắng - Mẫu 1 Mới)
    // =========================================================================
    else if (options.templateId === 'kyyeu_tuoi_hoc_tro_aloha') {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, designH);
        bgGrad.addColorStop(0, '#f59e0b');
        bgGrad.addColorStop(0.3, '#d97706');
        bgGrad.addColorStop(1, '#b45309');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, designW, designH);

        // Header Title Bar
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '900 42px "Oswald", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 10;
        ctx.fillText(`ALOHA CONCEPT  •  ${studio.toUpperCase()}`, designW / 2, 85);
        ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(`${yearTag.toUpperCase()}  |  ${slogan}`, designW / 2, 125);
        ctx.restore();

        const pad = 60;
        const topY = 160;
        const botH = 340;
        const gridH = designH - topY - botH;
        const gap = 20;

        // 3-Column Bento Grid
        const colW = (designW - 2 * pad - 2 * gap) / 3;
        const rowH = (gridH - 2 * gap) / 3;

        // Cell 0: Top-left tall
        drawCoverImage(ctx, getImg(0), pad, topY, colW, rowH * 1.6, 20, getFaces(0), biasY);
        // Cell 1: Top-mid
        drawCoverImage(ctx, getImg(1), pad + colW + gap, topY, colW, rowH * 0.9, 20, getFaces(1), biasY);
        // Cell 2: Top-right wide-ish
        drawCoverImage(ctx, getImg(2), pad + 2 * (colW + gap), topY, colW, rowH * 1.2, 20, getFaces(2), biasY);

        // Cell 3: Mid-left
        const m1Y = topY + rowH * 1.6 + gap;
        drawCoverImage(ctx, getImg(3), pad, m1Y, colW, gridH - (rowH * 1.6 + gap), 20, getFaces(3), biasY);
        // Cell 4: Center focus
        const m2Y = topY + rowH * 0.9 + gap;
        drawCoverImage(ctx, getImg(4), pad + colW + gap, m2Y, colW, rowH * 1.1, 20, getFaces(4), biasY);
        // Cell 5: Center-bottom
        const m3Y = m2Y + rowH * 1.1 + gap;
        drawCoverImage(ctx, getImg(5), pad + colW + gap, m3Y, colW, gridH - (m3Y - topY), 20, getFaces(5), biasY);
        // Cell 6 & 7: Right column
        const r2Y = topY + rowH * 1.2 + gap;
        drawCoverImage(ctx, getImg(6), pad + 2 * (colW + gap), r2Y, colW, rowH * 0.85, 20, getFaces(6), biasY);
        const r3Y = r2Y + rowH * 0.85 + gap;
        drawCoverImage(ctx, getImg(7), pad + 2 * (colW + gap), r3Y, colW, gridH - (r3Y - topY), 20, getFaces(7), biasY);

        // Bottom Reflected Silhouette Vignette
        const botVig = ctx.createLinearGradient(0, designH - botH - 80, 0, designH);
        botVig.addColorStop(0, 'rgba(180, 83, 9, 0)');
        botVig.addColorStop(0.35, 'rgba(180, 83, 9, 0.88)');
        botVig.addColorStop(1, '#78350f');
        ctx.fillStyle = botVig;
        ctx.fillRect(0, designH - botH - 80, designW, botH + 80);

        // Calligraphy "Concept Tuổi học trò"
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '600 36px "Playfair Display", Georgia, serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText('Concept', designW / 2, designH - 220);
        drawOutlinedText(
            ctx,
            concept || 'Tuổi học trò',
            designW / 2,
            designH - 100,
            'italic 700 118px "Dancing Script", Georgia, cursive',
            '#ffffff',
            'rgba(120, 53, 15, 0.65)',
            14,
            'center'
        );
        ctx.restore();
    }

    // =========================================================================
    // 12. Sổ Tay Cuộn Film Kỷ Yếu (Mẫu 2 Mới)
    // =========================================================================
    else if (options.templateId === 'kyyeu_cuon_film_sotay') {
        // Light notebook paper background with subtle grid lines
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, designW, designH);

        // Grid lines (ô ly học sinh)
        ctx.save();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        const gridStep = 44;
        for (let x = gridStep; x < designW; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, designH);
            ctx.stroke();
        }
        for (let y = gridStep; y < designH; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(designW, y);
            ctx.stroke();
        }
        ctx.restore();

        // Handwritten Title top
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'italic 700 88px "Dancing Script", cursive';
        ctx.fillStyle = '#1d4ed8';
        ctx.shadowColor = 'rgba(29, 78, 216, 0.2)';
        ctx.shadowBlur = 12;
        ctx.fillText(concept ? `Top những cuộn film chụp ${concept}` : 'Top những cuộn film chụp kỷ yếu', designW / 2, 210);

        // Year Stamp Oval
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(designW / 2 + 360, 290, 110, 42, 0.08, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = '700 32px "Playfair Display", serif';
        ctx.fillStyle = '#2563eb';
        ctx.fillText(yearTag.includes('20') ? yearTag : '2025-2026', designW / 2 + 360, 302);
        ctx.restore();

        // 6 Tilted Polaroid/Film Cards
        const cardSpecs = [
            { x: 120, y: 380, w: 720, h: 520, rot: -0.04, imgIdx: 0 },
            { x: 920, y: 400, w: 940, h: 560, rot: 0.03, imgIdx: 1 },
            { x: 100, y: 960, w: 600, h: 520, rot: 0.02, imgIdx: 2 },
            { x: 740, y: 920, w: 580, h: 620, rot: -0.02, imgIdx: 3 },
            { x: 1360, y: 840, w: 520, h: 680, rot: 0.04, imgIdx: 4 },
            { x: 1040, y: 1540, w: 840, h: 600, rot: -0.03, imgIdx: 5 }
        ];

        cardSpecs.forEach((c) => {
            ctx.save();
            const cx = c.x + c.w / 2;
            const cy = c.y + c.h / 2;
            ctx.translate(cx, cy);
            ctx.rotate(c.rot);
            ctx.translate(-cx, -cy);

            ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
            ctx.shadowBlur = 24;
            ctx.shadowOffsetY = 12;
            roundRect(ctx, c.x, c.y, c.w, c.h, 12);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(c.rot);
            ctx.translate(-cx, -cy);
            const padBorder = 16;
            drawCoverImage(ctx, getImg(c.imgIdx), c.x + padBorder, c.y + padBorder, c.w - padBorder * 2, c.h - padBorder * 2, 8, getFaces(c.imgIdx), biasY);
            ctx.restore();
        });

        // 2 Film Canister Vectors
        drawFilmCanister(ctx, 1680, 800, 0.95, 0.22, 'fuji');
        drawFilmCanister(ctx, 420, 1950, 1.15, -0.18, 'kodak');

        // Studio Footer Tag
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(`${studio.toUpperCase()}  •  ${slogan}  •  Hotline: ${hotline}`, designW / 2, designH - 60);
        ctx.restore();
    }

    // =========================================================================
    // 13. Nắng Xiên Cầu Thang 9 Ô (Mẫu 3 Mới - BFF Media Style)
    // =========================================================================
    else if (options.templateId === 'kyyeu_nang_xien_bff') {
        ctx.fillStyle = '#29180c';
        ctx.fillRect(0, 0, designW, designH);

        const pad = 40;
        const gap = 16;
        const topH = 1380;
        const botH = designH - pad * 2 - topH - gap;

        // Col 1 & 3: Width = 520, Col 2: Width = 840
        const c1W = 540;
        const c2W = 780;
        const c3W = designW - pad * 2 - gap * 2 - c1W - c2W;

        // Col 1 (3 slots)
        const c1sH = (topH - 2 * gap) / 3;
        drawCoverImage(ctx, getImg(0), pad, pad, c1W, c1sH, 0, getFaces(0), biasY);
        drawCoverImage(ctx, getImg(1), pad, pad + c1sH + gap, c1W, c1sH, 0, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), pad, pad + 2 * (c1sH + gap), c1W, c1sH, 0, getFaces(2), biasY);

        // Col 2 (2 tall slots)
        const c2sH = (topH - gap) / 2;
        drawCoverImage(ctx, getImg(3), pad + c1W + gap, pad, c2W, c2sH, 0, getFaces(3), biasY);
        drawCoverImage(ctx, getImg(4), pad + c1W + gap, pad + c2sH + gap, c2W, c2sH, 0, getFaces(4), biasY);

        // Col 3 (3 slots)
        drawCoverImage(ctx, getImg(5), pad + c1W + c2W + 2 * gap, pad, c3W, c1sH, 0, getFaces(5), biasY);
        drawCoverImage(ctx, getImg(6), pad + c1W + c2W + 2 * gap, pad + c1sH + gap, c3W, c1sH, 0, getFaces(6), biasY);
        drawCoverImage(ctx, getImg(7), pad + c1W + c2W + 2 * gap, pad + 2 * (c1sH + gap), c3W, c1sH, 0, getFaces(7), biasY);

        // Bottom Row (2 wide slots)
        const bY = pad + topH + gap;
        const bW1 = 760;
        const bW2 = designW - pad * 2 - gap - bW1;
        drawCoverImage(ctx, getImg(8), pad, bY, bW1, botH, 0, getFaces(8), biasY);
        drawCoverImage(ctx, getImg(9), pad + bW1 + gap, bY, bW2, botH, 0, getFaces(9), biasY);

        // Subtle Logo Stamp
        ctx.save();
        ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 8;
        ctx.fillText(`📷 ${studio.toUpperCase()}`, pad + 20, designH - pad - 20);
        ctx.textAlign = 'right';
        ctx.fillText(yearTag.toUpperCase(), designW - pad - 20, designH - pad - 20);
        ctx.restore();
    }

    // =========================================================================
    // 14. Dải Phim Uốn Lượn Thanh Xuân (Mẫu 4 Mới)
    // =========================================================================
    else if (options.templateId === 'kyyeu_dai_phim_uon_luon') {
        // Background photo with soft dream filter
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), 0.35);

        // Top quote header
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'italic 600 36px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 4;
        ctx.fillText(`“${quoteText}”`, designW / 2, 140);
        ctx.restore();

        // 3D Curved Film Strip running across screen
        const filmY = 460;
        const filmH = 780;
        ctx.save();
        ctx.translate(0, filmY);
        ctx.rotate(-0.04);

        // Film strip border shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 32;
        ctx.shadowOffsetY = 16;
        roundRect(ctx, -80, 0, designW + 160, filmH, 20);
        ctx.fillStyle = '#312e81';
        ctx.fill();
        ctx.restore();

        // Draw Sprocket holes along top & bottom of tilted strip
        ctx.save();
        ctx.translate(0, filmY);
        ctx.rotate(-0.04);
        ctx.fillStyle = '#f8fafc';
        for (let x = -40; x < designW + 80; x += 55) {
            roundRect(ctx, x, 24, 34, 48, 8);
            ctx.fill();
            roundRect(ctx, x, filmH - 72, 34, 48, 8);
            ctx.fill();
        }

        // Inside the film strip: 3 large photo frames
        const innerH = filmH - 180;
        const fW = 560;
        const fGap = 30;
        const startFX = (designW - 3 * fW - 2 * fGap) / 2;
        for (let i = 0; i < 3; i++) {
            const fx = startFX + i * (fW + fGap);
            drawCoverImage(ctx, getImg(1 + i), fx, 90, fW, innerH, 12, getFaces(1 + i), biasY);
        }
        ctx.restore();

        // Bottom Brand Pill
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 12;
        ctx.fillText(`${studio.toUpperCase()}  •  ${concept.toUpperCase()}  •  ${yearTag.toUpperCase()}`, designW / 2, designH - 70);
        ctx.restore();
    }

    // =========================================================================
    // 15. Nhật Ký Giấy Rách Cổ Điển (Mẫu 5 Mới - Scrapbook)
    // =========================================================================
    else if (options.templateId === 'kyyeu_scrapbook_vintage') {
        drawBlurredBackground(ctx, getImg(0), designW, designH, 24, 'rgba(30, 41, 59, 0.45)', getFaces(0));

        // Horizontal decorative red ribbon
        const ribY = designH / 2 + 180;
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, ribY, designW, 36);

        // 5 Deckle-edge Photo Cards
        const scrapCards = [
            { x: 90, y: 90, w: 840, h: 780, rot: -0.03, imgIdx: 0, note: 'Tình bạn chúng ta nguyện xin giữ mãi' },
            { x: 990, y: 120, w: 560, h: 740, rot: 0.03, imgIdx: 1, note: 'từng trang giấy với nét chữ quen thuộc' },
            { x: 1610, y: 280, w: 500, h: 700, rot: -0.02, imgIdx: 2, note: 'nụ cười hồn nhiên năm ấy' },
            { x: 260, y: 910, w: 580, h: 650, rot: 0.02, imgIdx: 3, note: 'ký ức thân thương gửi lại mái trường' },
            { x: 920, y: 900, w: 540, h: 630, rot: -0.01, imgIdx: 4, note: 'những dấu yêu ngút ngàn...' }
        ];

        scrapCards.forEach((sc) => {
            ctx.save();
            const cx = sc.x + sc.w / 2;
            const cy = sc.y + sc.h / 2;
            ctx.translate(cx, cy);
            ctx.rotate(sc.rot);
            ctx.translate(-cx, -cy);

            drawDeckleEdgeCard(ctx, sc.x, sc.y, sc.w, sc.h, '#faf6ee');
            const padC = 20;
            drawCoverImage(ctx, getImg(sc.imgIdx), sc.x + padC, sc.y + padC, sc.w - padC * 2, sc.h - padC * 2 - 60, 4, getFaces(sc.imgIdx), biasY);

            // Handwritten note
            ctx.font = 'italic 700 28px "Dancing Script", cursive';
            ctx.fillStyle = '#57534e';
            ctx.textAlign = 'center';
            ctx.fillText(sc.note, cx, sc.y + sc.h - 26);
            ctx.restore();
        });

        // Bottom-Right Brand Stamp
        ctx.save();
        ctx.textAlign = 'right';
        ctx.font = '800 48px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 14;
        ctx.fillText(concept || 'Tuổi Thanh Xuân...', designW - 90, designH - 140);
        ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#facc15';
        ctx.fillText(`${studio.toUpperCase()}  •  ${yearTag.toUpperCase()}`, designW - 90, designH - 95);
        ctx.restore();
    }

    // =========================================================================
    // 16. Youth Dream Tươi Sáng Đồng Cỏ (Mẫu 6 Mới - Kỷ Yếu Sài Gòn)
    // =========================================================================
    else if (options.templateId === 'kyyeu_youth_dream_co') {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, designW, designH);

        const pad = 65;
        const gap = 28;

        // Top-Left: Studio Brand Badge
        ctx.save();
        roundRect(ctx, pad, pad, 360, 360, 24);
        ctx.fillStyle = '#3f2e24';
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.font = '900 68px "Oswald", sans-serif';
        ctx.fillStyle = '#f97316';
        ctx.fillText('🎓', pad + 180, pad + 160);
        ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(studio.toUpperCase(), pad + 180, pad + 240);
        ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('PHOTOGRAPHY', pad + 180, pad + 285);
        ctx.restore();

        // Slot 0: Small top-left photo
        drawCoverImage(ctx, getImg(0), pad, pad + 360 + gap, 360, 480, 20, getFaces(0), biasY);

        // Slot 1: Big Hero Top-Right (Group smile)
        const hW = designW - pad * 2 - gap - 360;
        const hH = 360 + gap + 480;
        drawCoverImage(ctx, getImg(1), pad + 360 + gap, pad, hW, hH, 24, getFaces(1), biasY);

        // Calligraphy quote on top right hero
        drawOutlinedText(
            ctx,
            'Điều tuyệt vời nhất của thanh xuân',
            pad + 360 + gap + 40,
            pad + 90,
            'italic 700 48px "Dancing Script", cursive',
            '#0d9488',
            '#ffffff',
            8
        );

        // Mid Banner Divider
        const midY = pad + hH + 24;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'italic 700 22px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('THƯƠNG HIỆU TIÊN PHONG DẪN ĐẦU XU THẾ KỶ YẾU', designW / 2, midY + 16);
        ctx.restore();

        // Slot 2: Bottom-left wide meadow
        const bY = midY + 44;
        const bW = 1180;
        const bH = designH - bY - pad;
        drawCoverImage(ctx, getImg(2), pad, bY, bW, bH, 20, getFaces(2), biasY);

        drawOutlinedText(
            ctx,
            'Chuyến đi của thanh xuân',
            pad + 50,
            bY + 80,
            'italic 700 52px "Dancing Script", cursive',
            '#451a03',
            '#ffffff',
            8
        );

        // Slot 3: Bottom-right lying grass
        const rW = designW - pad * 2 - gap - bW;
        const rH = bH - 180 - gap;
        drawCoverImage(ctx, getImg(3), pad + bW + gap, bY, rW, rH, 20, getFaces(3), biasY);

        // Concept Label Box Bottom Right
        const tagY = bY + rH + gap;
        roundRect(ctx, pad + bW + gap, tagY, rW, 180, 24);
        ctx.fillStyle = '#3f2e24';
        ctx.fill();

        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#fdba74';
        ctx.fillText('C O N C E P T', pad + bW + gap + rW / 2, tagY + 54);
        ctx.font = '900 44px "Oswald", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText((concept || 'YOUTH DREAM').toUpperCase(), pad + bW + gap + rW / 2, tagY + 115);
        ctx.restore();
    }

    // =========================================================================
    // 17. Khi Ta Còn Trẻ - Sân Tennis (Mẫu 7 Mới)
    // =========================================================================
    else if (options.templateId === 'kyyeu_khi_ta_con_tre_tennis') {
        const segH = Math.ceil(designH / 3);

        // 3 Tiers blended
        drawCoverImage(ctx, getImg(0), 0, 0, designW, segH + 80, 0, getFaces(0), biasY);
        drawFeatheredCoverImage(ctx, getImg(1), 0, segH, designW, segH + 80, 80, 80, getFaces(1), biasY);
        drawFeatheredCoverImage(ctx, getImg(2), 0, segH * 2, designW, segH + 20, 80, 0, getFaces(2), biasY);

        // Calligraphy Title "Khi ta còn trẻ"
        drawOutlinedText(
            ctx,
            concept || 'Khi ta còn trẻ',
            designW - 120,
            segH + 80,
            'italic 700 110px "Dancing Script", cursive',
            '#ffffff',
            'rgba(15, 23, 42, 0.45)',
            12,
            'right'
        );

        // 2 Tilted Polaroid cards pinned across the middle
        const p1X = 640;
        const p1Y = segH + 110;
        ctx.save();
        ctx.translate(p1X + 240, p1Y + 220);
        ctx.rotate(-0.06);
        ctx.translate(-(p1X + 240), -(p1Y + 220));
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 28;
        roundRect(ctx, p1X, p1Y, 480, 440, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        drawCoverImage(ctx, getImg(3), p1X + 16, p1Y + 16, 448, 350, 4, getFaces(3), biasY);
        ctx.restore();

        const p2X = 1050;
        const p2Y = segH + 200;
        ctx.save();
        ctx.translate(p2X + 260, p2Y + 240);
        ctx.rotate(0.08);
        ctx.translate(-(p2X + 260), -(p2Y + 240));
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 32;
        roundRect(ctx, p2X, p2Y, 520, 480, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        drawCoverImage(ctx, getImg(4), p2X + 18, p2Y + 18, 484, 380, 4, getFaces(4), biasY);
        ctx.restore();
    }

    // =========================================================================
    // 18. Phim Ngôn Tình WeTV (Mẫu 8 Mới - Movie Romance)
    // =========================================================================
    else if (options.templateId === 'movie_wetv_romance') {
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);

        // Dreamy Bokeh Lights Overlay
        drawSoapBubbles(ctx, designW, designH);

        // Cinematic top & bottom dark vignetting
        const topVig = ctx.createLinearGradient(0, 0, 0, 480);
        topVig.addColorStop(0, 'rgba(15, 23, 42, 0.7)');
        topVig.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = topVig;
        ctx.fillRect(0, 0, designW, 480);

        const botVig = ctx.createLinearGradient(0, designH - 750, 0, designH);
        botVig.addColorStop(0, 'rgba(15, 23, 42, 0)');
        botVig.addColorStop(0.45, 'rgba(15, 23, 42, 0.75)');
        botVig.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
        ctx.fillStyle = botVig;
        ctx.fillRect(0, designH - 750, designW, 750);

        // Movie Title
        drawOutlinedText(
            ctx,
            movieTitle,
            designW / 2,
            designH - 310,
            '900 84px "Playfair Display", Georgia, serif',
            '#ffffff',
            'rgba(0,0,0,0.7)',
            14,
            'center'
        );

        // Subtitle / Tagline
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.letterSpacing = '6px';
        ctx.fillText(movieSubtitle.toUpperCase(), designW / 2, designH - 240);
        ctx.restore();

        // Platform Logo (WeTV default)
        drawPlatformBadge(ctx, platform, designW / 2, designH - 120, 1.25);
    }

    // =========================================================================
    // 19. K-Drama Song Hành Đối Xứng (Mẫu 9 Mới)
    // =========================================================================
    else if (options.templateId === 'movie_kdrama_split') {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, designW, designH);

        // Top half: 2 symmetrical close-ups (Left: Female, Right: Male)
        const topH = 1260;
        const halfW = designW / 2;
        drawCoverImage(ctx, getImg(0), 0, 0, halfW, topH, 0, getFaces(0), biasY);
        drawCoverImage(ctx, getImg(1), halfW, 0, halfW, topH, 0, getFaces(1), biasY);

        // Seam soft blend
        const seamG = ctx.createLinearGradient(halfW - 30, 0, halfW + 30, 0);
        seamG.addColorStop(0, 'rgba(9, 9, 11, 0)');
        seamG.addColorStop(0.5, 'rgba(9, 9, 11, 0.7)');
        seamG.addColorStop(1, 'rgba(9, 9, 11, 0)');
        ctx.fillStyle = seamG;
        ctx.fillRect(halfW - 30, 0, 60, topH);

        // Bottom half: Scene photo
        const botY = topH;
        const botH = designH - topH;
        drawCoverImage(ctx, getImg(2), 0, botY, designW, botH, 0, getFaces(2), biasY);

        // Central Dark Vignette Band behind Title
        const bandH = 340;
        const bandY = topH - bandH / 2;
        const bandGrad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
        bandGrad.addColorStop(0, 'rgba(9, 9, 11, 0)');
        bandGrad.addColorStop(0.3, 'rgba(9, 9, 11, 0.88)');
        bandGrad.addColorStop(0.7, 'rgba(9, 9, 11, 0.88)');
        bandGrad.addColorStop(1, 'rgba(9, 9, 11, 0)');
        ctx.fillStyle = bandGrad;
        ctx.fillRect(0, bandY, designW, bandH);

        // Central Title
        drawOutlinedText(
            ctx,
            movieTitle || 'Tiếng Yêu này ANH Dịch được không?',
            designW / 2,
            topH + 18,
            '900 68px "Playfair Display", Georgia, serif',
            '#ffffff',
            'rgba(0,0,0,0.85)',
            12,
            'center'
        );

        // Actors & Platform bottom
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(actors.toUpperCase(), designW / 2, designH - 85);
        ctx.restore();
    }

    // =========================================================================
    // 20. Tình Yêu Độc Nhất Pastel (Mẫu 10 Mới)
    // =========================================================================
    else if (options.templateId === 'movie_pastel_dream') {
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);

        // Bubbles overlay
        drawSoapBubbles(ctx, designW, designH);

        // Soft white dream vignette bottom
        const botG = ctx.createLinearGradient(0, designH - 800, 0, designH);
        botG.addColorStop(0, 'rgba(255, 255, 255, 0)');
        botG.addColorStop(0.5, 'rgba(15, 23, 42, 0.45)');
        botG.addColorStop(1, 'rgba(15, 23, 42, 0.88)');
        ctx.fillStyle = botG;
        ctx.fillRect(0, designH - 800, designW, 800);

        // 2-tier Title: Cursive white + Retro pink
        drawOutlinedText(
            ctx,
            'Tình Yêu',
            designW / 2,
            designH - 360,
            'italic 700 96px "Dancing Script", cursive',
            '#ffffff',
            'rgba(0,0,0,0.5)',
            12,
            'center'
        );

        drawOutlinedText(
            ctx,
            'ĐỘC NHẤT',
            designW / 2,
            designH - 240,
            '900 128px "Oswald", sans-serif',
            '#f472b6',
            '#ffffff',
            16,
            'center'
        );

        // Subtitle
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'italic 600 32px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 8;
        ctx.fillText(`“${movieSubtitle}”`, designW / 2, designH - 160);
        ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`${actors}  •  ${studio}`, designW / 2, designH - 100);
        ctx.restore();
    }

    // =========================================================================
    // 21. Phim Truyền Hình VieON (Mẫu 11 Mới)
    // =========================================================================
    else if (options.templateId === 'movie_vieon_fireworks') {
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, getFaces(0), biasY);

        // Firefly particles
        drawFireflies(ctx, designW, designH, '#86efac');

        // Top Left: SONG SONG badge
        roundRect(ctx, 60, 60, 240, 54, 27);
        ctx.fillStyle = '#16a34a';
        ctx.fill();
        ctx.save();
        ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▶ SONG SONG', 180, 87);
        ctx.restore();

        // Top Right: VieON Platform
        drawPlatformBadge(ctx, 'vieon', designW - 180, 85, 1.1);

        // Bottom green atmosphere vignette
        const botV = ctx.createLinearGradient(0, designH - 700, 0, designH);
        botV.addColorStop(0, 'rgba(5, 46, 22, 0)');
        botV.addColorStop(0.5, 'rgba(5, 46, 22, 0.7)');
        botV.addColorStop(1, 'rgba(5, 46, 22, 0.95)');
        ctx.fillStyle = botV;
        ctx.fillRect(0, designH - 700, designW, 700);

        // Title
        drawOutlinedText(
            ctx,
            movieTitle || 'Tình Yêu Có Pháo Hoa',
            designW / 2,
            designH - 300,
            '900 86px "Playfair Display", Georgia, serif',
            '#ffffff',
            'rgba(0,0,0,0.65)',
            12,
            'center'
        );

        // Subtitle script
        drawOutlinedText(
            ctx,
            movieSubtitle || 'Love has fireworks',
            designW / 2,
            designH - 210,
            'italic 700 64px "Dancing Script", cursive',
            '#fde047',
            'rgba(0,0,0,0.5)',
            8,
            'center'
        );

        // Broadcast schedule
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(broadcastTime, designW / 2, designH - 110);
        ctx.restore();
    }

    // =========================================================================
    // 22. MV & Phim Nghệ Thuật Đồng Thoại (Mẫu 12 Mới)
    // =========================================================================
    else if (options.templateId === 'movie_dong_thoai') {
        ctx.fillStyle = '#e5decf';
        ctx.fillRect(0, 0, designW, designH);

        // Bottom tier: Solitary landscape / Couple standing
        const botH = 1350;
        const botY = designH - botH;
        drawCoverImage(ctx, getImg(1), 0, botY, designW, botH, 0, getFaces(1), biasY);

        // Top tier: Dreamy Double Exposure Portrait couple
        const topH = 1200;
        drawFeatheredCoverImage(ctx, getImg(0), 0, 0, designW, topH, 0, 320, getFaces(0), biasY);

        // Soft warm sepia filter overlay
        ctx.fillStyle = 'rgba(217, 119, 6, 0.08)';
        ctx.fillRect(0, 0, designW, designH);

        // Central Pine Tree Line & Artistic Title
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#451a03';
        ctx.fillText('NHẠC HOA LỜI VIỆT', designW / 2, topH - 120);

        drawOutlinedText(
            ctx,
            movieTitle || 'ĐỒNG THOẠI',
            designW / 2,
            topH - 55,
            '900 68px "Playfair Display", Georgia, serif',
            '#ffffff',
            'rgba(69, 26, 3, 0.65)',
            10,
            'center'
        );

        drawOutlinedText(
            ctx,
            movieSubtitle || 'Chung Đôi',
            designW / 2,
            topH + 55,
            'italic 700 96px "Dancing Script", cursive',
            '#ffffff',
            'rgba(69, 26, 3, 0.65)',
            12,
            'center'
        );

        // Actors & Release Date
        ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#292524';
        ctx.fillText(actors.toUpperCase(), designW / 2, designH - 240);

        ctx.font = '900 64px "Oswald", sans-serif';
        ctx.fillStyle = '#1c1917';
        ctx.fillText(releaseDate, designW / 2, designH - 150);

        ctx.font = '600 18px monospace';
        ctx.fillStyle = '#78716c';
        ctx.fillText('ORIGINAL SOUNDTRACK  •  ALL RIGHTS RESERVED', designW / 2, designH - 95);
        ctx.restore();
    }
    else if (options.templateId === 'story_9_16_music') {
        drawBlurredBackground(ctx, getImg(0), designW, designH, 32, 'rgba(15, 23, 42, 0.55)', getFaces(0));

        const pad = 75;

        // Top Story Header
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '900 54px "Oswald", "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(concept.toUpperCase(), designW / 2, 130);
        ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(`${studio}  •  ${yearTag}`, designW / 2, 180);
        ctx.restore();

        // Main Portrait Photo
        const heroY = 230;
        const heroH = 1000;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 24;
        roundRect(ctx, pad, heroY, designW - 2 * pad, heroH, 36);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
        drawCoverImage(ctx, getImg(0), pad, heroY, designW - 2 * pad, heroH, 36, getFaces(0), biasY);

        // 2 Sub Photos Row
        const subY = heroY + heroH + 35;
        const subW = (designW - 2 * pad - 30) / 2;
        const subH = 540;
        drawCoverImage(ctx, getImg(1), pad, subY, subW, subH, 28, getFaces(1), biasY);
        drawCoverImage(ctx, getImg(2), pad + subW + 30, subY, subW, subH, 28, getFaces(2), biasY);

        // Music Player Widget Bottom
        const wY = subY + subH + 55;
        const wH = 380;
        ctx.save();
        roundRect(ctx, pad, wY, designW - 2 * pad, wH, 36);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Circular Vinyl Disc Thumbnail
        const discSize = 180;
        drawCoverImage(ctx, getImg(3), pad + 40, wY + 55, discSize, discSize, discSize / 2, getFaces(3), biasY);

        // Track Title & Artist
        const tx = pad + 250;
        ctx.textAlign = 'left';
        ctx.font = '800 42px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(concept, tx, wY + 115);

        ctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(`${studio} • Hotline: ${hotline}`, tx, wY + 165);

        // Progress Bar
        const barW = designW - 2 * pad - 290;
        const barY = wY + 215;
        roundRect(ctx, tx, barY, barW, 10, 5);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fill();

        roundRect(ctx, tx, barY, barW * 0.65, 10, 5);
        ctx.fillStyle = options.accentColor;
        ctx.fill();

        // Knob
        ctx.beginPath();
        ctx.arc(tx + barW * 0.65, barY + 5, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Playback Controls
        ctx.font = '700 44px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('⏮', tx + 80, wY + 315);
        ctx.fillText('⏸', tx + barW / 2 - 40, wY + 315);
        ctx.fillText('⏭', tx + barW - 140, wY + 315);
        ctx.fillText('❤️', tx + barW - 25, wY + 315);
        ctx.restore();
    }

    // Export to High Quality JPEG Data URL (95% quality is visually lossless and 5x faster than PNG)
    return canvas.toDataURL('image/jpeg', 0.95);
}
