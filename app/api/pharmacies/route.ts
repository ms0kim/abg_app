import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, parseXmlResponse, removeDuplicatesByCoords, fetchWithPagination } from '@/app/utils/apiUtils';
import { OpenStatus, BusinessTimeRaw } from '@/app/types';
import { pharmacyListCache } from '@/app/utils/cache';

const SERVICE_KEY = process.env.DATA_GO_KR_SERVICE_KEY || '';
const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

// 약국 목록정보 조회 API (주소 기반, 요일별 영업시간 포함)
const PHARMACY_LIST_API = 'http://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyListInfoInqire';

// API 응답 타입 (목록정보 조회)
interface PharmacyListApiItem {
    hpid?: string;
    dutyName?: string;
    dutyAddr?: string;
    dutyTel1?: string;
    wgs84Lat?: number | string;
    wgs84Lon?: number | string;
    // 요일별 영업시간 (1:월 ~ 7:일, 8:공휴일)
    dutyTime1s?: string | number;
    dutyTime1c?: string | number;
    dutyTime2s?: string | number;
    dutyTime2c?: string | number;
    dutyTime3s?: string | number;
    dutyTime3c?: string | number;
    dutyTime4s?: string | number;
    dutyTime4c?: string | number;
    dutyTime5s?: string | number;
    dutyTime5c?: string | number;
    dutyTime6s?: string | number;
    dutyTime6c?: string | number;
    dutyTime7s?: string | number;
    dutyTime7c?: string | number;
    dutyTime8s?: string | number;
    dutyTime8c?: string | number;
}

interface PlaceResponse {
    id: string;
    type: 'pharmacy';
    name: string;
    lat: number;
    lng: number;
    isOpen: boolean;
    openStatus: OpenStatus;
    address?: string;
    phone?: string;
    distance?: number;
    category?: string;
    todayHours?: { open: string; close: string } | null;
    todayTimeRaw?: BusinessTimeRaw;
}

/**
 * 좌표를 주소로 변환 (네이버 역지오코딩)
 */
async function reverseGeocode(lat: number, lng: number): Promise<{ sido: string; sigungu: string } | null> {
    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
        console.error('네이버 API 키가 설정되지 않았습니다.');
        return null;
    }

    try {
        const response = await fetch(
            `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&output=json&orders=admcode`,
            {
                headers: {
                    'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
                    'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
                },
            }
        );

        if (!response.ok) {
            console.error('역지오코딩 실패:', response.status);
            return null;
        }

        const data = await response.json();
        const result = data.results?.[0];

        if (!result) {
            return null;
        }

        const sido = result.region?.area1?.name || '';
        const sigungu = result.region?.area2?.name || '';

        return { sido, sigungu };
    } catch (error) {
        console.error('역지오코딩 에러:', error);
        return null;
    }
}

/**
 * 시간을 분 단위로 파싱
 */
function parseTimeToMinutes(time: string | number | undefined): number | null {
    if (time === undefined || time === null || time === '') return null;

    const str = String(time).padStart(4, '0');
    const hours = parseInt(str.substring(0, 2), 10);
    const minutes = parseInt(str.substring(2, 4), 10);

    if (isNaN(hours) || isNaN(minutes)) return null;

    return hours * 60 + minutes;
}

/**
 * 시간을 읽기 좋은 형식으로 변환
 */
function formatTime(time: string | number | undefined): string {
    if (time === undefined || time === null || time === '') return '-';

    const str = String(time).padStart(4, '0');
    const hours = parseInt(str.substring(0, 2), 10);
    const minutes = parseInt(str.substring(2, 4), 10);

    if (isNaN(hours) || isNaN(minutes)) return '-';

    const period = hours >= 12 ? '오후' : '오전';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const displayMinutes = minutes.toString().padStart(2, '0');

    return `${period} ${displayHours}:${displayMinutes}`;
}

/**
 * 오늘 요일에 해당하는 영업시간 가져오기
 */
function getTodayBusinessTime(item: PharmacyListApiItem): { startTime?: string | number; endTime?: string | number } {
    const today = new Date().getDay(); // 0:일, 1:월, 2:화, ... 6:토

    const dayMap: Record<number, { start: string | number | undefined; end: string | number | undefined }> = {
        0: { start: item.dutyTime7s, end: item.dutyTime7c }, // 일요일
        1: { start: item.dutyTime1s, end: item.dutyTime1c }, // 월요일
        2: { start: item.dutyTime2s, end: item.dutyTime2c },
        3: { start: item.dutyTime3s, end: item.dutyTime3c },
        4: { start: item.dutyTime4s, end: item.dutyTime4c },
        5: { start: item.dutyTime5s, end: item.dutyTime5c },
        6: { start: item.dutyTime6s, end: item.dutyTime6c }, // 토요일
    };

    const times = dayMap[today];
    return { startTime: times?.start, endTime: times?.end };
}

/**
 * 영업 상태 및 원본 데이터 반환
 */
function getStatusAndTimeRaw(startTime?: string | number, endTime?: string | number): {
    isOpen: boolean;
    openStatus: OpenStatus;
    todayTimeRaw: BusinessTimeRaw;
} {
    const openMinutes = parseTimeToMinutes(startTime);
    const closeMinutes = parseTimeToMinutes(endTime);

    // 영업시간 정보 없음 - 오늘 휴무
    if (openMinutes === null || closeMinutes === null) {
        return {
            isOpen: false,
            openStatus: 'holiday',
            todayTimeRaw: { openMinutes: null, closeMinutes: null, isHoliday: true }
        };
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayTimeRaw: BusinessTimeRaw = { openMinutes, closeMinutes, isHoliday: false };

    // 24시간 운영 또는 익일 종료
    if (closeMinutes <= openMinutes) {
        const isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes;
        return { isOpen, openStatus: isOpen ? 'open' : 'closed', todayTimeRaw };
    }

    const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    return { isOpen, openStatus: isOpen ? 'open' : 'closed', todayTimeRaw };
}

/**
 * 주소 기반 약국 목록 조회
 */
async function fetchPharmaciesByAddress(
    sido: string,
    sigungu: string,
    numOfRows: number
): Promise<PharmacyListApiItem[]> {
    if (!SERVICE_KEY) {
        console.error('공공데이터 API 서비스 키가 설정되지 않았습니다.');
        return [];
    }

    const url = new URL(PHARMACY_LIST_API);
    url.searchParams.set('Q0', sido);
    url.searchParams.set('Q1', sigungu);
    url.searchParams.set('numOfRows', String(numOfRows));
    url.searchParams.set('pageNo', '1');

    const finalUrl = `${url.toString()}&ServiceKey=${SERVICE_KEY}`;

    console.log(`Fetching pharmacies: ${sido} ${sigungu}`);

    try {
        return fetchWithPagination<PharmacyListApiItem>(finalUrl, numOfRows, 300);
    } catch (error) {
        console.error('약국 API 호출 실패:', error);
        return [];
    }
}

/**
 * 두 좌표 사이의 거리 계산 (미터)
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

function mapItemToPlace(item: PharmacyListApiItem, userLat: number, userLng: number): PlaceResponse | null {
    if (!item.wgs84Lat || !item.wgs84Lon) {
        return null;
    }

    const lat = typeof item.wgs84Lat === 'string' ? parseFloat(item.wgs84Lat) : item.wgs84Lat;
    const lng = typeof item.wgs84Lon === 'string' ? parseFloat(item.wgs84Lon) : item.wgs84Lon;

    if (isNaN(lat) || isNaN(lng)) {
        return null;
    }

    const { startTime, endTime } = getTodayBusinessTime(item);
    const { isOpen, openStatus, todayTimeRaw } = getStatusAndTimeRaw(startTime, endTime);

    const todayHours = startTime && endTime
        ? { open: formatTime(startTime), close: formatTime(endTime) }
        : null;

    const distance = calculateDistance(userLat, userLng, lat, lng);

    return {
        id: item.hpid || `pharmacy_${lat}_${lng}`,
        type: 'pharmacy',
        name: item.dutyName || '이름 없음',
        lat,
        lng,
        isOpen,
        openStatus,
        address: item.dutyAddr,
        phone: item.dutyTel1,
        distance,
        category: '약국',
        todayHours,
        todayTimeRaw,
    };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = parseFloat(searchParams.get('lat') || '');
        const lng = parseFloat(searchParams.get('lng') || '');
        // 거리순 정렬되므로 가까운 곳 위주로 가져옴 (API 호출 최소화)
        const numOfRows = parseInt(searchParams.get('numOfRows') || '150', 10);

        if (isNaN(lat) || isNaN(lng)) {
            return NextResponse.json(
                { success: false, error: '유효한 lat, lng 파라미터가 필요합니다.', data: [] },
                { status: 400 }
            );
        }

        // 좌표를 주소로 변환 (캐시 키 생성 전에 필요)
        const address = await reverseGeocode(lat, lng);

        if (!address) {
            return NextResponse.json({
                success: false,
                error: '주소를 찾을 수 없습니다.',
                data: [],
            });
        }

        // 캐시 키 생성 (시/군/구 기반 - 같은 지역에서는 API 재호출 방지)
        const cacheKey = `${address.sido}_${address.sigungu}`;
        const cachedData = pharmacyListCache.get(cacheKey) as PlaceResponse[] | null;

        if (cachedData) {
            console.log(`[CACHE HIT] Pharmacies at ${cacheKey}, ${cachedData.length} items`);
            // 캐시된 데이터도 현재 위치 기준으로 거리 재계산
            const updatedData = cachedData.map(place => ({
                ...place,
                distance: calculateDistance(lat, lng, place.lat, place.lng)
            }));
            updatedData.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
            return NextResponse.json({
                success: true,
                count: updatedData.length,
                cached: true,
                data: updatedData,
            });
        }

        console.log(`[CACHE MISS] Fetching pharmacies: ${address.sido} ${address.sigungu}`);

        const pharmacies = await fetchPharmaciesByAddress(address.sido, address.sigungu, numOfRows);
        console.log(`API returned ${pharmacies.length} pharmacies`);

        const places = pharmacies
            .map((item) => mapItemToPlace(item, lat, lng))
            .filter((place): place is PlaceResponse => place !== null);

        // 거리순 정렬 및 중복 제거
        places.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        const uniquePlaces = removeDuplicatesByCoords(places);

        const openCount = uniquePlaces.filter(p => p.isOpen).length;
        const closedCount = uniquePlaces.filter(p => p.openStatus === 'closed').length;
        const holidayCount = uniquePlaces.filter(p => p.openStatus === 'holiday').length;
        console.log(`Found ${uniquePlaces.length} pharmacies (Open: ${openCount}, Closed: ${closedCount}, Holiday: ${holidayCount})`);

        // 캐시에 저장
        pharmacyListCache.set(cacheKey, uniquePlaces);

        return NextResponse.json({
            success: true,
            count: uniquePlaces.length,
            cached: false,
            data: uniquePlaces,
        });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: '서버 오류가 발생했습니다.', data: [] },
            { status: 500 }
        );
    }
}
