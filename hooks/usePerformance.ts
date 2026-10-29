/**
 * Performance optimization hooks
 * These hooks help reduce unnecessary re-renders and improve app performance
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

/**
 * Debounced state - delays state updates to reduce re-renders during rapid changes
 * Useful for inputs, search, etc.
 */
export const useDebouncedState = <T,>(initialValue: T, delay: number = 300): [T, T, (value: T) => void] => {
    const [value, setValue] = useState<T>(initialValue);
    const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
    const timeoutRef = useRef<NodeJS.Timeout>();

    const setValueDebounced = useCallback((newValue: T) => {
        setValue(newValue);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            setDebouncedValue(newValue);
        }, delay);
    }, [delay]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return [value, debouncedValue, setValueDebounced];
};

/**
 * Throttled callback - limits how often a function can be called
 * Useful for scroll handlers, resize, etc.
 */
export const useThrottledCallback = <T extends (...args: any[]) => void>(
    callback: T,
    delay: number = 100
): T => {
    const lastRun = useRef(Date.now());
    const timeoutRef = useRef<NodeJS.Timeout>();

    return useCallback((...args: Parameters<T>) => {
        const now = Date.now();
        if (now - lastRun.current >= delay) {
            callback(...args);
            lastRun.current = now;
        } else {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                callback(...args);
                lastRun.current = Date.now();
            }, delay - (now - lastRun.current));
        }
    }, [callback, delay]) as T;
};

/**
 * Previous value hook - tracks the previous value of a state
 * Useful for detecting changes without triggering re-renders
 */
export const usePrevious = <T,>(value: T): T | undefined => {
    const ref = useRef<T>();
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
};

/**
 * Stable callback - creates a stable reference to a callback
 * Prevents child components from re-rendering when parent re-renders
 */
export const useStableCallback = <T extends (...args: any[]) => any>(callback: T): T => {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    return useCallback((...args: Parameters<T>) => {
        return callbackRef.current(...args);
    }, []) as T;
};

/**
 * Mount state - tracks if component is still mounted
 * Useful for async operations to prevent state updates on unmounted components
 */
export const useMounted = (): { current: boolean } => {
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    return mounted;
};

/**
 * Local storage state - persists state to localStorage
 * Memoized to prevent unnecessary reads
 */
export const useLocalStorageState = <T,>(
    key: string,
    initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] => {
    const [state, setState] = useState<T>(() => {
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : initialValue;
        } catch {
            return initialValue;
        }
    });

    const setValue = useCallback((value: T | ((prev: T) => T)) => {
        setState(prev => {
            const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
            try {
                localStorage.setItem(key, JSON.stringify(newValue));
            } catch (e) {
                console.warn('Failed to save to localStorage:', e);
            }
            return newValue;
        });
    }, [key]);

    return [state, setValue];
};

/**
 * Intersection Observer hook for lazy loading
 * Only render content when it's visible in viewport
 */
export const useIntersectionObserver = (
    options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement>, boolean] => {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect(); // Once visible, stop observing
            }
        }, { threshold: 0.1, ...options });

        observer.observe(element);
        return () => observer.disconnect();
    }, [options]);

    return [ref, isVisible];
};

export default {
    useDebouncedState,
    useThrottledCallback,
    usePrevious,
    useStableCallback,
    useMounted,
    useLocalStorageState,
    useIntersectionObserver
};
