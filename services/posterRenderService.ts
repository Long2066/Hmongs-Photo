/**
 * Poster & Catalog Studio Rendering Engine
 * Client-side High-DPI Canvas 2D Graphic Engine
 * Renders 10 distinct studio-grade poster templates with zero API cost and instant speed.
 */

export type PosterTemplateId =
    | 'tnt_wood_classic'
    | 'bff_thanh_xuan'
    | 'bento_catalog_8'
    | 'grid_10_max'
    | 'magazine_vogue'
    | 'polaroid_moodboard'
    | 'cinema_film_strip'
    | 'newspaper_retro'
    | 'wall_gallery_5'
    | 'story_9_16_music';

export interface PosterOptions {
    templateId: PosterTemplateId;
    conceptName: string;
    studioName: string;
    slogan: string;
    hotline: string;
    yearTag: string;
    accentColor: string;
    resolution: 'HD' | '2K';
    cropBiasY?: number;
}

export interface PosterTemplateMeta {
    id: PosterTemplateId;
    name: string;
    tagline: string;
    recommendedImages: string;
    idealSlots: number;
    aspectRatio: '1:1' | '4:3' | '3:4' | '4:5' | '9:16' | '16:10';
    badge: string;
    color: string;
    description: string;
}

export const POSTER_TEMPLATES: PosterTemplateMeta[] = [
    {
        id: 'tnt_wood_classic',
        name: 'TNT Khung Gỗ 3D',
        tagline: 'Chuẩn poster TNT Media mẫu thực tế',
        recommendedImages: '5 ảnh (1-6 ảnh)',
        idealSlots: 5,
        aspectRatio: '1:1',
        badge: 'HOT NHẤT',
        color: '#e11d48',
        description: 'Khung gỗ 3D nổi bật, 3 ô chân dung trên, cụm icon Facebook thả tim/like và hotline studio.'
    },
    {
        id: 'bff_thanh_xuan',
        name: 'Thanh Xuân Blend',
        tagline: 'Phóng sự điện ảnh phong cách BFF Media',
        recommendedImages: '4 ảnh (1-5 ảnh)',
        idealSlots: 4,
        aspectRatio: '4:3',
        badge: 'ĐIỆN ẢNH',
        color: '#0284c7',
        description: '1 ảnh dọc toàn thân bên phải + 3 ảnh ngang xếp tầng bên trái hòa trộn viền mờ mềm mại.'
    },
    {
        id: 'bento_catalog_8',
        name: 'Bento Catalog 8 Ô',
        tagline: 'Lưới Bento hiện đại chuẩn Studio',
        recommendedImages: '8 ảnh (tối đa 8)',
        idealSlots: 8,
        aspectRatio: '1:1',
        badge: 'BENTO GRID',
        color: '#8b5cf6',
        description: '1 ô Hero lớn góc trái cho ảnh tập thể + 7 ô vệ tinh xung quanh, thẻ nhận diện thương hiệu.'
    },
    {
        id: 'grid_10_max',
        name: 'Album Đầy Đủ 10 Ảnh',
        tagline: 'Khoe trọn vẹn cả 10 ảnh tải lên',
        recommendedImages: '10 ảnh (đầy đủ)',
        idealSlots: 10,
        aspectRatio: '4:5',
        badge: 'MAX 10 ẢNH',
        color: '#10b981',
        description: 'Bố cục 3 tầng khoa học (2 ảnh lớn, 3 ảnh vừa, 5 ảnh nhỏ) chuẩn tỉ lệ đăng Facebook & Instagram.'
    },
    {
        id: 'magazine_vogue',
        name: 'Bìa Tạp Chí Vogue',
        tagline: 'Thời trang kỷ yếu High-End Editorial',
        recommendedImages: '3-4 ảnh',
        idealSlots: 4,
        aspectRatio: '3:4',
        badge: 'FASHION',
        color: '#0f172a',
        description: 'Ảnh Hero bìa lớn, typography Vogue Masthead in hoa quyền lực, mã vạch barcode và ảnh hậu trường.'
    },
    {
        id: 'polaroid_moodboard',
        name: 'Bảng Kỷ Niệm Polaroid',
        tagline: 'Góc lưu bút Instax Washi Tape',
        recommendedImages: '5-7 ảnh',
        idealSlots: 6,
        aspectRatio: '1:1',
        badge: 'HOÀI NIỆM',
        color: '#d97706',
        description: 'Các tấm ảnh Polaroid nghiêng nghệ thuật ghim băng dính giấy washi tape trong suốt và bóng đổ 3D.'
    },
    {
        id: 'cinema_film_strip',
        name: 'Cuộn Phim 35mm Điện Ảnh',
        tagline: 'Hoài niệm Kodak Portra 400',
        recommendedImages: '4-6 ảnh',
        idealSlots: 4,
        aspectRatio: '3:4',
        badge: 'VINTAGE FILM',
        color: '#ea580c',
        description: 'Dải phim 35mm màu đen có lỗ răng cưa phim thực tế, số khung 01A/02A và timestamp màu cam.'
    },
    {
        id: 'newspaper_retro',
        name: 'Bản Tin Kỷ Yếu Cổ Điển',
        tagline: 'Trang nhất The Vintage Times 90s',
        recommendedImages: '4-5 ảnh',
        idealSlots: 4,
        aspectRatio: '3:4',
        badge: 'RETRO BÁO CHÍ',
        color: '#78350f',
        description: 'Nền giấy báo ngả vàng retro, tiêu đề báo in cổ điển, đường kẻ đôi và chia cột bài báo thanh lịch.'
    },
    {
        id: 'wall_gallery_5',
        name: 'Bộ 5 Tranh Treo Tường',
        tagline: 'Demo bộ tranh ép gỗ phòng khách/lớp',
        recommendedImages: '5 ảnh',
        idealSlots: 5,
        aspectRatio: '16:10',
        badge: 'TRANH TREO',
        color: '#475569',
        description: 'Bộ 5 bức tranh khung gỗ 3D đối xứng treo trên tường phòng triển lãm, ánh sáng rọi sang trọng.'
    },
    {
        id: 'story_9_16_music',
        name: 'Story 9:16 + Trình Phát Nhạc',
        tagline: 'Chuẩn đăng Reels / TikTok / Story',
        recommendedImages: '3-4 ảnh',
        idealSlots: 4,
        aspectRatio: '9:16',
        badge: 'STORY TREND',
        color: '#ec4899',
        description: 'Khổ dọc 9:16 cho điện thoại, nền blur huyền ảo kèm Widget phát nhạc bài hát thanh xuân sống động.'
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
    cropBiasY: number = 0.3
) {
    ctx.save();
    if (radius > 0) {
        roundRect(ctx, x, y, w, h, radius);
        ctx.clip();
    }

    const imgRatio = img.width / img.height;
    const targetRatio = w / h;
    let sWidth: number, sHeight: number, sx: number, sy: number;

    if (imgRatio > targetRatio) {
        sHeight = img.height;
        sWidth = img.height * targetRatio;
        sx = (img.width - sWidth) / 2;
        sy = 0;
    } else {
        sWidth = img.width;
        sHeight = img.width / targetRatio;
        sx = 0;
        sy = Math.max(0, Math.min(img.height - sHeight, (img.height - sHeight) * cropBiasY));
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
    ctx.restore();
}

function drawBlurredBackground(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number,
    blurPx: number = 28,
    overlayColor: string = 'rgba(15, 23, 42, 0.45)'
) {
    ctx.save();
    try {
        ctx.filter = `blur(${blurPx}px)`;
    } catch {
        // Fallback if ctx.filter not supported
    }
    // Overdraw slightly to avoid transparent blur edges
    const bleed = blurPx * 2;
    drawCoverImage(ctx, img, -bleed, -bleed, w + bleed * 2, h + bleed * 2, 0, 0.4);
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

    const getImg = (index: number) => loadedImages[index % loadedImages.length];

    // Define base design space (designW x designH) per template
    let designW = 2000;
    let designH = 2000;

    switch (options.templateId) {
        case 'bff_thanh_xuan':
            designW = 2200;
            designH = 1650;
            break;
        case 'grid_10_max':
            designW = 2000;
            designH = 2500;
            break;
        case 'magazine_vogue':
        case 'cinema_film_strip':
        case 'newspaper_retro':
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
    const concept = options.conceptName?.trim() || 'Dormitory';
    const studio = options.studioName?.trim() || 'TNT MEDIA';
    const slogan = options.slogan?.trim() || 'TOP 10 KỶ YẾU CÓ TÂM';
    const hotline = options.hotline?.trim() || '094 191 59 68';
    const yearTag = options.yearTag?.trim() || 'kỷ yếu 2025-2026';

    // =========================================================================
    // 1. TNT Khung Gỗ 3D (Mẫu 2 & 3 TNT Media)
    // =========================================================================
    if (options.templateId === 'tnt_wood_classic') {
        drawBlurredBackground(ctx, getImg(0), designW, designH, 30, 'rgba(15, 23, 42, 0.42)');

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

            drawCoverImage(ctx, getImg(i), sx, topY, topW, topH, 32, biasY);

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
        drawCoverImage(ctx, getImg(3), woodX + frameW, botY + frameW, woodW - 2 * frameW, botH - 2 * frameW, 0, biasY);

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

        drawCoverImage(ctx, getImg(4), rSlotX, botY, rSlotW, botH, 32, biasY);

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
        const leftW = 1030;
        const rightW = designW - leftW;
        const slotH = Math.ceil(designH / 3);
        const overlap = 70;

        for (let i = 0; i < 3; i++) {
            const curY = i * slotH;
            drawCoverImage(ctx, getImg(i), 0, curY, leftW, slotH, 0, biasY);

            // Soft blurred vignette blending between rows
            if (i > 0) {
                const gTop = ctx.createLinearGradient(0, curY - overlap, 0, curY + overlap);
                gTop.addColorStop(0, 'rgba(15, 23, 42, 0)');
                gTop.addColorStop(0.5, 'rgba(30, 58, 95, 0.72)');
                gTop.addColorStop(1, 'rgba(15, 23, 42, 0)');
                ctx.fillStyle = gTop;
                ctx.fillRect(0, curY - overlap, leftW, overlap * 2);
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
            'rgba(15, 23, 42, 0.45)',
            10,
            'center'
        );

        // Poetic Quote bottom-left
        ctx.save();
        ctx.textAlign = 'left';
        ctx.font = '600 28px "Playfair Display", Georgia, serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 10;
        ctx.fillText('願這個冬天 你我萬事順遂', 45, designH - 72);
        ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.fillText(`${studio}  •  ${yearTag}`, 45, designH - 36);
        ctx.restore();

        // Right Side: Large Vertical Hero Frame
        drawCoverImage(ctx, getImg(3), leftW, 0, rightW, designH, 0, 0.25);

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

        const pad = 70;
        const gap = 30;
        const col4 = 442.5;
        const wide2 = 915;

        // Top-Left: Big 2x2 Hero
        drawCoverImage(ctx, getImg(0), pad, pad, wide2, wide2, 28, biasY);

        // Top-Right Info Banner + 2 Slots underneath
        const infoX = pad + wide2 + gap;
        ctx.save();
        roundRect(ctx, infoX, pad, wide2, 220, 28);
        ctx.fillStyle = options.accentColor;
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 48px "Oswald", "Plus Jakarta Sans", sans-serif';
        ctx.fillText(concept.toUpperCase(), infoX + 36, pad + 78);
        ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`${studio}  •  ${yearTag}`, infoX + 36, pad + 130);
        ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(`${slogan}  |  Hotline: ${hotline}`, infoX + 36, pad + 178);
        ctx.restore();

        drawCoverImage(ctx, getImg(1), infoX, pad + 250, col4, 665, 26, biasY);
        drawCoverImage(ctx, getImg(2), infoX + col4 + gap, pad + 250, col4, 665, 26, biasY);

        // Middle Row (y = 1015): 2 square + 1 wide
        const r2Y = pad + wide2 + gap;
        drawCoverImage(ctx, getImg(3), pad, r2Y, col4, col4, 26, biasY);
        drawCoverImage(ctx, getImg(4), pad + col4 + gap, r2Y, col4, col4, 26, biasY);
        drawCoverImage(ctx, getImg(5), infoX, r2Y, wide2, col4, 26, biasY);

        // Bottom Row (y = 1487.5): 2 wide
        const r3Y = r2Y + col4 + gap;
        drawCoverImage(ctx, getImg(6), pad, r3Y, wide2, col4, 26, biasY);
        drawCoverImage(ctx, getImg(7), infoX, r3Y, wide2, col4, 26, biasY);
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
        drawCoverImage(ctx, getImg(0), pad, t1Y, t1W, t1H, 22, biasY);
        drawCoverImage(ctx, getImg(1), pad + t1W + gap, t1Y, t1W, t1H, 22, biasY);

        // Tier 2: 3 Medium Photos
        const t2Y = t1Y + t1H + gap;
        const t2W = (designW - 2 * pad - 2 * gap) / 3;
        const t2H = 620;
        for (let i = 0; i < 3; i++) {
            drawCoverImage(ctx, getImg(2 + i), pad + i * (t2W + gap), t2Y, t2W, t2H, 20, biasY);
        }

        // Tier 3: 5 Portrait Slots
        const t3Y = t2Y + t2H + gap;
        const t3W = (designW - 2 * pad - 4 * gap) / 5;
        const t3H = 740;
        for (let i = 0; i < 5; i++) {
            drawCoverImage(ctx, getImg(5 + i), pad + i * (t3W + gap), t3Y, t3W, t3H, 18, biasY);
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
        drawCoverImage(ctx, getImg(0), 0, 0, designW, designH, 0, 0.25);

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
            drawCoverImage(ctx, getImg(1 + i), tx + 8, thumbY + 8, thumbW - 16, thumbH - 16, 12, biasY);
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
            drawCoverImage(ctx, getImg(idx), p.x + pad, p.y + pad, p.w - pad * 2, p.h - pad * 2 - 95, 6, biasY);

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
            drawCoverImage(ctx, getImg(i), innerX, fy, innerW, frameH, 10, biasY);

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
        drawCoverImage(ctx, getImg(0), pad + 25, mainY, mainW, mainH, 0, biasY);

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
            drawCoverImage(ctx, getImg(1 + i), sx, subY, subW, subH, 0, biasY);

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
            drawCoverImage(ctx, getImg(idx), curX + 28, py + 28, sp.w - 56, sp.h - 56, 0, biasY);
            curX += sp.w + gap;
        });
    }

    // =========================================================================
    // 10. Story 9:16 + Trình Phát Nhạc (Reels/TikTok)
    // =========================================================================
    else if (options.templateId === 'story_9_16_music') {
        drawBlurredBackground(ctx, getImg(0), designW, designH, 32, 'rgba(15, 23, 42, 0.55)');

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
        drawCoverImage(ctx, getImg(0), pad, heroY, designW - 2 * pad, heroH, 36, biasY);

        // 2 Sub Photos Row
        const subY = heroY + heroH + 35;
        const subW = (designW - 2 * pad - 30) / 2;
        const subH = 540;
        drawCoverImage(ctx, getImg(1), pad, subY, subW, subH, 28, biasY);
        drawCoverImage(ctx, getImg(2), pad + subW + 30, subY, subW, subH, 28, biasY);

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
        drawCoverImage(ctx, getImg(3), pad + 40, wY + 55, discSize, discSize, discSize / 2, biasY);

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
