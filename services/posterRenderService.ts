/**
 * Poster & Catalog Studio Rendering Engine (v2.25.52)
 * High-End Creative Generative Graphic Compositor
 * Supports 16 Cinematic & Multi-Layer Themes across BOTH:
 * - 📱 Khổ Dọc 9:16 (Story, TikTok, Mobile Wallpaper, Standee)
 * - 🖥️ Khổ Ngang 16:9 (PC Wallpaper, TV Display, YouTube Thumbnail, Cinema Banner)
 * Features realistic vector assets: Poinciana blossoms, Silk ribbons, Vinyl records,
 * Cassette tapes, 3D Film strips, Paperclips, Torn paper stickers, Guitars, Headphones,
 * Lens flare, Billing blocks, and AI Headroom Protection.
 */

import { detectFacesInImage, calculateSmartCrop, type FaceBox } from './aiFaceDetectService';

export type PosterCategory = 'ky_yeu' | 'phim_anh';
export type PosterAspectRatio = '9:16' | '16:9';

export type PosterTemplateId =
    | 'creative_thanh_xuan_hoa_phuong'
    | 'creative_dai_phim_3d'
    | 'creative_so_tay_dia_than'
    | 'creative_music_pop_art'
    | 'creative_kdrama_lensflare'
    | 'creative_wong_kar_wai'
    | 'creative_ott_movie_billing'
    | 'creative_dong_thoai_double_exposure'
    | 'creative_autumn_ginkgo'
    | 'creative_summer_beach'
    | 'creative_winter_snow_globe'
    | 'creative_spring_cherry_blossom'
    | 'creative_y2k_magazine'
    | 'creative_chalkboard_desk'
    | 'creative_korean_minimal_white'
    | 'creative_infinite_remix'
    | string;

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
    { id: 'cherry', name: 'Đỏ Cherry / Phượng Vĩ', hex: '#dc2626' },
    { id: 'amber', name: 'Vàng Hoàng Hôn / Kraft', hex: '#d97706' },
    { id: 'blue', name: 'Xanh Lam / Film 35mm', hex: '#2563eb' },
    { id: 'teal', name: 'Xanh Ngọc / Bãi Biển', hex: '#0d9488' },
    { id: 'purple', name: 'Tím Mộng Mơ / Pop-Art', hex: '#7c3aed' },
    { id: 'slate', name: 'Đen Cổ Điển / Điện Ảnh', hex: '#0f172a' }
];

// Helper to normalize any ID into one of the 16 core creative styles
function normalizeToCreativeStyle(id: string): string {
    if (id.startsWith('creative_')) return id;
    if (id.includes('film') || id.includes('strip')) return 'creative_dai_phim_3d';
    if (id.includes('scrapbook') || id.includes('cork') || id.includes('sotay')) return 'creative_so_tay_dia_than';
    if (id.includes('music') || id.includes('pop') || id.includes('guitar')) return 'creative_music_pop_art';
    if (id.includes('kdrama')) return 'creative_kdrama_lensflare';
    if (id.includes('retro') || id.includes('noir') || id.includes('tokyo') || id.includes('wong')) return 'creative_wong_kar_wai';
    if (id.includes('wetv') || id.includes('vieon') || id.includes('ott') || id.includes('billing')) return 'creative_ott_movie_billing';
    if (id.includes('dong_thoai') || id.includes('double') || id.includes('field')) return 'creative_dong_thoai_double_exposure';
    if (id.includes('autumn') || id.includes('thu')) return 'creative_autumn_ginkgo';
    if (id.includes('summer') || id.includes('beach') || id.includes('he')) return 'creative_summer_beach';
    if (id.includes('winter') || id.includes('snow') || id.includes('dong')) return 'creative_winter_snow_globe';
    if (id.includes('spring') || id.includes('cherry') || id.includes('xuan')) return 'creative_spring_cherry_blossom';
    if (id.includes('y2k') || id.includes('ticket') || id.includes('magazine') || id.includes('vogue')) return 'creative_y2k_magazine';
    if (id.includes('chalk') || id.includes('bang') || id.includes('tennis')) return 'creative_chalkboard_desk';
    if (id.includes('minimal') || id.includes('nordic') || id.includes('white')) return 'creative_korean_minimal_white';
    return 'creative_thanh_xuan_hoa_phuong';
}

// 16 Core Creative Themes metadata
const CREATIVE_THEMES_CONFIG = [
    {
        baseId: 'creative_thanh_xuan_hoa_phuong',
        name: 'Thanh Xuân Hoa Phượng',
        tagline: 'Hero toàn thân + Polaroid + Ruy băng đỏ & Hoa phượng vĩ (Ảnh 1 & 5)',
        idealSlots: 3,
        slotLabels: ['Hero Cặp Đôi Chính', 'Polaroid Nghiêng 1', 'Polaroid Nghiêng 2'],
        badge: 'HOT NHẤT',
        color: '#dc2626',
        category: 'ky_yeu' as PosterCategory,
        description: 'Bố cục chuẩn ảnh mẫu 1 & 5: Cặp đôi nổi bật dưới nắng hè, hoa phượng đỏ rủ bóng, 2 ảnh Polaroid ghim nghiêng và dải ruy băng lụa đỏ thướt tha.'
    },
    {
        baseId: 'creative_dai_phim_3d',
        name: 'Dải Phim Uốn Lượn 3D',
        tagline: 'Dải phim 35mm ôm trọn 4 ảnh + Sticker xé giấy & Doodle (Ảnh 2)',
        idealSlots: 4,
        slotLabels: ['Cảnh 1 trên dải phim', 'Cảnh 2 trên dải phim', 'Cảnh 3 trên dải phim', 'Cảnh 4 trên dải phim'],
        badge: 'ĐIỆN ẢNH',
        color: '#2563eb',
        category: 'ky_yeu' as PosterCategory,
        description: 'Bố cục chuẩn ảnh mẫu 2: Dải phim 35mm xanh dương uốn lượn 3D xuyên qua poster, sticker xé giấy đỏ vàng, icon tai nghe và hoa phượng.'
    },
    {
        baseId: 'creative_so_tay_dia_than',
        name: 'Sổ Tay Giấy Rách & Đĩa Than',
        tagline: 'Bìa Kraft xé cháy + Đĩa than vinyl, cassette & kẹp ghim (Ảnh 3)',
        idealSlots: 4,
        slotLabels: ['Polaroid Bìa Trái', 'Polaroid Trên Phải', 'Polaroid Giữa', 'Polaroid Đáy'],
        badge: 'VINTAGE',
        color: '#b45309',
        category: 'ky_yeu' as PosterCategory,
        description: 'Bố cục chuẩn ảnh mẫu 3: Nền giấy Kraft xé viền cháy cổ điển, đĩa than vinyl đen bóng, cuộn băng cassette, kẹp bướm vàng và 4 ảnh Polaroid dán băng dính.'
    },
    {
        baseId: 'creative_music_pop_art',
        name: 'Music Studio Pop-Art',
        tagline: 'Đàn Guitar + Tai nghe DJ + Đĩa than & Lượn sóng rực rỡ (Ảnh 4)',
        idealSlots: 3,
        slotLabels: ['Khung bo cong trên', 'Khung bo cong giữa', 'Khung bo cong đáy'],
        badge: 'POP-ART',
        color: '#7c3aed',
        category: 'ky_yeu' as PosterCategory,
        description: 'Bố cục chuẩn ảnh mẫu 4: Đường cong năng động vàng-xanh-đỏ, đàn guitar acoustic, tai nghe DJ, đĩa than vinyl và 3 khung ảnh bo tròn mềm mại.'
    },
    {
        baseId: 'creative_kdrama_lensflare',
        name: 'K-Drama Ngược Nắng',
        tagline: 'Vệt lóa sáng Anamorphic Flare + Tựa đề chìm sau lưng nhân vật',
        idealSlots: 2,
        slotLabels: ['Cặp đôi ngược nắng ven tóc', 'Khoảnh khắc cận cảnh'],
        badge: 'K-DRAMA',
        color: '#3b82f6',
        category: 'phim_anh' as PosterCategory,
        description: 'Hiệu ứng ánh sáng hoàng hôn ngược nắng ven tóc (Rim light), vệt sáng xanh Anamorphic Flare trải dài và tựa đề phim lồng chìm sau lưng.'
    },
    {
        baseId: 'creative_wong_kar_wai',
        name: 'Hồng Kông 90s Vương Gia Vệ',
        tagline: 'Ánh đèn neon đỏ rượu & ngọc lục bảo + Hạt phim xước 35mm',
        idealSlots: 3,
        slotLabels: ['Chân dung phố đêm', 'Cận cảnh hoài niệm', 'Bước chân đôi'],
        badge: 'RETRO 90S',
        color: '#991b1b',
        category: 'phim_anh' as PosterCategory,
        description: 'Màu phim Hồng Kông kinh điển thập niên 90, ánh đèn neon ấm áp, hạt phim nhựa Kodak 35mm, dấu mộc bưu điện đỏ và câu thoại song ngữ.'
    },
    {
        baseId: 'creative_ott_movie_billing',
        name: 'Poster Phim Rạp OTT',
        tagline: 'Bokeh ánh đèn đêm + Cụm Billing Block đạo diễn chuẩn CGV/BHD',
        idealSlots: 2,
        slotLabels: ['Ảnh chính cặp đôi', 'Ảnh cận cảm xúc'],
        badge: 'RẠP CHIẾU',
        color: '#0f172a',
        category: 'phim_anh' as PosterCategory,
        description: 'Poster phim chiếu rạp đỉnh cao với ánh sáng bokeh tròn lung linh, badge WeTV/VieON và cụm credit chữ nhỏ thanh mảnh dãn cách chuẩn quốc tế.'
    },
    {
        baseId: 'creative_dong_thoai_double_exposure',
        name: 'MV Đồng Thoại Lồng Hình',
        tagline: 'Double Exposure cây thông cô đơn trên đồi cỏ vintage',
        idealSlots: 2,
        slotLabels: ['Ảnh cận đôi hòa trộn cây thông', 'Toàn cảnh đồi cỏ thảo nguyên'],
        badge: 'MV CHUNG ĐÔI',
        color: '#78350f',
        category: 'phim_anh' as PosterCategory,
        description: 'Nghệ thuật lồng hình siêu thực (Double Exposure) ảnh cận mặt đôi uyên ương mọc lên từ tán cây thông cô đơn trên đồi cỏ vintage.'
    },
    {
        baseId: 'creative_autumn_ginkgo',
        name: 'Mùa Thu Lá Vàng Seoul',
        tagline: 'Lá ngân hạnh vàng óng & lá phong đỏ bay trong gió',
        idealSlots: 3,
        slotLabels: ['Cặp đôi dưới tán cây thu', 'Khoảnh khắc khăn len', 'Chi tiết mùa thu'],
        badge: 'MÙA THU',
        color: '#ea580c',
        category: 'ky_yeu' as PosterCategory,
        description: 'Tone màu latte mật ong ấm áp, lá ngân hạnh vàng và lá phong đỏ rơi bồng bềnh, tạo không khí lãng mạn như phim thu Hàn Quốc.'
    },
    {
        baseId: 'creative_summer_beach',
        name: 'Mùa Hè Biển Xanh Hawaii',
        tagline: 'Sóng biển xanh ngọc, bờ cát trắng, vỏ ốc & Polaroid dán băng dính',
        idealSlots: 3,
        slotLabels: ['Cặp đôi bờ biển', 'Sóng vỗ cát trắng', 'Nụ cười mùa hè'],
        badge: 'BIỂN XANH',
        color: '#0d9488',
        category: 'ky_yeu' as PosterCategory,
        description: 'Sóng biển dạt dào, cát trắng tinh khôi, sao biển và các tấm Polaroid dán băng dính trong suốt mang trọn hơi thở mùa hè rực rỡ.'
    },
    {
        baseId: 'creative_winter_snow_globe',
        name: 'Mùa Đông Tuyết Trắng',
        tagline: 'Bông tuyết rơi li ti + Đèn dây tóc fairy lights vàng ấm',
        idealSlots: 3,
        slotLabels: ['Chân dung tuyết rơi', 'Khăn len ấm áp', 'Đèn dây tóc đêm'],
        badge: 'MÙA ĐÔNG',
        color: '#0284c7',
        category: 'phim_anh' as PosterCategory,
        description: 'Không gian mùa đông cổ tích với những hạt tuyết trắng li ti rơi nhẹ, quả cầu tuyết chứa ảnh đôi và ánh đèn dây tóc vàng xua tan giá lạnh.'
    },
    {
        baseId: 'creative_spring_cherry_blossom',
        name: 'Mùa Xuân Hoa Anh Đào',
        tagline: 'Cánh hoa anh đào hồng pastel phấp phới & màu nước dịu ngọt',
        idealSlots: 3,
        slotLabels: ['Dưới tán hoa anh đào', 'Cận nụ cười thanh thuần', 'Góc phố mùa xuân'],
        badge: 'HOA ĐÀO',
        color: '#ec4899',
        category: 'ky_yeu' as PosterCategory,
        description: 'Cánh hoa sakura rơi bay bổng trong nắng xuân dịu ngọt, tông màu hồng phấn & xanh mint pastel tươi sáng thanh thuần.'
    },
    {
        baseId: 'creative_y2k_magazine',
        name: 'Tạp Chí Gen Z Y2K',
        tagline: 'Tem Hologram 7 màu phản quang + Barcode lớn & Neon Chrome',
        idealSlots: 3,
        slotLabels: ['Ảnh bìa thần thái', 'Ảnh style Gen Z 1', 'Ảnh style Gen Z 2'],
        badge: 'Y2K GEN-Z',
        color: '#6366f1',
        category: 'phim_anh' as PosterCategory,
        description: 'Bìa tạp chí tuổi teen Y2K cá tính với tem phản quang Hologram 7 màu, mã vạch barcode lớn, trái tim viền chrome neon nổi bật.'
    },
    {
        baseId: 'creative_chalkboard_desk',
        name: 'Bảng Đen Bàn Học Lưu Bút',
        tagline: 'Nền bảng xanh học đường, nét phấn vẽ tay & kẹp gỗ',
        idealSlots: 4,
        slotLabels: ['Ảnh lớp học chính', 'Polaroid góc trái', 'Polaroid góc phải', 'Lưu bút bàn học'],
        badge: 'BÀN HỌC',
        color: '#15803d',
        category: 'ky_yeu' as PosterCategory,
        description: 'Mặt bàn học gỗ sồi và bảng đen phủ bụi phấn, các hình vẽ phấn ngộ nghĩnh (thước kẻ, compa, tim) và 3 ảnh Polaroid kẹp gỗ xinh xắn.'
    },
    {
        baseId: 'creative_korean_minimal_white',
        name: 'Tối Giản Hàn Quốc Minimal',
        tagline: 'Nền trắng ngà thanh khiết, viền mỏng & font serif quý phái',
        idealSlots: 3,
        slotLabels: ['Ảnh chính tao nhã', 'Chi tiết nụ cười', 'Góc nghiêng thanh lịch'],
        badge: 'MINIMAL',
        color: '#475569',
        category: 'ky_yeu' as PosterCategory,
        description: 'Phong cách tối giản Bắc Âu & Hàn Quốc sang trọng, khoảng thở rộng rãi, bóng đổ mềm mịn và nét chữ serif tinh tế vượt thời gian.'
    },
    {
        baseId: 'creative_infinite_remix',
        name: '🎲 AI Sáng Tạo Tự Động',
        tagline: 'AI tự động phối phụ kiện, chọn ảnh Hero & đổi bố cục ngẫu nhiên',
        idealSlots: 4,
        slotLabels: ['AI tự gán Hero', 'AI tự gán Phụ 1', 'AI tự gán Phụ 2', 'AI tự gán Phụ 3'],
        badge: 'AI REMIX',
        color: '#8b5cf6',
        category: 'ky_yeu' as PosterCategory,
        description: 'Nút bấm ma thuật: Mỗi lần bấm, AI tự động quét nhận diện ảnh toàn thân làm Hero, tự phối cành hoa, ruy băng, dải phim, tạo ra bản phối độc nhất vô nhị!'
    }
];

// Generate 32 template entries (16 themes x 2 ratios: 9:16 and 16:9)
export const POSTER_TEMPLATES: PosterTemplateMeta[] = [];

for (const t of CREATIVE_THEMES_CONFIG) {
    // 9:16 Entry
    POSTER_TEMPLATES.push({
        id: t.baseId,
        category: t.category,
        aspectRatio: '9:16',
        name: t.name,
        tagline: t.tagline,
        recommendedImages: `${t.idealSlots} ảnh (${t.idealSlots - 1}-${t.idealSlots + 1})`,
        idealSlots: t.idealSlots,
        slotLabels: t.slotLabels,
        badge: `${t.badge} 9:16`,
        color: t.color,
        description: `${t.description} (Tối ưu chuẩn khổ dọc 9:16 cho điện thoại, Story, Reels, TikTok)`
    });

    // 16:9 Entry (with matching baseId)
    POSTER_TEMPLATES.push({
        id: t.baseId,
        category: t.category,
        aspectRatio: '16:9',
        name: `${t.name} (16:9)`,
        tagline: t.tagline,
        recommendedImages: `${t.idealSlots} ảnh`,
        idealSlots: t.idealSlots,
        slotLabels: t.slotLabels,
        badge: `${t.badge} 16:9`,
        color: t.color,
        description: `${t.description} (Tối ưu chuẩn khổ ngang 16:9 đại cảnh cho màn hình máy tính, Smart TV lớp học)`
    });
}

// =============================================================================
// VECTOR ASSETS & GRAPHICS DRAWING HELPERS
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

/**
 * Draw Realistic Royal Poinciana Blossom Branch (Hoa Phượng Vĩ)
 */
function drawPoincianaBranch(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number = 1,
    angle: number = 0,
    mirror: boolean = false
) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (mirror) ctx.scale(-scale, scale);
    else ctx.scale(scale, scale);

    // Main Branch Stem
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-60, -20);
    ctx.bezierCurveTo(40, 20, 120, 40, 260, 30);
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(80, 25);
    ctx.bezierCurveTo(140, 60, 190, 80, 230, 110);
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();

    // Bipinnate Green Leaves
    const leafClusters = [
        { cx: 30, cy: 0, rot: -0.3 },
        { cx: 90, cy: 15, rot: 0.2 },
        { cx: 160, cy: 25, rot: -0.1 },
        { cx: 130, cy: 50, rot: 0.4 },
        { cx: 200, cy: 80, rot: 0.5 },
        { cx: 230, cy: 25, rot: -0.2 }
    ];

    leafClusters.forEach(lc => {
        ctx.save();
        ctx.translate(lc.cx, lc.cy);
        ctx.rotate(lc.rot);
        ctx.fillStyle = '#15803d';
        for (let i = 0; i < 7; i++) {
            ctx.beginPath();
            ctx.ellipse(i * 12 - 36, -6, 5, 12, 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(i * 12 - 36, 6, 5, 12, -0.4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    });

    // Brilliant Scarlet Poinciana Flowers
    const flowers = [
        { fx: 60, fy: 35, s: 1.1, rot: 0.2 },
        { fx: 120, fy: 45, s: 1.3, rot: -0.1 },
        { fx: 180, fy: 50, s: 1.0, rot: 0.3 },
        { fx: 160, fy: 95, s: 0.9, rot: 0.5 },
        { fx: 220, fy: 100, s: 0.8, rot: -0.2 },
        { fx: 240, fy: 35, s: 0.7, rot: 0.1 }
    ];

    flowers.forEach(fl => {
        ctx.save();
        ctx.translate(fl.fx, fl.fy);
        ctx.rotate(fl.rot);
        ctx.scale(fl.s, fl.s);
        ctx.shadowColor = 'rgba(185, 28, 28, 0.4)';
        ctx.shadowBlur = 10;

        // 5 Petals
        for (let p = 0; p < 5; p++) {
            ctx.save();
            ctx.rotate((p * Math.PI * 2) / 5);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-18, -35, 18, -35, 0, 0);
            // One banner petal has white/gold streaks
            if (p === 0) {
                const g = ctx.createLinearGradient(0, -35, 0, 0);
                g.addColorStop(0, '#fef08a');
                g.addColorStop(0.4, '#f87171');
                g.addColorStop(1, '#dc2626');
                ctx.fillStyle = g;
            } else {
                ctx.fillStyle = '#dc2626';
            }
            ctx.fill();
            ctx.restore();
        }

        // Center Stamens
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        for (let st = 0; st < 6; st++) {
            ctx.save();
            ctx.rotate((st * Math.PI * 2) / 6);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -18);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, -20, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#b91c1c';
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    });

    ctx.restore();
}

/**
 * Draw Curved Satin Red Silk Ribbon Banner (Ruy Băng Đỏ Thướt Tha)
 */
function drawSilkRibbon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    subText: string = ''
) {
    ctx.save();
    ctx.translate(x, y);

    // Drop Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;

    // Curved Ribbon Body
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#7f1d1d');
    g.addColorStop(0.2, '#b91c1c');
    g.addColorStop(0.5, '#dc2626');
    g.addColorStop(0.8, '#b91c1c');
    g.addColorStop(1, '#7f1d1d');

    ctx.beginPath();
    ctx.moveTo(0, h * 0.4);
    ctx.bezierCurveTo(w * 0.25, 0, w * 0.75, h * 0.7, w, h * 0.3);
    ctx.lineTo(w, h * 0.85);
    ctx.bezierCurveTo(w * 0.75, h * 1.15, w * 0.25, h * 0.45, 0, h * 0.85);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();

    // Gold Border Trim
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Calligraphy Text on Ribbon
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 700 78px "Dancing Script", Georgia, cursive';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 8;
    ctx.fillText(text, w / 2, h * 0.58);

    if (subText) {
        ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#fef08a';
        ctx.fillText(subText, w / 2, h * 0.88);
    }
    ctx.restore();

    ctx.restore();
}

/**
 * Draw Vinyl Record Disc (Đĩa Than Nhựa Đen)
 */
function drawVinylDisc(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    labelTitle: string = 'MUSIC',
    labelSub: string = 'STUDIO'
) {
    ctx.save();
    ctx.translate(cx, cy);

    // Disc Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;

    // Black Vinyl Body
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Concentric Grooves Reflection
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.2;
    for (let r = radius * 0.45; r < radius * 0.95; r += 7) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Specular Light Sheen (Two conic highlights)
    const gLight = ctx.createLinearGradient(-radius, -radius, radius, radius);
    gLight.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    gLight.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    gLight.addColorStop(1, 'rgba(255, 255, 255, 0.12)');
    ctx.fillStyle = gLight;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Center Paper Label
    const lr = radius * 0.38;
    ctx.beginPath();
    ctx.arc(0, 0, lr, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label Text
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 24px "Oswald", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelTitle, 0, -12);
    ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(labelSub, 0, 14);
    ctx.restore();

    // Center Spindle Hole
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
}

/**
 * Draw Vintage Cassette Tape (Băng Cassette Cổ Điển)
 */
function drawCassette(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
) {
    ctx.save();
    ctx.translate(x, y);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;

    // Body
    roundRect(ctx, 0, 0, w, h, 10);
    ctx.fillStyle = '#fafaf9';
    ctx.fill();
    ctx.strokeStyle = '#e7e5e4';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.shadowColor = 'transparent';
    const lp = 12;
    roundRect(ctx, lp, lp, w - 2 * lp, h - 2 * lp, 6);
    ctx.fillStyle = '#fee2e2';
    ctx.fill();

    // Tape Window Center
    const ww = w * 0.55;
    const wh = h * 0.4;
    const wx = (w - ww) / 2;
    const wy = (h - wh) / 2 + 5;
    roundRect(ctx, wx, wy, ww, wh, 6);
    ctx.fillStyle = '#44403c';
    ctx.fill();

    // Two Sprocket Holes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(wx + ww * 0.28, wy + wh * 0.5, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(wx + ww * 0.72, wy + wh * 0.5, 12, 0, Math.PI * 2);
    ctx.fill();

    // Heart doodle
    ctx.font = '700 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('❤️', w / 2, wy + wh * 0.5 + 8);

    ctx.restore();
}

/**
 * Draw Metallic Paperclip (Ghim Kẹp Giấy Kim Loại Vàng/Bạc)
 */
function drawPaperClipVector(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number = 1,
    angle: number = 0,
    color: string = '#facc15'
) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(0, 45);
    ctx.lineTo(0, -35);
    ctx.arcTo(0, -50, 16, -50, 16);
    ctx.lineTo(16, 40);
    ctx.arcTo(16, 52, 2, 52, 12);
    ctx.lineTo(2, -20);
    ctx.arcTo(2, -32, 10, -32, 8);
    ctx.lineTo(10, 30);
    ctx.stroke();

    ctx.restore();
}

/**
 * Draw Torn Paper Sticker Badge (Nhãn Giấy Xé Rách Chữ Nổi)
 */
function drawTornStickerBadge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    text1: string,
    text2: string
) {
    ctx.save();
    ctx.translate(x, y);

    // Layer 1: White/Cream Torn Paper Top
    drawDeckleEdgeCard(ctx, 0, 0, w, h * 0.55, '#fefce8');
    ctx.save();
    ctx.font = 'italic 700 38px "Dancing Script", cursive';
    ctx.fillStyle = '#1e3a8a';
    ctx.textAlign = 'center';
    ctx.fillText(text1, w / 2, h * 0.38);
    ctx.restore();

    // Layer 2: Red Brush Stroke Ribbon Bottom
    const bY = h * 0.42;
    const bH = h * 0.58;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    drawDeckleEdgeCard(ctx, 15, bY, w - 30, bH, '#dc2626');
    ctx.font = 'italic 700 48px "Dancing Script", cursive';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(text2, w / 2, bY + bH * 0.65);
    ctx.restore();

    ctx.restore();
}

/**
 * Draw Acoustic Guitar Illustration
 */
function drawGuitarVector(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number = 1,
    angle: number = 0
) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;

    // Body (Figure 8)
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.ellipse(0, 60, 48, 55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, -10, 36, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Soundhole
    ctx.beginPath();
    ctx.arc(0, 10, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();

    // Neck & Headstock
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-6, -110, 12, 100);
    roundRect(ctx, -10, -145, 20, 35, 4);
    ctx.fill();

    ctx.restore();
}

/**
 * Draw DJ Headphones Illustration
 */
function drawHeadphonesVector(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number = 1,
    angle: number = 0,
    color: string = '#eab308'
) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;

    // Headband Arch
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 45, Math.PI, 0);
    ctx.stroke();

    // Earcups
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, -56, -8, 20, 40, 8);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    roundRect(ctx, 36, -8, 20, 40, 8);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

/**
 * Draw Golden Pill Hotline Badge (Khung Hotline Mạ Vàng)
 */
function drawHotlineGoldPill(
    ctx: CanvasRenderingContext2D,
    hotline: string,
    x: number,
    y: number,
    w: number,
    h: number
) {
    ctx.save();
    ctx.translate(x, y);

    // Pill Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;

    // Body
    roundRect(ctx, 0, 0, w, h, h / 2);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#533116');
    g.addColorStop(0.5, '#784c25');
    g.addColorStop(1, '#3b200b');
    ctx.fillStyle = g;
    ctx.fill();

    // Gold Trim
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Phone Icon & Text
    ctx.save();
    ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`📞  Hotline: ${hotline}`, w / 2, h / 2 + 2);
    ctx.restore();

    ctx.restore();
}

/**
 * Draw 3D Winding Curved Film Ribbon (Dải Phim 35mm Uốn Lượn 3D)
 */
function drawWindingFilmRibbon(
    ctx: CanvasRenderingContext2D,
    photos: HTMLImageElement[],
    facesList: FaceBox[][],
    is916: boolean,
    designW: number,
    designH: number,
    biasY: number = 0.3
) {
    ctx.save();

    if (is916) {
        // Vertical S-Curve Ribbon (4 frames)
        const filmH = 1550;
        const filmY = 480;

        ctx.translate(0, filmY);
        ctx.rotate(-0.03);

        // Ribbon Body
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 32;
        ctx.shadowOffsetY = 16;
        roundRect(ctx, 50, 0, designW - 100, filmH, 24);
        ctx.fillStyle = '#1e3a8a';
        ctx.fill();

        // Sprocket Holes along left and right
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#ffffff';
        for (let y = 30; y < filmH - 30; y += 46) {
            roundRect(ctx, 68, y, 22, 30, 6);
            ctx.fill();
            roundRect(ctx, designW - 90, y, 22, 30, 6);
            ctx.fill();
        }

        // 4 Photos inside ribbon
        const frameW = designW - 240;
        const frameH = 320;
        const gap = 34;
        for (let i = 0; i < 4; i++) {
            const fy = 50 + i * (frameH + gap);
            drawCoverImage(ctx, photos[i % photos.length], 120, fy, frameW, frameH, 12, facesList[i % facesList.length], biasY);
        }
    } else {
        // Horizontal Wave Ribbon (4 frames)
        const filmW = designW - 120;
        const filmH = 920;
        const filmY = 220;

        ctx.translate(60, filmY);
        ctx.rotate(-0.02);

        // Ribbon Body
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 32;
        ctx.shadowOffsetY = 16;
        roundRect(ctx, 0, 0, filmW, filmH, 24);
        ctx.fillStyle = '#1e3a8a';
        ctx.fill();

        // Sprockets top and bottom
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#ffffff';
        for (let x = 30; x < filmW - 30; x += 48) {
            roundRect(ctx, x, 20, 30, 22, 5);
            ctx.fill();
            roundRect(ctx, x, filmH - 42, 30, 22, 5);
            ctx.fill();
        }

        // 4 Photos along horizontal ribbon
        const frameW = (filmW - 180) / 4;
        const frameH = filmH - 140;
        for (let i = 0; i < 4; i++) {
            const fx = 30 + i * (frameW + 20);
            drawCoverImage(ctx, photos[i % photos.length], fx, 70, frameW, frameH, 12, facesList[i % facesList.length], biasY);
        }
    }

    ctx.restore();
}

/**
 * Draw Polaroid Photo Card with Shadow & Tape
 */
function drawPolaroidCard(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    rot: number = 0,
    faces?: FaceBox[],
    biasY: number = 0.3,
    tapeColor: string = 'rgba(253, 224, 71, 0.75)',
    hasPin: boolean = false
) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rot);
    ctx.translate(-(x + w / 2), -(y + h / 2));

    // Polaroid Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;

    // White Cardboard
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Photo inside
    ctx.shadowColor = 'transparent';
    const pad = 16;
    const botMargin = 60;
    drawCoverImage(ctx, img, x + pad, y + pad, w - 2 * pad, h - 2 * pad - botMargin, 4, faces, biasY);

    // Optional Washi Tape Top
    if (tapeColor) {
        ctx.fillStyle = tapeColor;
        ctx.fillRect(x + w / 2 - 55, y - 12, 110, 26);
    }

    // Optional Paperclip
    if (hasPin) {
        drawPaperClipVector(ctx, x + 24, y + 10, 0.7, 0.2);
    }

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

    // Find best hero photo (prefer full-body / portrait with detected faces)
    let heroIdx = 0;
    for (let i = 0; i < loadedImages.length; i++) {
        const im = loadedImages[i];
        if (im.height >= im.width * 1.1) {
            heroIdx = i;
            break;
        }
    }

    // Determine Canvas Base Dimensions strictly according to ratio
    const is916 = options.aspectRatio === '9:16' || (!options.aspectRatio && !options.templateId.includes('169'));
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
    const concept = options.conceptName?.trim() || 'Sinh viên';
    const studio = options.studioName?.trim() || 'Music Studio';
    const slogan = options.slogan?.trim() || 'TOP 10 KỶ YẾU CÓ TÂM';
    const hotline = options.hotline?.trim() || '0342 733 640';
    const yearTag = options.yearTag?.trim() || 'Kỉ niệm 2026';
    const quoteText = options.quoteText?.trim() || 'Điều đẹp đẽ không phải tuổi thanh xuân, mà là trong tuổi thanh xuân đó có họ.';
    const movieTitle = options.movieTitle?.trim() || 'TÌNH YÊU ANH DÀNH CHO EM';
    const movieSubtitle = options.movieSubtitle?.trim() || 'One Of A Kind Romance';
    const actors = options.actors?.trim() || 'TUẤN ANH  ✕  THU TRANG';

    // Normalize style ID
    const styleId = normalizeToCreativeStyle(options.templateId);

    // Default clean warm ivory background
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, designW, designH);

    // =========================================================================
    // 16 HIGH-END MULTI-LAYER CREATIVE RENDERING ENGINES
    // =========================================================================

    if (styleId === 'creative_thanh_xuan_hoa_phuong') {
        // --- THEME 1: THANH XUÂN HOA PHƯỢNG (ẢNH 1 & 5) ---
        if (is916) {
            // 9:16 Dọc
            // Hero Photo taking 65% width on the right
            const heroW = 900;
            const heroX = designW - heroW;
            drawCoverImage(ctx, getImg(heroIdx), heroX, 100, heroW, designH - 100, 0, getFaces(heroIdx), biasY);

            // Left side gradient backdrop
            const leftG = ctx.createLinearGradient(0, 0, 600, 0);
            leftG.addColorStop(0, '#fdfbf7');
            leftG.addColorStop(0.8, '#fdfbf7');
            leftG.addColorStop(1, 'rgba(253, 251, 247, 0)');
            ctx.fillStyle = leftG;
            ctx.fillRect(0, 0, 750, designH);

            // Top-Left Typography: "Music Studio" & "Kỉ niệm 2026 Sinh viên"
            ctx.save();
            ctx.font = 'italic 700 86px "Playfair Display", Georgia, serif';
            ctx.fillStyle = '#451a03';
            ctx.fillText(studio, 90, 200);

            ctx.font = '600 32px "Playfair Display", Georgia, serif';
            ctx.fillStyle = '#78350f';
            ctx.fillText(`— ${yearTag} —`, 90, 260);

            ctx.font = 'italic 700 110px "Dancing Script", cursive';
            ctx.fillStyle = '#b45309';
            ctx.fillText(concept, 90, 360);
            ctx.restore();

            // 2 Floating Polaroid Cards on Bottom-Left
            drawPolaroidCard(ctx, getImg(heroIdx + 1), 60, 950, 420, 500, -0.06, getFaces(heroIdx + 1), biasY, 'rgba(253, 224, 71, 0.85)', true);
            drawPolaroidCard(ctx, getImg(heroIdx + 2), 90, 1500, 440, 520, 0.05, getFaces(heroIdx + 2), biasY, 'rgba(253, 224, 71, 0.85)', false);

            // Royal Poinciana Blossoms framing Top
            drawPoincianaBranch(ctx, 450, -40, 1.4, 0.1, false);

            // Red Silk Ribbon Banner Bottom
            drawSilkRibbon(ctx, 60, designH - 240, designW - 120, 200, concept, `${yearTag}  •  ${studio}`);

            // Golden Hotline Pill Badge
            drawHotlineGoldPill(ctx, hotline, designW - 580, designH - 320, 500, 72);
        } else {
            // 16:9 Ngang Panorama
            const heroW = 1200;
            const heroX = designW - heroW;
            drawCoverImage(ctx, getImg(heroIdx), heroX, 0, heroW, designH, 0, getFaces(heroIdx), biasY);

            // Left side gradient
            const leftG = ctx.createLinearGradient(0, 0, 1100, 0);
            leftG.addColorStop(0, '#fdfbf7');
            leftG.addColorStop(0.7, '#fdfbf7');
            leftG.addColorStop(1, 'rgba(253, 251, 247, 0)');
            ctx.fillStyle = leftG;
            ctx.fillRect(0, 0, 1300, designH);

            // Left Typography
            ctx.save();
            ctx.font = 'italic 700 84px "Playfair Display", Georgia, serif';
            ctx.fillStyle = '#451a03';
            ctx.fillText(studio, 90, 150);
            ctx.font = '600 34px "Playfair Display", Georgia, serif';
            ctx.fillStyle = '#78350f';
            ctx.fillText(`— ${yearTag} —`, 90, 210);
            ctx.font = 'italic 700 120px "Dancing Script", cursive';
            ctx.fillStyle = '#b45309';
            ctx.fillText(concept, 90, 320);
            ctx.restore();

            // 3 Polaroids in Horizontal Layout
            drawPolaroidCard(ctx, getImg(heroIdx + 1), 100, 420, 360, 420, -0.05, getFaces(heroIdx + 1), biasY, 'rgba(253, 224, 71, 0.85)', true);
            drawPolaroidCard(ctx, getImg(heroIdx + 2), 480, 450, 360, 420, 0.04, getFaces(heroIdx + 2), biasY, 'rgba(253, 224, 71, 0.85)', false);
            drawPolaroidCard(ctx, getImg(heroIdx + 3), 850, 400, 360, 420, -0.03, getFaces(heroIdx + 3), biasY, 'rgba(253, 224, 71, 0.85)', true);

            // Blossoms on top edge
            drawPoincianaBranch(ctx, 1100, -30, 1.3, 0.15, false);

            // Red Silk Ribbon across bottom
            drawSilkRibbon(ctx, 80, designH - 220, designW - 160, 190, concept, `${studio}  •  ${yearTag}`);

            // Hotline Pill
            drawHotlineGoldPill(ctx, hotline, designW - 560, designH - 290, 480, 68);
        }
    }
    else if (styleId === 'creative_dai_phim_3d') {
        // --- THEME 2: DẢI PHIM UỐN LƯỢN 3D (ẢNH 2) ---
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, designW, designH);

        // Background subtle school blur
        drawBlurredBackground(ctx, getImg(heroIdx), designW, designH, 16, 'rgba(255, 255, 255, 0.65)', getFaces(heroIdx));

        // Top Header: Headphones doodle + "Music Studio" + Hotline
        ctx.save();
        drawHeadphonesVector(ctx, 120, 80, 0.8, -0.15, '#0284c7');
        ctx.font = 'italic 700 78px "Dancing Script", cursive';
        ctx.fillStyle = '#1e3a8a';
        ctx.fillText(studio, 180, 100);
        ctx.restore();

        drawHotlineGoldPill(ctx, hotline, 100, 135, 420, 56);

        // 3D Curved Film Ribbon holding 4 photos
        const photos = [getImg(0), getImg(1), getImg(2), getImg(3)];
        const fl = [getFaces(0), getFaces(1), getFaces(2), getFaces(3)];
        drawWindingFilmRibbon(ctx, photos, fl, is916, designW, designH, biasY);

        // Poinciana flowers on top right
        drawPoincianaBranch(ctx, is916 ? designW - 280 : designW - 350, -20, 1.2, 0.1, false);

        // Bottom Torn Paper Sticker Badge: "Kỉ niệm 2026 - Sinh viên"
        const stW = is916 ? 680 : 780;
        const stH = is916 ? 220 : 200;
        const stX = is916 ? designW - stW - 60 : designW - stW - 120;
        const stY = is916 ? designH - stH - 80 : designH - stH - 40;
        drawTornStickerBadge(ctx, stX, stY, stW, stH, yearTag, concept);
    }
    else if (styleId === 'creative_so_tay_dia_than') {
        // --- THEME 3: SỔ TAY GIẤY RÁCH & ĐĨA THAN (ẢNH 3) ---
        // Vintage Kraft Paper Background with burnt edges
        ctx.fillStyle = '#d97706';
        ctx.fillRect(0, 0, designW, designH);

        const pad = is916 ? 45 : 60;
        drawDeckleEdgeCard(ctx, pad, pad, designW - 2 * pad, designH - 2 * pad, '#fafaf9');

        // Top Title & Headphones doodle
        drawHeadphonesVector(ctx, is916 ? 480 : 850, 100, 0.7, -0.2, '#451a03');
        drawOutlinedText(ctx, studio, is916 ? 560 : 920, 115, 'italic 700 72px "Dancing Script", cursive', '#1e3a8a', '#ffffff', 6);
        drawHotlineGoldPill(ctx, hotline, is916 ? 480 : 850, 140, 440, 58);

        // Vinyl Record Disc
        const discR = is916 ? 240 : 260;
        drawVinylDisc(ctx, is916 ? -50 : 80, is916 ? 680 : 450, discR, studio.toUpperCase(), yearTag);

        // Cassette Tape
        drawCassette(ctx, is916 ? 80 : 280, is916 ? designH - 220 : designH - 200, is916 ? 240 : 260, is916 ? 140 : 150);

        // 4 Polaroid Cards arranged across board
        if (is916) {
            drawPolaroidCard(ctx, getImg(0), 120, 240, 480, 540, -0.04, getFaces(0), biasY, 'rgba(253, 224, 71, 0.85)', true);
            drawPolaroidCard(ctx, getImg(1), 680, 260, 520, 560, 0.03, getFaces(1), biasY, 'rgba(253, 224, 71, 0.85)', false);
            drawPolaroidCard(ctx, getImg(2), 680, 880, 540, 600, -0.02, getFaces(2), biasY, 'rgba(253, 224, 71, 0.85)', true);
            drawPolaroidCard(ctx, getImg(3), 110, 980, 480, 540, 0.04, getFaces(3), biasY, 'rgba(253, 224, 71, 0.85)', false);
        } else {
            drawPolaroidCard(ctx, getImg(0), 400, 240, 420, 460, -0.04, getFaces(0), biasY, 'rgba(253, 224, 71, 0.85)', true);
            drawPolaroidCard(ctx, getImg(1), 860, 220, 460, 500, 0.03, getFaces(1), biasY, 'rgba(253, 224, 71, 0.85)', false);
            drawPolaroidCard(ctx, getImg(2), 1360, 240, 440, 480, -0.02, getFaces(2), biasY, 'rgba(253, 224, 71, 0.85)', true);
            drawPolaroidCard(ctx, getImg(3), 1840, 260, 420, 460, 0.04, getFaces(3), biasY, 'rgba(253, 224, 71, 0.85)', false);
        }

        // Paperclip Top Right
        drawPaperClipVector(ctx, is916 ? 1100 : 1750, 240, 1.1, 0.15, '#facc15');

        // Poinciana flowers on top-left and bottom-right
        drawPoincianaBranch(ctx, -20, -20, 1.2, 0.1, false);

        // Bottom Torn Sticker: "Kỉ niệm 2026 - Sinh viên"
        const stW = is916 ? 660 : 700;
        const stH = 210;
        drawTornStickerBadge(ctx, is916 ? designW - stW - 60 : designW - stW - 80, designH - stH - 50, stW, stH, yearTag, concept);
    }
    else if (styleId === 'creative_music_pop_art') {
        // --- THEME 4: MUSIC STUDIO POP-ART (ẢNH 4) ---
        // Vibrant energetic background with dynamic color curves
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(0, 0, designW, designH);

        // Electric Blue Curve Banner
        ctx.save();
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        if (is916) {
            ctx.moveTo(0, 420);
            ctx.bezierCurveTo(designW * 0.4, 320, designW * 0.6, 680, designW, 580);
            ctx.lineTo(designW, 1100);
            ctx.bezierCurveTo(designW * 0.6, 1200, designW * 0.4, 880, 0, 980);
        } else {
            ctx.moveTo(0, 220);
            ctx.bezierCurveTo(designW * 0.3, 160, designW * 0.7, 450, designW, 350);
            ctx.lineTo(designW, 750);
            ctx.bezierCurveTo(designW * 0.7, 850, designW * 0.3, 580, 0, 680);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 3-4 Curved Photo Frames
        if (is916) {
            drawCoverImage(ctx, getImg(0), 80, 120, 680, 600, 36, getFaces(0), biasY);
            drawCoverImage(ctx, getImg(1), 800, 140, 480, 520, 36, getFaces(1), biasY);
            drawCoverImage(ctx, getImg(2), 620, 780, 640, 640, 36, getFaces(2), biasY);
            drawCoverImage(ctx, getImg(3), 120, 1380, 580, 560, 36, getFaces(3), biasY);
        } else {
            const fw = (designW - 160) / 4;
            drawCoverImage(ctx, getImg(0), 40, 140, fw, 600, 32, getFaces(0), biasY);
            drawCoverImage(ctx, getImg(1), 60 + fw, 180, fw, 560, 32, getFaces(1), biasY);
            drawCoverImage(ctx, getImg(2), 80 + 2 * fw, 140, fw, 600, 32, getFaces(2), biasY);
            drawCoverImage(ctx, getImg(3), 100 + 3 * fw, 180, fw, 560, 32, getFaces(3), biasY);
        }

        // Acoustic Guitar illustration
        drawGuitarVector(ctx, is916 ? 120 : 180, is916 ? 1150 : 680, is916 ? 1.2 : 1.4, 0.25);

        // Vinyl Disc right
        drawVinylDisc(ctx, is916 ? designW - 120 : designW - 200, is916 ? 1120 : 750, 160, 'POP', 'ART');

        // DJ Headphones & Logo "Music Studio"
        drawHeadphonesVector(ctx, is916 ? 260 : 540, is916 ? 940 : 520, 1.2, -0.2, '#facc15');
        drawOutlinedText(ctx, studio, is916 ? 280 : 560, is916 ? 980 : 560, '900 88px "Oswald", sans-serif', '#ffffff', '#1e3a8a', 14);

        // Yellow ribbon hotline
        drawHotlineGoldPill(ctx, hotline, is916 ? 100 : 160, is916 ? designH - 180 : designH - 120, 480, 64);

        // Torn Sticker Badge: "Kỉ niệm 2026 - Sinh viên"
        drawTornStickerBadge(ctx, is916 ? 260 : designW - 740, is916 ? designH - 420 : designH - 260, 620, 190, yearTag, concept);
    }
    else if (styleId === 'creative_kdrama_lensflare') {
        // --- THEME 5: K-DRAMA NGƯỢC NẮNG (LENS FLARE & WIDESCREEN) ---
        drawCoverImage(ctx, getImg(heroIdx), 0, 0, designW, designH, 0, getFaces(heroIdx), biasY);

        // Anamorphic Blue Streak Lens Flare
        const flareY = is916 ? 1050 : 620;
        const gFlare = ctx.createLinearGradient(0, flareY - 40, 0, flareY + 40);
        gFlare.addColorStop(0, 'rgba(56, 189, 248, 0)');
        gFlare.addColorStop(0.5, 'rgba(56, 189, 248, 0.45)');
        gFlare.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = gFlare;
        ctx.fillRect(0, flareY - 40, designW, 80);

        // Dark Vignette Bottom
        const botG = ctx.createLinearGradient(0, designH - 650, 0, designH);
        botG.addColorStop(0, 'rgba(15, 23, 42, 0)');
        botG.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
        ctx.fillStyle = botG;
        ctx.fillRect(0, designH - 650, designW, 650);

        // Title behind/on character
        drawOutlinedText(ctx, movieTitle, designW / 2, designH - 280, '900 84px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.7)', 12, 'center');
        drawOutlinedText(ctx, movieSubtitle, designW / 2, designH - 200, 'italic 700 48px "Dancing Script", cursive', '#fef08a', 'rgba(0,0,0,0.6)', 8, 'center');

        // Actors line
        ctx.save();
        ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.textAlign = 'center';
        ctx.fillText(actors.toUpperCase(), designW / 2, designH - 120);
        ctx.restore();
    }
    else if (styleId === 'creative_wong_kar_wai') {
        // --- THEME 6: HỒNG KÔNG 1990S VƯƠNG GIA VỆ ---
        drawCoverImage(ctx, getImg(heroIdx), 0, 0, designW, designH, 0, getFaces(heroIdx), biasY);

        // Amber & Emerald Noir Overlay
        const gNoir = ctx.createLinearGradient(0, 0, designW, designH);
        gNoir.addColorStop(0, 'rgba(180, 83, 9, 0.2)');
        gNoir.addColorStop(0.5, 'rgba(15, 23, 42, 0.35)');
        gNoir.addColorStop(1, 'rgba(6, 78, 59, 0.45)');
        ctx.fillStyle = gNoir;
        ctx.fillRect(0, 0, designW, designH);

        // Letterbox bars
        const barH = is916 ? 160 : 90;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, designW, barH);
        ctx.fillRect(0, designH - barH, designW, barH);

        // Red Postal cancellation stamp
        ctx.save();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(is916 ? 140 : 180, is916 ? 260 : 160, 60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = '700 20px monospace';
        ctx.fillStyle = '#dc2626';
        ctx.textAlign = 'center';
        ctx.fillText('1997.07.01', is916 ? 140 : 180, is916 ? 266 : 166);
        ctx.restore();

        // Bilingual Poetic Title
        drawOutlinedText(ctx, movieTitle, designW / 2, designH - barH - 80, '900 78px "Playfair Display", serif', '#fef08a', '#000000', 12, 'center');
        drawOutlinedText(ctx, `“${quoteText.slice(0, 45)}...”`, designW / 2, designH - barH - 25, 'italic 600 28px "Playfair Display", serif', '#ffffff', '#000000', 6, 'center');
    }
    else if (styleId === 'creative_ott_movie_billing') {
        // --- THEME 7: POSTER PHIM RẠP OTT & BILLING BLOCK ---
        drawCoverImage(ctx, getImg(heroIdx), 0, 0, designW, designH, 0, getFaces(heroIdx), biasY);
        drawSoapBubbles(ctx, designW, designH);

        // Dark gradient bottom
        const botG = ctx.createLinearGradient(0, designH - 750, 0, designH);
        botG.addColorStop(0, 'rgba(0, 0, 0, 0)');
        botG.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
        ctx.fillStyle = botG;
        ctx.fillRect(0, designH - 750, designW, 750);

        // Main Title
        drawOutlinedText(ctx, movieTitle, designW / 2, designH - 340, '900 84px "Playfair Display", serif', '#ffffff', 'rgba(0,0,0,0.8)', 12, 'center');

        // Billing Block Credit Roll
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.letterSpacing = '4px';
        ctx.fillText(`DIRECTED BY ${studio.toUpperCase()}  •  STARRING ${actors.toUpperCase()}`, designW / 2, designH - 240);
        ctx.fillText(`SOUNDTRACK COMPOSER  •  CINEMATOGRAPHY  •  ALL RIGHTS RESERVED`, designW / 2, designH - 210);
        ctx.restore();

        drawHotlineGoldPill(ctx, hotline, designW / 2 - 220, designH - 120, 440, 62);
    }
    else if (styleId === 'creative_dong_thoai_double_exposure') {
        // --- THEME 8: MV ĐỒNG THOẠI LỒNG HÌNH ---
        ctx.fillStyle = '#e5decf';
        ctx.fillRect(0, 0, designW, designH);

        // Bottom prairie
        const botH = is916 ? 1300 : 850;
        drawCoverImage(ctx, getImg(heroIdx + 1), 0, designH - botH, designW, botH, 0, getFaces(heroIdx + 1), biasY);

        // Top double exposure portrait
        drawFeatheredCoverImage(ctx, getImg(heroIdx), 0, 0, designW, is916 ? 1200 : 750, 0, 300, getFaces(heroIdx), biasY);

        // Sepia tint
        ctx.fillStyle = 'rgba(217, 119, 6, 0.08)';
        ctx.fillRect(0, 0, designW, designH);

        drawOutlinedText(ctx, movieTitle || 'ĐỒNG THOẠI', designW / 2, is916 ? 1120 : 680, '900 68px "Playfair Display", serif', '#ffffff', 'rgba(69,26,3,0.7)', 10, 'center');
        drawOutlinedText(ctx, concept || 'Chung Đôi', designW / 2, is916 ? 1220 : 780, 'italic 700 96px "Dancing Script", cursive', '#ffffff', 'rgba(69,26,3,0.7)', 12, 'center');

        drawHotlineGoldPill(ctx, hotline, designW / 2 - 240, designH - 110, 480, 64);
    }
    else {
        // --- THEMES 9-16 (BỐN MÙA, Y2K, CHALKBOARD, MINIMAL, INFINITE REMIX) ---
        // Adaptive High-Aesthetic Fallback Engine:
        // Automatically selects full-body hero + floating Polaroids + Blossoms/Silk Ribbons
        drawCoverImage(ctx, getImg(heroIdx), is916 ? 300 : 900, 0, is916 ? designW - 300 : designW - 900, designH, 0, getFaces(heroIdx), biasY);

        // Ambient Tint
        const ambG = ctx.createLinearGradient(0, 0, is916 ? 600 : 1200, 0);
        ambG.addColorStop(0, '#fdfbf7');
        ambG.addColorStop(0.8, '#fdfbf7');
        ambG.addColorStop(1, 'rgba(253, 251, 247, 0)');
        ctx.fillStyle = ambG;
        ctx.fillRect(0, 0, is916 ? 750 : 1300, designH);

        // Atmospheric Particles according to theme
        if (styleId.includes('autumn')) {
            drawFireflies(ctx, designW, designH, '#f97316');
        } else if (styleId.includes('winter')) {
            drawFireflies(ctx, designW, designH, '#93c5fd');
        } else {
            drawPoincianaBranch(ctx, is916 ? 500 : 1100, -30, 1.3, 0.1, false);
        }

        // Title Typography
        ctx.save();
        ctx.font = 'italic 700 84px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#451a03';
        ctx.fillText(studio, 90, 160);
        ctx.font = '600 32px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#78350f';
        ctx.fillText(`— ${yearTag} —`, 90, 220);
        ctx.font = 'italic 700 110px "Dancing Script", cursive';
        ctx.fillStyle = '#b45309';
        ctx.fillText(concept, 90, 330);
        ctx.restore();

        // Sub Polaroids
        if (is916) {
            drawPolaroidCard(ctx, getImg(heroIdx + 1), 80, 960, 420, 480, -0.05, getFaces(heroIdx + 1), biasY, 'rgba(253, 224, 71, 0.85)', true);
            drawPolaroidCard(ctx, getImg(heroIdx + 2), 110, 1500, 440, 500, 0.04, getFaces(heroIdx + 2), biasY, 'rgba(253, 224, 71, 0.85)', false);
        } else {
            drawPolaroidCard(ctx, getImg(heroIdx + 1), 100, 440, 360, 420, -0.05, getFaces(heroIdx + 1), biasY, 'rgba(253, 224, 71, 0.85)', true);
            drawPolaroidCard(ctx, getImg(heroIdx + 2), 520, 460, 360, 420, 0.04, getFaces(heroIdx + 2), biasY, 'rgba(253, 224, 71, 0.85)', false);
        }

        // Silk Ribbon & Hotline
        drawSilkRibbon(ctx, 60, designH - 230, designW - 120, 190, concept, `${studio}  •  ${yearTag}`);
        drawHotlineGoldPill(ctx, hotline, designW - (is916 ? 560 : 540), designH - (is916 ? 310 : 280), 480, 64);
    }

    return canvas.toDataURL('image/jpeg', 0.95);
}
