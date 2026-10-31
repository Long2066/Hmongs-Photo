/**
 * Anti-Fraud & Security Service for ImageTool
 * 
 * 1. Device Account Limit:
 *    - Records hardware/browser fingerprint & deviceId on Firebase.
 *    - Restricts each device to a maximum of 2 accounts.
 *    - Prevents account farming / multiple free account abuse on the same device.
 * 
 * 2. Disposable Email Blocker:
 *    - Blocks temporary 10-minute emails (Temp-mail, GuerrillaMail, Mailinator, YOPmail, etc.).
 *    - Blocks sub-addressing / plus aliasing (+tag) tricks.
 */

import { doc, getDoc, setDoc } from "firebase/firestore";
import { getBackgroundSyncDb, USER_ACCESS_COLLECTION } from "./firebaseService";

export const MAX_ACCOUNTS_PER_DEVICE = 2;

// Admin emails exempt from device limits
const ADMIN_EXEMPT_EMAILS = [
    'longk2tha@gmail.com',
    'guest_cloud_sync@toolphoto.vn'
];

const DEVICE_TOKEN_KEY = 'it_device_token';
const DEVICE_ACCOUNTS_KEY = 'it_device_accounts';

// Comprehensive set of known disposable / temp-mail domains
const DISPOSABLE_EMAIL_DOMAINS = new Set([
    // TempMail variants
    'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmail.net', 'tempmailaddress.com',
    'tempmailgen.com', 'temp-mail.cc', 'tempail.com', 'tempmail.de', 'tempmailo.com',
    'tempmail.ninja', 'tempmailfree.info', 'temporary-mail.net', 'temp-mails.com',
    'tempmail24.com', 'tmail.ws', 'disposable-email.com', 'disposablemail.com',

    // 10 Minute Mail
    '10minutemail.com', '10minutemail.net', '10minutemail.org', '10minmail.com',
    '10mail.org', 'minuteinbox.com', 'minutemail.com', '10minutemailbox.com',
    '20minutemail.com', '10minutemail.pro',

    // Guerrilla Mail
    'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz',
    'guerrillamail.de', 'guerrillamailblock.com', 'guerrillamail.info', 'grr.la',
    'pokemail.net', 'spam4.me',

    // Mailinator & family
    'mailinator.com', 'mailin8r.com', 'mailinator2.com', 'suremail.info',
    'spamherelots.com', 'binkmail.com', 'bobmail.info', 'safetymail.info',
    'notmailinator.com', 'mailnesia.com',

    // YOPmail & aliases
    'yopmail.com', 'yopmail.fr', 'yopmail.net', 'cool.fr.nf', 'jetable.fr.nf',
    'nospam.ze.tc', 'nomail.xl.cx', 'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf',
    'moncourrier.fr.nf', 'monemail.fr.nf', 'monmail.fr.nf', 'ypmail.com',

    // TrashMail
    'trashmail.com', 'trashmail.net', 'trashmail.me', 'trashmail.io', 'trashmail.org',
    'trashemail.in', 'trash-mail.com', 'trashmail.de',

    // Mohmal
    'mohmal.com', 'mohmal.im', 'mohmal.in', 'mohmal.tech',

    // Nada & clones
    'getnada.com', 'nada.ltd', 'abcvg.com', 'getairmail.com', 'dropmail.me',
    'inboxbear.com', 'inboxkitten.com', 'mytemp.email', 'generator.email',

    // Dispostable, Sharklasers, Burner
    'dispostable.com', 'sharklasers.com', 'throwawaymail.com', 'fakemailgenerator.com',
    'emailondeck.com', 'crazymailing.com', 'burnermail.io', 'internxt.com',
    'mailpoof.com', 'maildrop.cc', 'bccto.me', 'chacuo.net', 'mailsac.com',
    'fakeinbox.com', 'fakeinbox.net', 'emailfake.com', 'crazymail.com',
    '0-mail.com', '0clickemail.com', '0815.ru', '0815.su', '0wnd.net', '0wnd.org',
    'zillamail.com', 'meltmail.com', 'spambox.us', 'mytempemail.com', 'harakirimail.com',
    'armyspy.com', 'cuvox.de', 'dayrep.com', 'einrot.com', 'fleckens.hu',
    'gustr.com', 'jourrapide.com', 'rhyta.com', 'superrito.com', 'teleworm.us',
    'inboxalias.com', 'owlymail.com', 'mailgw.com', 'clipmail.eu', 'fmail.com'
]);

// Trusted domain whitelist (instant fast-pass)
const TRUSTED_DOMAINS = new Set([
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.com.vn', 'outlook.com',
    'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
    'proton.me', 'protonmail.com', 'zoho.com', 'aol.com', 'mail.com'
]);

/**
 * Validates whether an email is a disposable / temporary / burner email
 */
export const isDisposableEmail = (rawEmail: string): { isDisposable: boolean; reason?: string } => {
    if (!rawEmail || typeof rawEmail !== 'string') {
        return { isDisposable: true, reason: 'Email không hợp lệ.' };
    }

    const email = rawEmail.trim().toLowerCase();
    const parts = email.split('@');

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return { isDisposable: true, reason: 'Định dạng email không hợp lệ.' };
    }

    const [localPart, domain] = parts;

    // Check 1: Anti-plus aliasing (prevent user+1@gmail.com, user+2@gmail.com farming)
    if (localPart.includes('+')) {
        return {
            isDisposable: true,
            reason: 'Hệ thống không chấp nhận địa chỉ email chứa dấu cộng (+) để tạo tài khoản ảo. Vui lòng nhập địa chỉ email gốc.'
        };
    }

    // Check 2: Instant fast-pass for trusted domains & educational/gov domains
    if (
        TRUSTED_DOMAINS.has(domain) ||
        domain.endsWith('.edu') ||
        domain.endsWith('.edu.vn') ||
        domain.endsWith('.gov') ||
        domain.endsWith('.gov.vn') ||
        domain.endsWith('.org.vn') ||
        domain.endsWith('.ac.uk')
    ) {
        return { isDisposable: false };
    }

    // Check 3: Check exact domain blacklist
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
        return {
            isDisposable: true,
            reason: 'Hệ thống ImageTool không chấp nhận email rác hoặc email tạm thời (10-minute mail). Vui lòng sử dụng địa chỉ email chính thức (Gmail, Yahoo, Outlook, iCloud, Edu, doanh nghiệp...).'
        };
    }

    // Check 4: Heuristic keyword pattern detection on domain
    const suspiciousKeywords = [
        'tempmail', 'disposab', 'fakemail', '10minute', 'throwaway', 'trashmail',
        'mailinator', 'burnermail', 'guerrilla', 'mohmal', 'yopmail', 'getnada',
        'dropmail', 'inboxbear', 'fakeinbox', 'generator', 'sharklasers', 'minuteinbox',
        'temp-mail', 'dispostable', 'fake-mail'
    ];

    if (suspiciousKeywords.some(keyword => domain.includes(keyword))) {
        return {
            isDisposable: true,
            reason: 'Tên miền email bị nghi ngờ là email tạm thời / rác. Vui lòng sử dụng tài khoản email chính thức để đảm bảo nhận được thông báo và bảo vệ tài khoản.'
        };
    }

    return { isDisposable: false };
};

/**
 * Fast string hashing (DJB2 + 32-bit mix)
 */
const hashString = (str: string): string => {
    let h1 = 0xdeadbeef ^ 0;
    let h2 = 0x41c64e6d ^ 0;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return Math.abs(combined).toString(36);
};

/**
 * Generates an in-memory Canvas 2D fingerprint hash
 */
const getCanvasFingerprint = (): string => {
    try {
        if (typeof document === 'undefined') return 'node_canvas';
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (!ctx) return 'no_2d_context';

        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial', 'Segoe UI', sans-serif";
        ctx.fillStyle = "#6366f1";
        ctx.fillRect(10, 5, 80, 30);
        ctx.fillStyle = "#ec4899";
        ctx.fillText("ImageTool🛡️AntiCheat@2025", 15, 12);
        ctx.strokeStyle = "rgba(16, 185, 129, 0.8)";
        ctx.beginPath();
        ctx.arc(140, 20, 15, 0, Math.PI * 2);
        ctx.stroke();

        return hashString(canvas.toDataURL());
    } catch (e) {
        return 'canvas_error';
    }
};

/**
 * Extracts WebGL unmasked GPU vendor & renderer
 */
const getWebGlFingerprint = (): string => {
    try {
        if (typeof document === 'undefined') return 'no_webgl';
        const canvas = document.createElement('canvas');
        const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        if (!gl) return 'no_webgl_context';

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
            return `${vendor}_${renderer}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        }
        return (gl.getParameter(gl.RENDERER) || 'generic_gl').replace(/[^a-zA-Z0-9_-]/g, '_');
    } catch (e) {
        return 'webgl_error';
    }
};

export interface DeviceInfo {
    hardwareHash: string;
    deviceToken: string;
    screen: string;
    gpu: string;
    timezone: string;
    platform: string;
    userAgent: string;
}

/**
 * Produces a stable, unique device identifier combining hardware, GPU, canvas,
 * timezone, and persistent localStorage token.
 */
export const getDeviceFingerprint = async (): Promise<DeviceInfo> => {
    let deviceToken = '';
    if (typeof localStorage !== 'undefined') {
        deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY) || '';
        if (!deviceToken) {
            deviceToken = 'tok_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
            try {
                localStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
            } catch (e) {}
        }
    }

    const screenInfo = typeof window !== 'undefined'
        ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}_dpr${window.devicePixelRatio || 1}`
        : 'unknown_screen';

    const timezone = typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown_tz'
        : 'unknown_tz';

    const platform = typeof navigator !== 'undefined' ? navigator.platform || 'unknown_plat' : 'unknown_plat';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const hardwareConcurrency = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;

    const canvasHash = getCanvasFingerprint();
    const gpuHash = getWebGlFingerprint();

    // Combine hardware constants (survives incognito & cache clearing on the same physical machine)
    const rawHardwareString = `${screenInfo}#${timezone}#${platform}#${hardwareConcurrency}#${gpuHash}#${canvasHash}`;
    const hardwareHash = hashString(rawHardwareString);

    return {
        hardwareHash,
        deviceToken,
        screen: screenInfo,
        gpu: gpuHash.substring(0, 80),
        timezone,
        platform,
        userAgent: userAgent.substring(0, 120)
    };
};

export interface DeviceLimitCheckResult {
    allowed: boolean;
    message?: string;
    accounts: string[];
    currentAccountCount: number;
    maxAllowed: number;
    isExempt?: boolean;
}

/**
 * Checks whether this device is permitted to log in or register with the given email.
 * Limits to MAX_ACCOUNTS_PER_DEVICE (2) accounts per machine.
 */
export const checkDeviceAccountLimit = async (
    rawEmail: string,
    _userId?: string
): Promise<DeviceLimitCheckResult> => {
    const normalizedEmail = (rawEmail || '').trim().toLowerCase();

    // 1. Admin exemption
    if (ADMIN_EXEMPT_EMAILS.includes(normalizedEmail)) {
        return {
            allowed: true,
            accounts: [normalizedEmail],
            currentAccountCount: 1,
            maxAllowed: 999,
            isExempt: true
        };
    }

    try {
        const deviceInfo = await getDeviceFingerprint();
        const targetDb = await getBackgroundSyncDb();
        const docRef = doc(targetDb, USER_ACCESS_COLLECTION, `devreg_${deviceInfo.hardwareHash}`);

        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            // New device, allow
            return {
                allowed: true,
                accounts: [],
                currentAccountCount: 0,
                maxAllowed: MAX_ACCOUNTS_PER_DEVICE
            };
        }

        const data = docSnap.data() || {};

        // Admin unlimited flag on specific device document
        if (data.unlimited === true) {
            return {
                allowed: true,
                accounts: data.accounts || [],
                currentAccountCount: (data.accounts || []).length,
                maxAllowed: 999,
                isExempt: true
            };
        }

        const maxAllowed = Number(data.maxAllowed) || MAX_ACCOUNTS_PER_DEVICE;
        const registeredAccounts: string[] = (data.accounts || [])
            .map((e: string) => (e || '').trim().toLowerCase())
            .filter((e: string) => e.length > 0);

        // If email is already one of the registered accounts on this device, allow immediately
        if (registeredAccounts.includes(normalizedEmail)) {
            return {
                allowed: true,
                accounts: registeredAccounts,
                currentAccountCount: registeredAccounts.length,
                maxAllowed
            };
        }

        // If this is a new 3rd account and limit is reached
        if (registeredAccounts.length >= maxAllowed) {
            return {
                allowed: false,
                accounts: registeredAccounts,
                currentAccountCount: registeredAccounts.length,
                maxAllowed,
                message: `⚠️ Thiết bị này đã đạt giới hạn tối đa ${maxAllowed} tài khoản đăng nhập (${registeredAccounts.join(', ')}).\n\nĐể bảo vệ hệ thống và chống gian lận, mỗi thiết bị chỉ được phép sử dụng tối đa ${maxAllowed} tài khoản.\n\nVui lòng đăng nhập bằng tài khoản đã có trên thiết bị này hoặc liên hệ Zalo/Hotline 0342.733.640 nếu bạn cần hỗ trợ đổi thiết bị.`
            };
        }

        // Under limit
        return {
            allowed: true,
            accounts: registeredAccounts,
            currentAccountCount: registeredAccounts.length,
            maxAllowed
        };
    } catch (error) {
        console.warn("[antiFraudService] Device check fallback:", error);
        // Fallback to localStorage check if network/Firestore read has an issue
        if (typeof localStorage !== 'undefined') {
            try {
                const localAccounts: string[] = JSON.parse(localStorage.getItem(DEVICE_ACCOUNTS_KEY) || '[]');
                if (localAccounts.includes(normalizedEmail)) {
                    return { allowed: true, accounts: localAccounts, currentAccountCount: localAccounts.length, maxAllowed: MAX_ACCOUNTS_PER_DEVICE };
                }
                if (localAccounts.length >= MAX_ACCOUNTS_PER_DEVICE) {
                    return {
                        allowed: false,
                        accounts: localAccounts,
                        currentAccountCount: localAccounts.length,
                        maxAllowed: MAX_ACCOUNTS_PER_DEVICE,
                        message: `⚠️ Thiết bị này đã đạt giới hạn tối đa ${MAX_ACCOUNTS_PER_DEVICE} tài khoản. Vui lòng đăng nhập bằng tài khoản đã đăng ký trước đó hoặc liên hệ Hotline/Zalo 0342.733.640.`
                    };
                }
            } catch (e) {}
        }
        // Fail-open for safety to avoid locking legitimate users out during complete network outages
        return {
            allowed: true,
            accounts: [],
            currentAccountCount: 0,
            maxAllowed: MAX_ACCOUNTS_PER_DEVICE
        };
    }
};

/**
 * Records a successful login or signup on this device in Firestore and localStorage
 */
export const recordDeviceAccount = async (rawEmail: string, userId?: string): Promise<void> => {
    const normalizedEmail = (rawEmail || '').trim().toLowerCase();
    if (!normalizedEmail || ADMIN_EXEMPT_EMAILS.includes(normalizedEmail)) return;

    try {
        const deviceInfo = await getDeviceFingerprint();
        const targetDb = await getBackgroundSyncDb();
        const docRef = doc(targetDb, USER_ACCESS_COLLECTION, `devreg_${deviceInfo.hardwareHash}`);

        const now = Date.now();
        const docSnap = await getDoc(docRef);

        let accounts: string[] = [];
        let tokens: string[] = [];
        let details: Record<string, any> = {};

        if (docSnap.exists()) {
            const data = docSnap.data() || {};
            accounts = (data.accounts || []).map((e: string) => (e || '').trim().toLowerCase());
            tokens = data.deviceTokens || [];
            details = data.accountDetails || {};
        }

        if (!accounts.includes(normalizedEmail)) {
            accounts.push(normalizedEmail);
        }

        if (deviceInfo.deviceToken && !tokens.includes(deviceInfo.deviceToken)) {
            tokens.push(deviceInfo.deviceToken);
        }

        details[normalizedEmail] = {
            uid: userId || details[normalizedEmail]?.uid || '',
            firstLogin: details[normalizedEmail]?.firstLogin || now,
            lastLogin: now
        };

        await setDoc(docRef, {
            fingerprint: deviceInfo.hardwareHash,
            deviceTokens: tokens,
            accounts,
            accountDetails: details,
            maxAllowed: MAX_ACCOUNTS_PER_DEVICE,
            hardwareInfo: {
                screen: deviceInfo.screen,
                gpu: deviceInfo.gpu,
                timezone: deviceInfo.timezone,
                platform: deviceInfo.platform
            },
            userAgent: deviceInfo.userAgent,
            updatedAt: now,
            createdAt: docSnap.exists() ? (docSnap.data()?.createdAt || now) : now
        }, { merge: true });

        // Also update local storage cache
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(DEVICE_ACCOUNTS_KEY, JSON.stringify(accounts));
            } catch (e) {}
        }
    } catch (error) {
        console.warn("[antiFraudService] Could not record device account:", error);
    }
};
