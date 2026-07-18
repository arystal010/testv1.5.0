// worker/cache.js
//
// Simple in-memory cache — v1.5.1
// Key-value cache with TTL for search results and API responses

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 500;

export class MemoryCache {
    constructor(ttl = DEFAULT_TTL) {
        this._cache = new Map();
        this._ttl = ttl;
    }

    // ============================================================
    // Get a value from cache
    // ============================================================
    get(key) {
        const entry = this._cache.get(key);
        if (!entry) return null;

        // Check TTL
        if (Date.now() > entry.expires) {
            this._cache.delete(key);
            return null;
        }

        return entry.value;
    }

    // ============================================================
    // Set a value in cache
    // ============================================================
    set(key, value, ttl = this._ttl) {
        // Evict oldest entry if at capacity
        if (this._cache.size >= MAX_ENTRIES) {
            const oldestKey = this._cache.keys().next().value;
            this._cache.delete(oldestKey);
        }

        this._cache.set(key, {
            value,
            expires: Date.now() + ttl,
            created: Date.now(),
        });
    }

    // ============================================================
    // Delete a specific key
    // ============================================================
    delete(key) {
        this._cache.delete(key);
    }

    // ============================================================
    // Clear all cache entries
    // ============================================================
    clear() {
        this._cache.clear();
    }

    // ============================================================
    // Get cache stats
    // ============================================================
    stats() {
        const now = Date.now();
        let valid = 0;
        let expired = 0;

        for (const entry of this._cache.values()) {
            if (now > entry.expires) {
                expired++;
            } else {
                valid++;
            }
        }

        return {
            size: this._cache.size,
            valid,
            expired,
            maxEntries: MAX_ENTRIES,
        };
    }
}

// ============================================================
// Global singleton
// ============================================================
export const defaultCache = new MemoryCache();