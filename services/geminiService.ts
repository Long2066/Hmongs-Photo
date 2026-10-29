import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface ImagePart {
    data: string; // base64 string
    mimeType: string;
}

const generateSingleImage = async (
    prompt: string,
    images: ImagePart[],
    aspectRatio: string,
    resolution: string,
    autoCleanup: boolean,
    shotType: string,
    style: string
): Promise<string> => {
    if (images.length === 0) {
        throw new Error("Cần có ít nhất một ảnh để chỉnh sửa.");
    }

    try {
        const imageParts = images.map(image => ({
            inlineData: { data: image.data, mimeType: image.mimeType },
        }));

        const getQualityInstruction = (res: string): string => {
            if (res === '4K') {
                return "Tạo ảnh với chất lượng 4K, siêu thực, cực kỳ chi tiết, sắc nét như ảnh chụp chuyên nghiệp.";
            }
            return "Tạo ảnh với chất lượng 2K, rõ nét, chất lượng cao.";
        };

        const cleanupInstruction = autoCleanup
            ? `
**MỆNH LỆNH TỐI THƯỢỢNG: DỌN DẸP VÀ TÁI TẠO ẢNH GỐC**
Nhiệm vụ của bạn là tái tạo lại một phiên bản hoàn hảo của bức ảnh gốc, loại bỏ MỌI yếu tố giao diện người dùng (UI) và chi tiết thừa. Hãy tuân thủ nghiêm ngặt các bước sau:

1.  **NHẬN DIỆN & CÔ LẬP:**
    *   **Quét toàn diện:** Phân tích từng pixel của ảnh đầu vào.
    *   **Xác định mục tiêu:** Tìm và đánh dấu tất cả các yếu tố không thuộc về cảnh quan/chủ thể gốc. Đây là những yếu tố cần xóa bỏ:
        *   **Giao diện mạng xã hội:** Toàn bộ các icon (like, tim, comment, share, bookmark, avatar người dùng, nút plus), các thanh công cụ, các con số đếm lượt tương tác.
        *   **Giao diện hệ thống:** Thanh trạng thái (icon pin, wifi, sóng, đồng hồ), thanh điều hướng.
        *   **Văn bản & Logo:** Bất kỳ chữ viết, watermark, logo, hashtag, tên thương hiệu nào.
        *   **Khung & Viền:** Mọi loại đường viền hoặc khung ảnh nhân tạo.

2.  **XÓA BỎ TUYỆT ĐỐI:**
    *   **Loại bỏ hoàn toàn:** Xóa 100% các mục tiêu đã xác định ở Bước 1. Không được để lại bất kỳ bóng mờ, dấu vết hay tàn dư nào. Vùng bị xóa phải trở nên trống rỗng.

3.  **TÁI TẠO THÔNG MINH (INPAINTING):**
    *   **Phân tích bối cảnh:** Nghiên cứu kỹ lưỡng các vùng lân cận của khu vực vừa bị xóa (kết cấu, ánh sáng, màu sắc, hoa văn).
    *   **Lấp đầy liền mạch:** Tái tạo lại vùng trống một cách logic và tự nhiên, như thể các yếu tố thừa chưa bao giờ tồn tại. Kết quả phải chân thực, không thể bị phát hiện.

4.  **KIỂM TRA & HOÀN THIỆN:**
    *   **Kết quả cuối cùng:** Hình ảnh trả về PHẢI LÀ một bức ảnh nguyên bản, sạch sẽ, chỉ chứa chủ thể và bối cảnh. Nó phải trông giống như một bức ảnh được chụp trực tiếp, không phải ảnh chụp màn hình.
`
            : "";

        const clothingFidelityInstruction = `
**MỆNH LỆNH BẢO TOÀN TRANG PHỤC TUYỆT ĐỐI:**
1.  **PHÂN TÍCH TRANG PHỤC GỐC:** Xác định chính xác trang phục, quần áo, phụ kiện hoặc sản phẩm chính trong (các) ảnh đầu vào.
2.  **SAO CHÉP CHI TIẾT 100%:** Giữ lại NGUYÊN VẸN TUYỆT ĐỐI 100% mọi chi tiết của (các) trang phục/sản phẩm đó trong ảnh đầu ra. Điều này bao gồm: màu sắc chính xác, mọi họa tiết, hoa văn, kết cấu vải, kiểu dáng, và tất cả các chi tiết trang trí dù là nhỏ nhất.
3.  **CẤM TUYỆT ĐỐI THAY ĐỔI:** Nghiêm cấm mọi hành vi tự ý thay đổi, thêm, bớt, diễn giải lại hoặc sáng tạo lại bất kỳ phần nào của trang phục/sản phẩm. Nó phải là một bản sao kỹ thuật số hoàn hảo.
4.  **MỤC TIÊU:** Mục tiêu là chỉ thay đổi người mặc và bối cảnh theo yêu cầu, trong khi trang phục/sản phẩm phải giống hệt ảnh gốc.
`;

        const anatomyInstruction = `
**MỆNH LỆNH VỀ GIẢI PHẪU VÀ TÍNH HIỆN THỰC:**
1.  **ƯU TIÊN GIẢI PHẪU:** Đảm bảo người trong ảnh có giải phẫu hoàn chỉnh và chính xác.
2.  **TẬP TRUNG VÀO CHI TIẾT:** Đặc biệt chú ý đến việc hiển thị bàn tay, ngón tay và các chi một cách tự nhiên và đầy đủ. Tránh các lỗi phổ biến của AI như thiếu chi, tay bị biến dạng hoặc số lượng ngón tay không chính xác.
3.  **KẾT QUẢ TỰ NHIÊN:** Người trong ảnh cuối cùng phải trông tự nhiên, cân đối và hoàn chỉnh về mặt cơ thể.
`;

        const antiMannequinInstruction = `
**MỆNH LỆNH CHỐNG HIỆU ỨNG MA-NƠ-CANH:**
1.  **CẤM TUYỆT ĐỐI:** Nghiêm cấm việc tạo ra các bộ phận cơ thể trông giống như ma-nơ-canh, tượng, hoặc nhựa.
2.  **YÊU CẦU BẮT BUỘC:** Mọi bộ phận của cơ thể người (đặc biệt là tay, chân, da) phải có kết cấu (texture) tự nhiên, màu sắc da người thật, và chi tiết đầy đủ. Không được phép có những vùng da trắng bệch, nhẵn bóng, không có chi tiết.
3.  **MỤC TIÊU:** Nhân vật phải trông sống động và hoàn toàn là người thật, không phải là một hình nhân.
`;

        const getShotTypeInstruction = (type: string): string => {
            if (type === 'portrait') {
                return "Tập trung vào ảnh chân dung cận cảnh hoặc bán thân của (các) nhân vật, làm nổi bật biểu cảm và chi tiết trên khuôn mặt và trang phục. Chủ thể nên chiếm phần lớn khung hình.";
            }
            return "Tạo một bức ảnh toàn cảnh, thể hiện (các) nhân vật trong một bối cảnh rộng lớn và hùng vĩ. Đảm bảo cả nhân vật và môi trường xung quanh đều được hiển thị rõ ràng.";
        };

        const getStyleInstruction = (styleType: string): string => {
            switch (styleType) {
                case 'anime':
                    return "Vẽ lại toàn bộ cảnh theo phong cách anime Nhật Bản hiện đại, có độ chi tiết cao. Nhân vật phải có đôi mắt to, biểu cảm đặc trưng và đường nét sắc sảo của anime. Màu sắc cần sống động và tươi sáng.";
                case '3d':
                    return "Tái tạo lại cảnh dưới dạng một tác phẩm 3D render, giống như các nhân vật trong phim của Pixar hoặc DreamWorks. Chú ý đến ánh sáng, đổ bóng và kết cấu bề mặt để tạo cảm giác chiều sâu và chân thực của mô hình 3D.";
                case 'dream':
                    return "Biến đổi cảnh thành một khung cảnh mộng mơ, huyền ảo (dreamlike, ethereal). Sử dụng ánh sáng mềm mại, hiệu ứng sương mù nhẹ, màu sắc kỳ ảo (pastel, neon) và có thể thêm các yếu tố kỳ ảo như bụi tiên hoặc các vệt sáng lấp lánh.";
                case 'realistic':
                default:
                    return "Tạo ra một hình ảnh siêu thực, tả thực như ảnh chụp (photorealistic). Mọi chi tiết từ ánh sáng, bóng tối, kết cấu vật liệu, làn da đều phải đạt đến độ chân thực cao nhất, giống như được chụp bằng máy ảnh chuyên nghiệp.";
            }
        };

        const compositionInstruction = `
**MỆNH LỆNH TỐI CAO VỀ BỐ CỤC VÀ TỶ LỆ KHUNG HÌNH:**
1.  **TỶ LỆ KHUNG HÌNH BẮT BUỘC:** Tác phẩm cuối cùng PHẢI TUÂN THỦ TUYỆT ĐỐI tỷ lệ khung hình đã chọn là **${aspectRatio}**. Mọi sai lệch đều không được chấp nhận.
2.  **LOẠI BỐ CỤC:** Áp dụng bố cục kiểu **${shotType === 'portrait' ? 'CHÂN DUNG' : 'TOÀN CẢNH'}**.
3.  **HƯỚNG DẪN BỐ CỤC:** ${getShotTypeInstruction(shotType)}
`;

        const styleInstruction = `
**MỆNH LỆNH VỀ PHONG CÁCH NGHỆ THUẬT:**
**PHONG CÁCH YÊU CẦU:** ${style.toUpperCase()}.
**HƯỚNG DẪN CHI TIẾT:** ${getStyleInstruction(style)}
`;

        const qualityInstruction = getQualityInstruction(resolution);

        const enhancedPrompt = `${prompt}. ${cleanupInstruction} ${clothingFidelityInstruction} ${anatomyInstruction} ${antiMannequinInstruction} ${compositionInstruction} ${styleInstruction} ${qualityInstruction}`;
        const textPart = { text: enhancedPrompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [...imageParts, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
                imageConfig: aspectRatio && aspectRatio !== '1:1' ? { aspectRatio: aspectRatio as any } : undefined
            },
        });

        const { candidates } = response;
        if (candidates && candidates.length > 0) {
            const imagePart = candidates[0].content.parts.find(part => part.inlineData);
            if (imagePart && imagePart.inlineData) {
                return imagePart.inlineData.data;
            }
        }

        throw new Error("AI không trả về ảnh nào. Hãy thử một câu lệnh khác.");

    } catch (error) {
        console.error("Gemini API error:", error);
        let message = error instanceof Error ? error.message : "Lỗi không xác định";

        // Check for specific quota error message from the API and provide a user-friendly response.
        if (message.toLowerCase().includes('quota exceeded') || message.toLowerCase().includes('daily limit')) {
            message = "Bạn đã đạt đến giới hạn sử dụng miễn phí trong ngày cho mô hình này. Đây là giới hạn từ dịch vụ AI của Google để đảm bảo quyền truy cập công bằng. Vui lòng thử lại sau 24 giờ.";
        } else {
            message = `Không thể tạo ảnh từ AI. Lỗi: ${message}. Vui lòng kiểm tra lại câu lệnh và ảnh đầu vào.`;
        }

        throw new Error(message);
    }
};

export const generateMultipleImages = async (
    prompt: string,
    images: ImagePart[],
    count: number = 4,
    aspectRatio: string,
    resolution: string,
    autoCleanup: boolean,
    shotType: string,
    style: string
): Promise<(string | null)[]> => {
    const generationPromises = Array.from({ length: count }).map(() =>
        generateSingleImage(prompt, images, aspectRatio, resolution, autoCleanup, shotType, style)
    );

    const results = await Promise.allSettled(generationPromises);

    return results.map(result => {
        if (result.status === 'fulfilled') {
            return result.value;
        }
        console.error("Một trong các yêu cầu tạo ảnh đã thất bại:", result.reason);
        return null;
    });
};