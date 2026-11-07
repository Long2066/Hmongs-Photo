/** Shared Flow tool URL policy; never accept external hosts or credentials in the URL. */
export const DEFAULT_FLOW_TOOL_URL = 'https://flow.google.com/shared/tool/c056b8dd-7c23-479d-b6c1-d452c4b5b719';
const TOOL_PATH = /^\/shared\/tool\/[a-f0-9-]{36}$/i;

export const normalizeFlowToolUrl = (value: string): string | null => {
    try {
        const parsed = new URL(value.trim());
        if (parsed.protocol !== 'https:' || parsed.hostname !== 'flow.google.com' || parsed.port ||
            parsed.username || parsed.password || parsed.search || parsed.hash || !TOOL_PATH.test(parsed.pathname)) return null;
        return parsed.origin + parsed.pathname;
    } catch {
        return null;
    }
};
