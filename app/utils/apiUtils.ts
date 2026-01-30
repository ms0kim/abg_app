import { XMLParser } from 'fast-xml-parser';

// XML 파서 인스턴스 (싱글톤)
export const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseTagValue: true,
    trimValues: true,
});

/**
 * 리트라이 옵션
 */
interface FetchWithRetryOptions {
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
}

/**
 * 리트라이 로직이 포함된 fetch
 */
export async function fetchWithRetry(
    url: string,
    options: FetchWithRetryOptions = {}
): Promise<Response> {
    const { maxRetries = 2, retryDelay = 500, timeout = 10000 } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            // 5xx 에러는 리트라이
            if (response.status >= 500 && attempt < maxRetries) {
                console.log(`서버 에러 ${response.status}, 재시도 ${attempt + 1}/${maxRetries}`);
                await delay(retryDelay * (attempt + 1));
                continue;
            }

            return response;
        } catch (error) {
            lastError = error as Error;

            if (attempt < maxRetries) {
                console.log(`요청 실패, 재시도 ${attempt + 1}/${maxRetries}:`, error);
                await delay(retryDelay * (attempt + 1));
            }
        }
    }

    throw lastError || new Error('요청 실패');
}

/**
 * 지연 함수
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * XML 응답을 파싱하여 아이템 배열 반환
 */
export function parseXmlResponse<T>(xmlText: string): T[] {
    // 에러 메시지 확인
    if (
        xmlText.includes('Unexpected errors') ||
        xmlText.includes('SERVICE_KEY_IS_NOT_REGISTERED') ||
        xmlText.includes('SERVICE ERROR')
    ) {
        console.error('API 에러 응답:', xmlText.substring(0, 200));
        return [];
    }

    try {
        const jsonData = xmlParser.parse(xmlText);
        const items = jsonData?.response?.body?.items?.item;

        if (!items) {
            return [];
        }

        // 단일 아이템인 경우 배열로 변환
        return Array.isArray(items) ? items : [items];
    } catch (error) {
        console.error('XML 파싱 실패:', error);
        return [];
    }
}

/**
 * 중복 제거 (좌표 기준)
 */
export function removeDuplicatesByCoords<T extends { lat: number; lng: number }>(
    places: T[]
): T[] {
    return places.filter(
        (place, index, self) =>
            index === self.findIndex((p) => p.lat === place.lat && p.lng === place.lng)
    );
}
