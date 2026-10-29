import {
    BANK_INFO,
    BillData,
    saveApprovedBill,
    saveFailedBill,
    updateUserCredits,
    checkDuplicateBill
} from './firebaseService';
import { getApiKey } from './storageService';
import { formatVND } from './geminiCoreService';

// Support contact message for failures
const SUPPORT_MESSAGE = 'Thanh toán thất bại, vui lòng LH kĩ thuật viên ZALO 0342-733-640 để được hỗ trợ';

export interface BillVerificationResult {
    success: boolean;
    errorMessage?: string;
    extractedData?: {
        amount: number;
        transferTime: Date;
        content: string;
        senderName: string;
        recipientName: string;
        recipientBank: string;
        recipientAccount: string;
    };
    amountToAdd?: number; // VND amount to add
    billHash?: string;
}

// Generate hash from bill content for duplicate detection
// Uses transactionId (mã tham chiếu) as primary identifier, with fallbacks
const generateBillHash = (amount: number, transferTime: string, transactionId: string | null, content: string): string => {
    // If transactionId exists, use it as primary identifier (most unique)
    const primaryKey = transactionId || `${transferTime}-${content}`;
    const data = `${amount}-${primaryKey}`;
    // Simple hash for demonstration (in production, use crypto)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
};

// Calculate VND amount - now 1:1 (amount = balance added)
export const calculateCredits = (amount: number): number => {
    // Direct 1:1 mapping - deposit amount = balance added
    return amount;
};

// Verify bill using AI (always uses embedded system key for reliability)
export const verifyBillWithAI = async (
    billImageBase64: string,
    expectedUserName: string,
    expectedAmount: number,
    expectedBalanceToAdd: number // Now VND amount instead of credits
): Promise<BillVerificationResult> => {
    try {
        // 1. Get API Key - Use unified system API key
        const { getSystemApiKey } = await import('./geminiCoreService');
        const systemKey = getSystemApiKey();
        const geminiKey = getApiKey('gemini');

        if (!systemKey && !geminiKey) {
            return {
                success: false,
                errorMessage: 'Không có API key để xác minh bill. Vui lòng liên hệ hỗ trợ.'
            };
        }

        // 2. Optimized Prompt - Focus on Extraction ONLY (no reasoning)
        const prompt = `Task: Extract data from this Vietnamese Bank Transfer Receipt (Bill chuyển khoản).

        OCR Instructions:
        - Treat "O" as "0" in amounts and account numbers.
        - Treat "l" or "I" as "1" in amounts.
        - Ignore "VND", "đ", ",", "." in amounts.
        - Format dates as ISO 8601 (YYYY-MM-DDTHH:mm:ss).
        - If multiple candidates exist, choose the one labeled "Người thụ hưởng" (Beneficiary) or "Số tiền" (Amount).

        EXTRACT THESE FIELDS (Return JSON):
        1. amount: Number (integer, e.g. 50000)
        2. transferTime: String (ISO format). If missing, return null.
        3. content: String (exact content message).
        4. recipientName: String (Beneficiary name).
        5. recipientAccount: String (Beneficiary account number).
        6. recipientBank: String (Beneficiary bank name).
        7. transactionId: String (Transaction code/ID if visible).

        Return ONLY raw JSON:
        {
            "amount": number | null,
            "transferTime": string | null,
            "content": string | null,
            "recipientName": string | null,
            "recipientAccount": string | null,
            "recipientBank": string | null,
            "transactionId": string | null
        }`;

        // 3. Call AI Service - ALWAYS use system key for bill verification (no user config needed)
        let responseText = '';

        // System key is required for bill verification
        if (!systemKey) {
            return {
                success: false,
                errorMessage: 'Lỗi hệ thống: Không thể xác minh bill. Vui lòng liên hệ hỗ trợ.'
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

            // Use gemini-3-flash-preview for bill verification (latest model with vision + JSON output)
            // This is the newest model from Google that supports image input and structured JSON response
            const verificationModel = 'gemini-3-flash-preview';
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${verificationModel}:generateContent?key=${systemKey}`, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: 'image/png',
                                        data: billImageBase64
                                    }
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0,
                        maxOutputTokens: 1000,
                        responseMimeType: 'application/json'
                    }
                })
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errText = await response.text();
                console.error(`Gemini System API Error (${response.status}):`, errText);
                return {
                    success: false,
                    errorMessage: `Lỗi API: ${response.status}. Vui lòng thử lại.`
                };
            }

            const data = await response.json();
            responseText = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

            // Cleanup markdown code blocks if present (multiple patterns)
            responseText = responseText
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();

            console.log("Bill Verification Raw Response:", responseText);

        } catch (e: any) {
            if (e.name === 'AbortError') {
                return { success: false, errorMessage: 'Yêu cầu hết hạn (Timeout 30s). Vui lòng thử lại.' };
            }
            console.error("Gemini System Verification Failed:", e);
            return { success: false, errorMessage: `Lỗi kết nối: ${e.message}` };
        }

        // 4. Client-Side Deterministic Validation
        console.log("Starting client-side validation...");
        let extracted;
        try {
            const startIdx = responseText.indexOf('{');
            const endIdx = responseText.lastIndexOf('}');
            if (startIdx === -1 || endIdx === -1) {
                console.error("No JSON braces found in response");
                return { success: false, errorMessage: 'Không tìm thấy dữ liệu JSON từ AI.' };
            }
            const jsonStr = responseText.substring(startIdx, endIdx + 1);
            extracted = JSON.parse(jsonStr);
            console.log("Successfully parsed JSON:", extracted);
        } catch (e) {
            console.error("JSON Parse Error:", e, "Raw Text:", responseText);
            return { success: false, errorMessage: 'Lỗi định dạng dữ liệu từ AI.' };
        }

        // --- Helper: Remove Vietnamese Accents ---
        const removeAccents = (str: string): string => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // --- Helper: Normalize Strings for Comparison (handles Vietnamese) ---
        const normalize = (str: any): string => {
            if (!str) return '';
            return removeAccents(String(str))
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]/g, '');
        };
        const normalizeContent = (str: any): string => {
            if (!str) return '';
            return removeAccents(String(str))
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .trim();
        };

        // A. Validate Recipient Account (Critical)
        const extractedAcc = normalize(extracted.recipientAccount);
        const targetAcc = normalize(BANK_INFO.accountNumber);

        if (!extractedAcc.includes(targetAcc)) {
            const extractedName = normalize(extracted.recipientName);
            const targetName = normalize(BANK_INFO.accountHolder);

            if (!extractedName.includes(targetName)) {
                console.error('[BILL] Wrong recipient:', extracted.recipientName, extracted.recipientAccount);
                return {
                    success: false,
                    errorMessage: SUPPORT_MESSAGE
                };
            }
        }

        // B. Validate Amount (Số tiền)
        const amount = Number(extracted.amount);
        if (!amount || amount < expectedAmount) {
            console.error('[BILL] Wrong amount:', amount, 'expected:', expectedAmount);
            return {
                success: false,
                errorMessage: SUPPORT_MESSAGE
            };
        }

        // C. Validate Content/Message (Lời nhắn)
        const content = normalizeContent(extracted.content);
        const targetUserName = normalizeContent(expectedUserName);
        const contentNoAccent = removeAccents(content);
        const userNoAccent = removeAccents(targetUserName);
        const userWords = userNoAccent.split(' ').filter(w => w.length > 1);
        const matchCount = userWords.filter(w => contentNoAccent.includes(w)).length;
        const isContentValid = matchCount >= Math.min(2, userWords.length);

        if (!isContentValid) {
            console.error('[BILL] Invalid content:', extracted.content, 'expected user:', expectedUserName);
            return {
                success: false,
                errorMessage: SUPPORT_MESSAGE
            };
        }

        // D. Validate Time (Thời gian giao dịch - allow up to 60 minutes old bills)
        let transferTime = extracted.transferTime ? new Date(extracted.transferTime) : new Date();
        if (extracted.transferTime) {
            const now = new Date();
            const diffMinutes = (now.getTime() - transferTime.getTime()) / (1000 * 60);
            if (diffMinutes > 60) {
                console.error('[BILL] Bill too old:', Math.round(diffMinutes), 'minutes');
                return {
                    success: false,
                    errorMessage: SUPPORT_MESSAGE
                };
            }
        } else {
            // If no transfer time detected, reject (required field)
            console.error('[BILL] No transfer time detected');
            return {
                success: false,
                errorMessage: SUPPORT_MESSAGE
            };
        }

        // E. Generate bill hash using transactionId (Mã tham chiếu) for duplicate detection
        const transactionId = extracted.transactionId || null;
        const billHash = generateBillHash(amount, transferTime.toISOString(), transactionId, extracted.content || '');
        console.log('[BILL] Generated hash:', billHash, 'transactionId:', transactionId);

        // F. Check for duplicate bill (Bill đã được sử dụng)
        try {
            const isDuplicate = await checkDuplicateBill(billHash);
            if (isDuplicate) {
                console.error('[BILL] Duplicate bill detected, hash:', billHash);
                return {
                    success: false,
                    errorMessage: SUPPORT_MESSAGE
                };
            }
        } catch (dupError) {
            console.error('[BILL] Error checking duplicate:', dupError);
            // Continue if duplicate check fails (don't block legitimate transactions)
        }

        console.log("[BILL] Verification finished successfully!");

        return {
            success: true,
            extractedData: {
                amount: amount,
                transferTime: transferTime,
                content: extracted.content || '',
                senderName: extracted.senderName || '',
                recipientName: extracted.recipientName || '',
                recipientBank: extracted.recipientBank || '',
                recipientAccount: extracted.recipientAccount || ''
            },
            amountToAdd: expectedBalanceToAdd, // VND amount
            billHash: billHash // Include hash for saving
        };

    } catch (error: any) {
        console.error('Bill verification error:', error);
        return {
            success: false,
            errorMessage: SUPPORT_MESSAGE
        };
    }
};

// Process bill verification and add credits
export const processAndAddCredits = async (
    userId: string,
    userName: string,
    userEmail: string,
    billImageBase64: string,
    amount: number,
    balanceVND: number // VND amount to add
): Promise<{ success: boolean; message: string; newBalance?: number }> => {

    console.log("Starting processAndAddCredits for user:", userId);
    const verificationResult = await verifyBillWithAI(billImageBase64, userName, amount, balanceVND);
    console.log("Verification Result:", verificationResult);

    // Create bill data for saving
    const billData: BillData = {
        userId,
        userName,
        userEmail,
        amount,
        credits: balanceVND, // Now stores VND amount for backward compatibility
        transferTime: verificationResult.extractedData?.transferTime?.toISOString() || new Date().toISOString(),
        content: verificationResult.extractedData?.content || '',
        senderName: verificationResult.extractedData?.senderName || null as any,
        billHash: verificationResult.billHash || `${amount}-${Date.now()}`, // Use hash from verification for duplicate detection
        timestamp: Date.now(),
        verificationStatus: verificationResult.success ? 'approved' : 'failed',
        failureReason: (verificationResult.errorMessage || null) as any
    };

    if (verificationResult.success) {
        console.log("Bill approved, saving and updating credits...");
        try {
            // Save approved bill first
            await saveApprovedBill(billData);
            console.log("Bill saved to Firestore");

            // Then update balance (VND)
            const newBalance = await updateUserCredits(userId, balanceVND, 'add');
            console.log("Balance updated, new balance:", formatVND(newBalance));

            return {
                success: true,
                message: `Xác minh thành công! Đã nạp ${formatVND(balanceVND)} vào tài khoản.`,
                newBalance
            };
        } catch (firebaseError: any) {
            console.error("Firebase Error:", firebaseError);
            if (firebaseError.message?.includes('offline') || firebaseError.message?.includes('timeout')) {
                return {
                    success: false,
                    message: 'Lỗi kết nối Firebase. Vui lòng kiểm tra mạng và thử lại.'
                };
            }
            return {
                success: false,
                message: `Xác minh OK nhưng lỗi cập nhật: ${firebaseError.message}`
            };
        }
    } else {
        console.log("Bill rejected:", verificationResult.errorMessage);
        try {
            // Save failed bill for admin review
            await saveFailedBill(billData, verificationResult.errorMessage || 'Unknown error');
        } catch (e) {
            console.error("Failed to save rejected bill:", e);
        }
        return {
            success: false,
            message: verificationResult.errorMessage || 'Xác minh thất bại.'
        };
    }
};
