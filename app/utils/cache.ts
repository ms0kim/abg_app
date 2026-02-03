/**
 * 간단한 메모리 캐시 유틸리티
 * 서버 사이드에서 API 응답을 캐싱하여 성능 향상
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

class MemoryCache<T> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private readonly ttlMs: number;
    private readonly maxSize: number;

    constructor(ttlSeconds: number = 60, maxSize: number = 100) {
        this.ttlMs = ttlSeconds * 1000;
        this.maxSize = maxSize;
    }

    /**
     * 캐시 키 생성 (좌표 기반)
     */
    static createLocationKey(lat: number, lng: number, precision: number = 3): string {
        // 좌표를 소수점 precision 자리까지만 사용하여 키 생성
        // precision=3이면 약 100m 범위 내 요청은 같은 캐시 사용
        const roundedLat = lat.toFixed(precision);
        const roundedLng = lng.toFixed(precision);
        return `${roundedLat},${roundedLng}`;
    }

    get(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // TTL 체크
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    set(key: string, data: T): void {
        // 캐시 크기 제한
        if (this.cache.size >= this.maxSize) {
            // 가장 오래된 엔트리 삭제
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

// 병원 목록 캐시 (60초 TTL)
export const hospitalListCache = new MemoryCache<unknown[]>(60, 50);

// 약국 목록 캐시 (60초 TTL)
export const pharmacyListCache = new MemoryCache<unknown[]>(60, 50);

// 병원 상세 캐시 (5분 TTL)
export const hospitalDetailCache = new MemoryCache<unknown>(300, 200);

export { MemoryCache };
