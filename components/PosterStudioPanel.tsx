import React, { useState, useEffect } from 'react';
import { ModelSelector } from './ModelSelector';
import {
    PosterOptions,
    PosterTemplateId,
    PosterAspectRatio
} from '../services/posterRenderService';

interface PosterStudioPanelProps {
    onAiGeneratePoster: (prompt: string, aspectRatio: string, branding: any) => void;
    onGeneratePoster?: (options: PosterOptions, batchMode: 'single' | 'top4' | 'all', shuffleSeed: number) => void;
    isLoading: boolean;
    isDisabled: boolean;
    hasInputImage: boolean;
    inputCount: number;
    inputImages?: string[];
    onSwapInputs?: (i: number, j: number) => void;
    onRemoveInput?: (idx: number) => void;
    selectedTemplateId?: PosterTemplateId;
    onTemplateSelect?: (id: PosterTemplateId) => void;
}

const STORAGE_KEY_POSTER_PROMPT = 'imagetool_ai_poster_prompt_v1';
const STORAGE_KEY_POSTER_BRANDING = 'imagetool_ai_poster_branding_v1';
const STORAGE_KEY_POSTER_RATIO = 'imagetool_ai_poster_ratio_v1';

const QUICK_TOPIC_PRESETS = [
    // 1. Kỷ Yếu & Học Đường (10)
    {
        category: 'ky_yeu',
        title: '🎓 Kỉ niệm sinh viên (Music Studio)',
        prompt: 'Poster kỷ yếu sinh viên đại học phong cách Music Studio 2026, cặp đôi rạng rỡ dưới tán hoa phượng vĩ đỏ mùa hè, dải ruy băng lụa đỏ uốn lượn chân trang, 2 ảnh Polaroid nghiêng nghệ thuật, ánh nắng vàng rực rỡ.',
        studio: 'Music Studio',
        concept: 'Sinh viên',
        year: 'Kỉ niệm 2026'
    },
    {
        category: 'ky_yeu',
        title: '🎞️ Dải phim 35mm hoài niệm',
        prompt: 'Poster kỷ yếu dải phim nhựa 35mm uốn lượn 3D ôm quanh các khoảnh khắc tuổi học trò, sticker xé giấy màu đỏ và vàng, doodle tai nghe và máy bay giấy, tone màu retro hoài niệm.',
        studio: 'Music Studio',
        concept: 'Thanh Xuân',
        year: 'Kỉ niệm 2026'
    },
    {
        category: 'ky_yeu',
        title: '📻 Sổ tay giấy rách & Đĩa than',
        prompt: 'Poster phong cách Vintage Scrapbook bìa Kraft xé viền cháy, đĩa than vinyl đen bóng, cuộn băng cassette, kẹp bướm vàng, ảnh Polaroid dán băng dính và nhành hoa phượng.',
        studio: 'Music Studio',
        concept: 'Sinh viên',
        year: 'Kỉ niệm 2026'
    },
    {
        category: 'ky_yeu',
        title: '📝 Bảng đen lớp học lưu bút',
        prompt: 'Poster kỷ yếu nền bảng đen xanh học đường phủ bụi phấn trắng, nét vẽ phấn tay compa thước kẻ ngộ nghĩnh, kẹp gỗ treo ảnh kỷ niệm tuổi học trò và câu lưu bút nghẹn ngào.',
        studio: 'Classmate Memories',
        concept: 'Lưu Bút Tuổi Học Trò',
        year: 'Niên Khóa 2026'
    },
    {
        category: 'ky_yeu',
        title: '🌸 Áo dài trắng sân trường nắng hạ',
        prompt: 'Poster kỷ yếu nữ sinh trong tà áo dài trắng thướt tha dưới hàng phượng vĩ đỏ rực, tia nắng hè xuyên qua kẽ lá lấp lánh, nụ cười thanh xuân rạng ngời.',
        studio: 'Thanh Xuân Art',
        concept: 'Tà Áo Trắng',
        year: 'Hạ 2026'
    },
    {
        category: 'ky_yeu',
        title: '⚽ Sân cỏ thể thao thanh xuân',
        prompt: 'Poster năng động trên sân cỏ trường học, đồng phục thể thao rực rỡ, quả bóng và chai nước khoáng dưới ánh nắng rực rỡ của tuổi trẻ cuồng nhiệt.',
        studio: 'Youth Energy',
        concept: 'Năng Lượng Tuổi Trẻ',
        year: 'Season 2026'
    },
    {
        category: 'ky_yeu',
        title: '📚 Thư viện sách cổ & hoài niệm',
        prompt: 'Poster góc thư viện trường học cổ điển với giá sách gỗ cao vút, ánh nắng chiếu qua ô cửa sổ kính, trang sách mở ra những ước mơ và khoảnh khắc lặng thầm.',
        studio: 'Library Nostalgia',
        concept: 'Trang Sách Thanh Xuân',
        year: 'Kỉ niệm 2026'
    },
    {
        category: 'ky_yeu',
        title: '⛺ Cắm trại dã ngoại cuối khóa',
        prompt: 'Poster kỷ yếu dã ngoại lều trại giữa rừng thông đồi cỏ, đống lửa trại bập bùng, đàn guitar và ánh đèn fairy lights lung linh ấm áp đêm chia tay.',
        studio: 'Campfire Nights',
        concept: 'Chuyến Đi Cuối Cùng',
        year: 'Camp 2026'
    },
    {
        category: 'ky_yeu',
        title: '🎓 Lễ tốt nghiệp cử nhân',
        prompt: 'Poster trang trọng ngày lễ tốt nghiệp cử nhân, áo thụng cử nhân đen viền xanh đỏ, mũ tốt nghiệp tung bay trên nền trời xanh, hoa hướng dương rực rỡ.',
        studio: 'Graduation Day',
        concept: 'Tốt Nghiệp Cử Nhân',
        year: 'Class of 2026'
    },
    {
        category: 'ky_yeu',
        title: '🚲 Xe đạp giỏ hoa phố học trò',
        prompt: 'Poster hoài niệm xe đạp giỏ chở đầy hoa cúc trắng trên con đường rợp bóng cây xanh, tà áo bay nhẹ nhàng trong làn gió sớm.',
        studio: 'Old Days',
        concept: 'Góc Phố Dịu Dàng',
        year: 'Kỉ niệm 2026'
    },

    // 2. Phim Ảnh & Điện Ảnh (10)
    {
        category: 'phim_anh',
        title: '🏮 Phim Cổ trang Trung Hoa kiếm hiệp',
        prompt: 'Poster phim điện ảnh cổ trang Trung Hoa kinh điển, nhân vật kiếm hiệp tiên phong đạo cốt, tà áo lụa là thướt tha bay trong gió, tóc dài buộc cao cài trâm ngọc, bối cảnh cung đình đình đài lầu các sương mờ huyền ảo, ánh sáng điện ảnh chiaroscuro.',
        studio: 'Xianxia Cinema',
        concept: 'Thiên Cổ Quyết Trần',
        year: 'Blockbuster 2026'
    },
    {
        category: 'phim_anh',
        title: '🎬 K-Drama ngược nắng hoàng hôn',
        prompt: 'Poster phim truyền hình K-Drama lãng mạn ngược nắng hoàng hôn ven tóc (Rim light), vệt sáng Anamorphic Flare trải dài, ánh mắt đong đầy cảm xúc và tựa đề phim lồng chìm sau lưng.',
        studio: 'Seoul Drama',
        concept: 'Hẹn Ước Hoàng Hôn',
        year: 'Series 2026'
    },
    {
        category: 'phim_anh',
        title: '🌃 Hồng Kông 90s Vương Gia Vệ',
        prompt: 'Poster phim màu nhựa 35mm Hồng Kông thập niên 90 đạo diễn Vương Gia Vệ, ánh đèn neon đỏ rượu và ngọc lục bảo mờ ảo, hạt phim xước cổ điển, dấu mộc bưu điện và câu thoại song ngữ.',
        studio: 'Wong Kar-Wai Tribute',
        concept: 'Tâm Trạng Khi Yêu',
        year: 'Hong Kong 1995'
    },
    {
        category: 'phim_anh',
        title: '🍿 Poster phim rạp OTT WeTV/VieON',
        prompt: 'Poster phim chiếu rạp đỉnh cao chuẩn cụm rạp CGV/BHD, bokeh ánh đèn đêm lung linh, logo rạp phim và khối chữ Billing Block đạo diễn diễn viên dàn trang quốc tế tinh xảo.',
        studio: 'Cinema Studio',
        concept: 'Tình Yêu Anh Dành Cho Em',
        year: 'Exclusive 2026'
    },
    {
        category: 'phim_anh',
        title: '🕶️ Điệp viên hành động Hollywood',
        prompt: 'Poster phim hành động điệp viên bom tấn Hollywood, tông màu xanh xám lạnh thép, làn khói súng và tia lửa bay, thần thái sắc bén và góc nhìn điện ảnh gay cấn.',
        studio: 'Apex Action',
        concept: 'Nhiệm Vụ Tối Mật',
        year: 'Blockbuster 2026'
    },
    {
        category: 'phim_anh',
        title: '⚡ Cyberpunk Neon tương lai 2077',
        prompt: 'Poster phim Cyberpunk tương lai năm 2077, mưa đêm rơi trên đường phố ngập tràn ánh đèn neon xanh lục lam và hồng cánh sen, hologram phản chiếu và phong cách vị lai.',
        studio: 'Neo Tokyo',
        concept: 'Cyber Horizon',
        year: 'Neo 2077'
    },
    {
        category: 'phim_anh',
        title: '🚀 Khoa học viễn tưởng Interstellar',
        prompt: 'Poster phim khoa học viễn tưởng không gian vũ trụ bao la, dải ngân hà rực rỡ, tinh vân huyền ảo, ánh sáng sao lấp lánh và nhân vật hướng ánh nhìn về chân trời vô tận.',
        studio: 'Cosmic Studio',
        concept: 'Chân Trời Vũ Trụ',
        year: 'Sci-Fi 2026'
    },
    {
        category: 'phim_anh',
        title: '🕵️ Trinh thám Noir kinh điển',
        prompt: 'Poster phim trinh thám đen trắng Noir cổ điển thập niên 50, bóng đổ sắc nét qua rèm cửa sổ Venice, ánh đèn đường le lói trong màn mưa và chiếc áo măng tô bí ẩn.',
        studio: 'Noir Detective',
        concept: 'Bí Mật Đêm Thành Phố',
        year: 'Classic Film'
    },
    {
        category: 'phim_anh',
        title: '🍃 Hoạt hình Ghibli đồi cỏ xanh',
        prompt: 'Poster phong cách hoạt hình anime Hayao Miyazaki Ghibli, thảo nguyên xanh ngát mênh mông, những đám mây trắng bồng bềnh khổng lồ trên nền trời xanh ngọc bích.',
        studio: 'Ghibli Fantasy',
        concept: 'Lâu Đài Trên Đồi Cỏ',
        year: 'Animation 2026'
    },
    {
        category: 'phim_anh',
        title: '☄️ Anime Makoto Shinkai rực rỡ',
        prompt: 'Poster anime phong cách Makoto Shinkai, sao băng rực sáng xé toạc bầu trời chạng vạng hoàng hôn tím biếc, giọt nước phản chiếu ánh sáng kỳ ảo và cảm xúc nghẹn ngào.',
        studio: 'Shinkai Magic',
        concept: 'Khu Vườn Ngôn Từ',
        year: 'Anime 2026'
    },

    // 3. Cưới & Tình Yêu (8)
    {
        category: 'cuoi',
        title: '💍 Ngày cưới (Wedding Save The Date)',
        prompt: 'Poster ảnh cưới lãng mạn phong cách K-Drama sang trọng, cặp đôi trong trang phục cưới thanh lịch, ánh hoàng hôn ngược nắng ven tóc vàng óng, hoa baby trắng, vệt sáng lóa điện ảnh và chữ Save The Date.',
        studio: 'Wedding Art',
        concept: 'Save The Date',
        year: 'Happy Wedding 2026'
    },
    {
        category: 'cuoi',
        title: '🌅 Hoàng hôn bãi biển lãng mạn',
        prompt: 'Poster ảnh cưới bờ biển lúc hoàng hôn buông xuống, sóng biển vỗ nhẹ bờ cát mịn màng, dải váy cưới trắng bay bổng trong gió và ánh nắng chiều nhuộm vàng đôi uyên ương.',
        studio: 'Seaside Romance',
        concept: 'Bản Tình Ca Biển',
        year: 'Wedding 2026'
    },
    {
        category: 'cuoi',
        title: '🏰 Lâu đài cổ tích châu Âu Paris',
        prompt: 'Poster ảnh cưới tráng lệ trước kiến trúc lâu đài cổ điển phong cách Pháp, xe hoa vintage sang trọng, hoa hồng nhung đỏ và ánh đèn vàng quý phái.',
        studio: 'Paris Wedding',
        concept: 'Tình Yêu Paris',
        year: 'Elegance 2026'
    },
    {
        category: 'cuoi',
        title: '🌿 Tiệc cưới tối giản Scandinavian',
        prompt: 'Poster ngày cưới phong cách tối giản Bắc Âu, nền trắng ngà thanh khiết, cành lá khuynh diệp xanh mát, font chữ serif mảnh mai sang trọng vượt thời gian.',
        studio: 'Nordic Minimal',
        concept: 'Hôn Lễ Tinh Khôi',
        year: 'Simple Love 2026'
    },
    {
        category: 'cuoi',
        title: '🌾 Hôn lễ Rustic đồng quê vintage',
        prompt: 'Poster tiệc cưới phong cách Rustic đồng quê mộc mạc, rơm vàng, hoa cỏ dại, đèn dây tóc vàng giăng trên vòm gỗ và nụ cười rạng ngời hạnh phúc.',
        studio: 'Rustic Romance',
        concept: 'Mộc Mạc Yêu Thương',
        year: 'Forever 2026'
    },
    {
        category: 'cuoi',
        title: '🌌 Lễ cưới dưới bầu trời sao',
        prompt: 'Poster đôi lứa trao nhau lời thề nguyện dưới bầu trời đêm ngàn sao lấp lánh, pháo bông que lung linh trong tay và không gian cổ tích huyền ảo.',
        studio: 'Starlight Wedding',
        concept: 'Ngàn Sao Chứng Giám',
        year: 'Love 2026'
    },
    {
        category: 'cuoi',
        title: '📸 Nhật ký tình yêu Polaroid',
        prompt: 'Poster tập hợp những tấm ảnh Polaroid ghi lại hành trình tình yêu chân thật, băng keo trong suốt dán nhẹ, những dòng ghi chú viết tay ngọt ngào.',
        studio: 'Love Diary',
        concept: 'Nhật Ký Đôi Ta',
        year: 'Story 2026'
    },
    {
        category: 'cuoi',
        title: '🧧 Hỷ sự cổ phong phượng hoàng',
        prompt: 'Poster ngày hỷ phong cách cổ phong Trung Hoa, hỷ phục đỏ rực thêu rồng phượng kim tuyến lộng lẫy, trâm cài phượng hoàng ngọc bích và chữ Hỷ son đỏ truyền thống.',
        studio: 'Heritage Wedding',
        concept: 'Trăm Năm Hạnh Ngộ',
        year: 'Cát Tường 2026'
    },

    // 4. Âm Nhạc, Nghệ Thuật & Tạp Chí (8)
    {
        category: 'am_nhac',
        title: '👑 Bìa tạp chí thời trang Vogue',
        prompt: 'Poster bìa tạp chí thời trang cao cấp Vogue High-Fashion, nhân vật chính tạo dáng thần thái cuốn hút, tiêu đề VOGUE in hoa sang trọng, mã vạch barcode và ảnh hậu trường.',
        studio: 'Vogue Studio',
        concept: 'Editorial Special',
        year: 'Special Edition'
    },
    {
        category: 'am_nhac',
        title: '🎸 Pop-Art năng động & Guitar',
        prompt: 'Poster Pop-Art tuổi trẻ năng động với đàn guitar acoustic, tai nghe DJ, đĩa than vinyl, dải sóng âm thanh và đường lượn sóng vàng-xanh-đỏ rực rỡ.',
        studio: 'Music Studio',
        concept: 'Sinh viên',
        year: 'Kỉ niệm 2026'
    },
    {
        category: 'am_nhac',
        title: '🎵 Đĩa than Vinyl Indie lãng mạn',
        prompt: 'Poster bìa đĩa hát vinyl Indie lãng mạn, đĩa than quay trên bàn máy hát cổ điển, ánh sáng ấm áp của đèn neon phòng thu và giai điệu ký ức dịu êm.',
        studio: 'Indie Records',
        concept: 'Bản Tình Ca Mùa Hạ',
        year: 'Vinyl 2026'
    },
    {
        category: 'am_nhac',
        title: '⚡ Rock & Roll bốc lửa sân khấu',
        prompt: 'Poster liveshow Rock & Roll bốc lửa, khói sân khấu cuồn cuộn, ánh đèn laser đỏ rực xuyên qua bóng dáng ca sĩ cầm micro gào thét đam mê.',
        studio: 'Rock Nation',
        concept: 'Cháy Cùng Đam Mê',
        year: 'Tour 2026'
    },
    {
        category: 'am_nhac',
        title: '🎨 Hip-hop Graffiti đường phố',
        prompt: 'Poster phong cách Hip-hop đường phố với bức tường gạch phủ sơn graffiti sặc sỡ, trang phục áo hoodie oversized cực chất và thần thái Gen Z cá tính.',
        studio: 'Street Vibe',
        concept: 'Chất Riêng Đường Phố',
        year: 'Underground 2026'
    },
    {
        category: 'am_nhac',
        title: '🎻 Hòa nhạc giao hưởng thính phòng',
        prompt: 'Poster đêm hòa nhạc giao hưởng thính phòng tháp đèn chùm pha lê tráng lệ, đàn cello và vĩ cầm tỏa sáng quý phái trong nhà hát hoàng gia.',
        studio: 'Philharmonic Hall',
        concept: 'Bản Giao Hưởng Đêm',
        year: 'Concert 2026'
    },
    {
        category: 'am_nhac',
        title: '☕ Acoustic Cafe hoàng hôn ấm áp',
        prompt: 'Poster đêm nhạc acoustic mộc mạc bên khung cửa sổ quán cafe gỗ, tách trà nóng bốc khói nhẹ và những nốt nhạc guitar sưởi ấm tâm hồn.',
        studio: 'Acoustic Corner',
        concept: 'Giai Điệu Bình Yên',
        year: 'Live Session'
    },
    {
        category: 'am_nhac',
        title: '🎆 Lễ hội âm nhạc EDM sôi động',
        prompt: 'Poster đại nhạc hội EDM ngoài trời hàng chục ngàn khán giả cuồng nhiệt, pháo hoa rực sáng bầu trời đêm, ánh sáng laser 3D ma trận vĩ đại.',
        studio: 'Music Festival',
        concept: 'Đại Nhạc Hội Mùa Hè',
        year: 'Festival 2026'
    },

    // 5. Du Lịch & 4 Mùa (7)
    {
        category: 'du_lich',
        title: '🍂 Mùa thu lá vàng Seoul',
        prompt: 'Poster lãng mạn mùa thu Hàn Quốc với lá phong đỏ và lá ngân hạnh vàng bay bồng bềnh trong gió, tone màu latte ấm áp, cặp đôi quàng khăn len nụ cười hạnh phúc.',
        studio: 'Autumn Romance',
        concept: 'Mùa Thu Yêu Thương',
        year: 'Seoul 2026'
    },
    {
        category: 'du_lich',
        title: '❄️ Mùa đông tuyết trắng Sapporo',
        prompt: 'Poster mùa đông tuyết trắng cổ tích, những hạt tuyết li ti bay mờ ảo, ánh đèn dây tóc fairy lights vàng ấm áp xua tan giá lạnh, cặp đôi ấm áp bên nhau.',
        studio: 'Winter Tale',
        concept: 'Tuyết Đầu Mùa',
        year: 'Winter 2026'
    },
    {
        category: 'du_lich',
        title: '🌸 Mùa xuân hoa anh đào Kyoto',
        prompt: 'Poster mùa xuân rực rỡ dưới hàng cây hoa anh đào sakura nở rộ hồng phấn, cánh hoa bay lượn phấp phới trong làn gió nhẹ bên dòng suối nhỏ trong vắt.',
        studio: 'Kyoto Spring',
        concept: 'Hương Hoa Đầu Mùa',
        year: 'Spring 2026'
    },
    {
        category: 'du_lich',
        title: '🏖️ Mùa hè biển xanh Hawaii',
        prompt: 'Poster du lịch mùa hè biển xanh cát trắng nắng vàng rực rỡ, rặng dừa nghiêng bóng, vỏ ốc sao biển và tấm ảnh Polaroid dán viền trong suốt tràn đầy sức sống.',
        studio: 'Tropical Paradise',
        concept: 'Kỳ Nghỉ Nhiệt Đới',
        year: 'Summer 2026'
    },
    {
        category: 'du_lich',
        title: '🌾 Ruộng bậc thang Mù Cang Chải',
        prompt: 'Poster hùng vĩ non nước Việt Nam trên sóng ruộng bậc thang mùa lúa chín vàng óng như dát vàng trên đồi núi, mây mù ôm ấp đỉnh đèo tráng lệ.',
        studio: 'Vietnam Discovery',
        concept: 'Mùa Vàng Tây Bắc',
        year: 'Travel 2026'
    },
    {
        category: 'du_lich',
        title: '🐪 Sa mạc hoàng hôn huyền bí',
        prompt: 'Poster hoàng hôn trên sa mạc cát vàng mênh mông, ánh mặt trời đỏ rực như hòn lửa từ từ buông xuống đường chân trời và phong cách phiêu lưu tự do.',
        studio: 'Desert Adventure',
        concept: 'Hành Trình Tự Do',
        year: 'Safari 2026'
    },
    {
        category: 'du_lich',
        title: '🌌 Cực quang phương Bắc Iceland',
        prompt: 'Poster kỳ quan cực quang phương Bắc (Aurora Borealis) rực rỡ ánh sáng xanh ngọc bích và tím dạ quang uốn lượn kỳ ảo trên đỉnh núi băng tuyết vĩnh cửu.',
        studio: 'Nordic Lights',
        concept: 'Dạ Vũ Phương Bắc',
        year: 'Arctic 2026'
    },

    // 6. Doanh Nhân, Sự Kiện & Thương Hiệu (7)
    {
        category: 'doanh_nhan',
        title: '💼 Doanh nhân thành đạt Forbes',
        prompt: 'Poster chân dung doanh nhân thành đạt phong cách bìa tạp chí Forbes, vest tuxedo lịch lãm, thần thái tự tin kiên định, ánh sáng studio tạo khối quyền lực.',
        studio: 'Business Leaders',
        concept: 'Nhà Lãnh Đạo Tương Lai',
        year: 'Edition 2026'
    },
    {
        category: 'doanh_nhan',
        title: '💻 Tech Summit hội thảo công nghệ',
        prompt: 'Poster hội nghị thượng đỉnh công nghệ Tech Summit tương lai, mạng lưới vi mạch phát sáng, màn hình cong đa chiều và không gian sáng tạo đột phá.',
        studio: 'Future Tech',
        concept: 'Đột Phá Kỷ Nguyên Số',
        year: 'Summit 2026'
    },
    {
        category: 'doanh_nhan',
        title: '🎖️ Vinh danh nhân vật xuất sắc của năm',
        prompt: 'Poster lễ trao giải và vinh danh nhân vật cống hiến xuất sắc của năm, cúp pha lê mạ vàng lấp lánh, thảm đỏ trang trọng và dải ruy băng vinh quang.',
        studio: 'Excellence Awards',
        concept: 'Vinh Danh Cống Hiến',
        year: 'Gala 2026'
    },
    {
        category: 'doanh_nhan',
        title: '🏆 Giải đấu thể thao vô địch',
        prompt: 'Poster chung kết giải đấu vô địch thể thao đỉnh cao, chiếc cúp vô địch vàng rực dưới pháo sáng giấy bay rực rỡ khắp sân vận động khổng lồ.',
        studio: 'Championship Art',
        concept: 'Đỉnh Vinh Quang',
        year: 'Champion 2026'
    },
    {
        category: 'doanh_nhan',
        title: '🖼️ Triển lãm nghệ thuật đương đại',
        prompt: 'Poster triển lãm mỹ thuật và thiết kế đương đại, bố cục typography bất đối xứng táo bạo, mảng màu trừu tượng và không gian bảo tàng thanh lịch.',
        studio: 'Modern Art Gallery',
        concept: 'Triển Lãm Đương Đại',
        year: 'Exhibition 2026'
    },
    {
        category: 'doanh_nhan',
        title: '💎 Khai trương thương hiệu Grand Opening',
        prompt: 'Poster sự kiện khai trương hồng phát Grand Opening, chùm bóng bay vàng kim sang trọng, dải ruy băng đỏ cắt khánh thành và rượu champagne nổ mừng.',
        studio: 'Grand Opening Art',
        concept: 'Khai Trương Hồng Phát',
        year: 'Welcome 2026'
    },
    {
        category: 'doanh_nhan',
        title: '🌍 Phim tài liệu National Geographic',
        prompt: 'Poster phong cách phim tài liệu khám phá địa lý nhân văn National Geographic, khung viền vàng biểu tượng, màu sắc chân thực sâu sắc và chiều sâu văn hóa.',
        studio: 'Geographic Studio',
        concept: 'Khám Phá Thế Giới',
        year: 'Documentary 2026'
    }
];

export const PosterStudioPanel: React.FC<PosterStudioPanelProps> = ({
    onAiGeneratePoster,
    onGeneratePoster,
    isLoading,
    isDisabled,
    hasInputImage,
    inputCount,
    inputImages = [],
    onSwapInputs,
    onRemoveInput
}) => {
    // 1. Prompt state
    const [prompt, setPrompt] = useState<string>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY_POSTER_PROMPT) || QUICK_TOPIC_PRESETS[0].prompt;
        } catch {
            return QUICK_TOPIC_PRESETS[0].prompt;
        }
    });

    // 2. Aspect Ratio state (9:16 default, 16:9, 1:1)
    const [aspectRatio, setAspectRatio] = useState<string>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY_POSTER_RATIO) || '9:16';
        } catch {
            return '9:16';
        }
    });

    // Category filter for 50 presets
    const [presetCategory, setPresetCategory] = useState<string>('all');

    // 3. Branding text state
    const [branding, setBranding] = useState<{
        studioName: string;
        conceptName: string;
        yearTag: string;
        hotline: string;
    }>(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_POSTER_BRANDING);
            if (raw) return JSON.parse(raw);
        } catch {}
        return {
            studioName: 'Music Studio',
            conceptName: 'Sinh viên',
            yearTag: 'Kỉ niệm 2026',
            hotline: '0342 733 640'
        };
    });

    // Auto-save settings
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_POSTER_PROMPT, prompt);
        } catch {}
    }, [prompt]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_POSTER_RATIO, aspectRatio);
        } catch {}
    }, [aspectRatio]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_POSTER_BRANDING, JSON.stringify(branding));
        } catch {}
    }, [branding]);

    // Handle Quick Chip click
    const handleSelectPreset = (preset: typeof QUICK_TOPIC_PRESETS[0]) => {
        setPrompt(preset.prompt);
        setBranding((prev) => ({
            ...prev,
            studioName: preset.studio,
            conceptName: preset.concept,
            yearTag: preset.year
        }));
    };

    const handleTriggerAiGenerate = () => {
        if (isLoading || isDisabled || !hasInputImage || !prompt.trim()) return;
        onAiGeneratePoster(prompt.trim(), aspectRatio, branding);
    };

    return (
        <div className="flex flex-col gap-5 text-slate-800">
            {/* Header Badge */}
            <div className="bg-gradient-to-r from-violet-50 via-indigo-50 to-purple-50 p-4 rounded-2xl border border-violet-200/90 flex gap-3 shadow-xs ring-1 ring-violet-500/10">
                <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center text-xl flex-shrink-0 shadow-sm shadow-violet-500/25">
                    🎨
                </div>
                <div>
                    <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                        Studio Thiết Kế Poster AI (Generative Model)
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                        AI tự động phân tích ảnh gốc & phối hợp bố cục đa tầng chân thực như ChatGPT (Nhận tối đa 10 ảnh tham chiếu).
                    </p>
                </div>
            </div>

            {/* Model Selector (Y chang các tính năng khác trong tool) */}
            <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Chọn Model Tạo Ảnh AI
                </label>
                <ModelSelector className="" imageCount={1} showResolution={true} />
            </div>

            {/* Input Status Banner (Tối đa 10 ảnh) */}
            <div className="bg-gradient-to-r from-violet-50 to-teal-50 border border-violet-200/90 rounded-xl p-3 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-800">
                        {inputCount > 0 ? (
                            <>
                                Đã nạp <span className="text-violet-700 font-extrabold">{inputCount}</span> ảnh đầu vào (Tối đa 10 ảnh)
                            </>
                        ) : (
                            <>Chưa nạp ảnh đầu vào (Tối đa 10 ảnh)</>
                        )}
                    </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-violet-700 bg-white px-2.5 py-0.5 rounded-md border border-violet-200">
                    {inputCount}/10 Slot
                </span>
            </div>

            {/* Khay Sắp Xếp Ảnh Đầu Vào (Để user biết ảnh nào là #1 Hero) */}
            {inputCount > 0 && (
                <div className="bg-slate-50 p-3 rounded-2xl ring-1 ring-slate-900/5 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🎞️</span>
                            <span>Khay Ảnh Tham Chiếu (Ảnh #1 được ưu tiên làm Hero)</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                        {inputImages.slice(0, 10).map((imgBase64, idx) => (
                            <div
                                key={idx}
                                className="flex-shrink-0 w-20 flex flex-col items-center bg-white p-1 rounded-xl ring-1 ring-slate-900/10 shadow-2xs group relative"
                            >
                                <div className="relative w-full h-16 rounded-lg overflow-hidden bg-slate-100 mb-1">
                                    <img
                                        src={imgBase64.startsWith('data:') ? imgBase64 : `data:image/jpeg;base64,${imgBase64}`}
                                        alt={`Slot ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-slate-900/80 text-white text-[9px] font-mono font-bold flex items-center justify-center rounded">
                                        #{idx + 1}
                                    </span>
                                    {onRemoveInput && (
                                        <button
                                            type="button"
                                            onClick={() => onRemoveInput(idx)}
                                            className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            title="Xóa ảnh này"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                <span className="text-[9px] font-medium text-slate-600 text-center truncate w-full px-0.5 mb-1">
                                    {idx === 0 ? '⭐ Hero Lớn' : `Phụ #${idx + 1}`}
                                </span>
                                {onSwapInputs && (
                                    <div className="flex items-center justify-between w-full px-0.5">
                                        <button
                                            type="button"
                                            disabled={idx === 0}
                                            onClick={() => onSwapInputs(idx, idx - 1)}
                                            className="w-4 h-4 rounded text-[10px] font-bold text-slate-500 hover:text-slate-900 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center bg-slate-100"
                                            title="Đổi sang trái"
                                        >
                                            ←
                                        </button>
                                        <button
                                            type="button"
                                            disabled={idx === inputCount - 1}
                                            onClick={() => onSwapInputs(idx, idx + 1)}
                                            className="w-4 h-4 rounded text-[10px] font-bold text-slate-500 hover:text-slate-900 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center bg-slate-100"
                                            title="Đổi sang phải"
                                        >
                                            →
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. Chủ Đề & Prompt Thiết Kế Poster (50 Chủ Đề Sắc Nét) */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                        2. 50+ Chủ Đề Poster Nghệ Thuật
                    </label>
                    <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200">
                        50 Chủ đề sẵn có
                    </span>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[10.5px]">
                    {[
                        { id: 'all', label: 'Tất cả (50)' },
                        { id: 'ky_yeu', label: '🎓 Kỷ Yếu (10)' },
                        { id: 'phim_anh', label: '🎬 Phim Ảnh (10)' },
                        { id: 'cuoi', label: '💍 Cưới & Yêu (8)' },
                        { id: 'am_nhac', label: '🎸 Âm Nhạc (8)' },
                        { id: 'du_lich', label: '✈️ Du Lịch (7)' },
                        { id: 'doanh_nhan', label: '💼 Doanh Nhân (7)' }
                    ].map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setPresetCategory(cat.id)}
                            className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                                presetCategory === cat.id
                                    ? 'bg-violet-600 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Quick Topic Presets */}
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-thin p-1 bg-slate-50 rounded-xl border border-slate-200/60">
                    {QUICK_TOPIC_PRESETS.filter(p => presetCategory === 'all' || p.category === presetCategory).map((p, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectPreset(p)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-violet-100 text-slate-700 hover:text-violet-900 text-[11px] font-semibold border border-slate-200/80 hover:border-violet-300 transition-all cursor-pointer shadow-2xs"
                        >
                            {p.title}
                        </button>
                    ))}
                </div>

                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Nhập mô tả poster mong muốn: Kỉ niệm sinh viên 2026, hoa phượng đỏ, dải ruy băng lụa đỏ, ngày cưới K-Drama..."
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all placeholder:text-slate-400"
                />
            </div>

            {/* 3. Tùy Chỉnh Chữ Trực Tiếp Cho AI Vẽ */}
            <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    3. Thông Tin Chữ Trên Poster (AI Sẽ Nhúng Trực Tiếp Vào Tranh)
                </label>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">Tên Tiêu Đề / Studio</span>
                        <input
                            type="text"
                            value={branding.studioName}
                            onChange={(e) => setBranding((prev) => ({ ...prev, studioName: e.target.value }))}
                            placeholder="Music Studio..."
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">Niên khóa / Năm</span>
                        <input
                            type="text"
                            value={branding.yearTag}
                            onChange={(e) => setBranding((prev) => ({ ...prev, yearTag: e.target.value }))}
                            placeholder="Kỉ niệm 2026..."
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">Concept / Tên Lớp (Chữ Thư Pháp)</span>
                        <input
                            type="text"
                            value={branding.conceptName}
                            onChange={(e) => setBranding((prev) => ({ ...prev, conceptName: e.target.value }))}
                            placeholder="Sinh viên / Tuổi Học Trò..."
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">Số Hotline (Vẽ Thành Pill Kim Loại)</span>
                        <input
                            type="text"
                            value={branding.hotline}
                            onChange={(e) => setBranding((prev) => ({ ...prev, hotline: e.target.value }))}
                            placeholder="0342 733 640..."
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-mono font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                </div>
            </div>

            {/* 4. Chọn Tỷ Lệ Màn Hình */}
            <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    4. Tỷ Lệ Màn Hình
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-xl">
                    {[
                        { id: '9:16', label: '📱 Khổ Dọc 9:16', desc: 'Story / TikTok' },
                        { id: '16:9', label: '🖥️ Khổ Ngang 16:9', desc: 'PC / Smart TV' },
                        { id: '1:1', label: '⬜ Khổ Vuông 1:1', desc: 'Post Facebook' }
                    ].map((r) => (
                        <button
                            key={r.id}
                            type="button"
                            onClick={() => setAspectRatio(r.id)}
                            className={`py-2 px-1 text-center rounded-lg transition-all cursor-pointer ${
                                aspectRatio === r.id
                                    ? 'bg-white text-violet-700 shadow-2xs font-extrabold ring-1 ring-slate-900/5'
                                    : 'text-slate-600 hover:text-slate-900 font-semibold'
                            }`}
                        >
                            <span className="block text-xs leading-tight">{r.label}</span>
                            <span className="block text-[9.5px] text-slate-400 mt-0.5">{r.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 5. Nút Bấm Thực Thi Tạo Poster AI */}
            <div className="space-y-2 pt-1">
                {!hasInputImage && (
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 text-[11px] font-medium ring-1 ring-amber-200/80 flex items-center gap-2">
                        <span>💡</span>
                        <span>Vui lòng tải lên từ 1 đến 10 ảnh ở khung bên trái để AI bắt đầu thiết kế.</span>
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleTriggerAiGenerate}
                    disabled={isLoading || isDisabled || !hasInputImage || !prompt.trim()}
                    className={`w-full min-h-[48px] py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider text-white transition-all duration-150 flex items-center justify-center gap-2 shadow-sm ${
                        isLoading || isDisabled || !hasInputImage || !prompt.trim()
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 active:scale-[0.98] shadow-violet-500/30 cursor-pointer ring-1 ring-violet-500/20'
                    }`}
                >
                    <span>✨</span>
                    <span>
                        {isLoading
                            ? 'AI ĐANG THIẾT KẾ POSTER...'
                            : inputCount === 0
                            ? 'VUI LÒNG NẠP ẢNH ĐẦU VÀO'
                            : `TẠO POSTER THIẾT KẾ AI (${aspectRatio})`}
                    </span>
                </button>
            </div>
        </div>
    );
};
