import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, parseXmlResponse, removeDuplicatesByCoords } from '@/app/utils/apiUtils';
import { OpenStatus, BusinessTimeRaw } from '@/app/types';
import { hospitalListCache, MemoryCache } from '@/app/utils/cache';

const SERVICE_KEY = process.env.DATA_GO_KR_SERVICE_KEY || '';

// 좌표 기반 병원 검색 API (시간 정보 포함)
const HOSPITAL_LOCATION_API = 'http://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncLcinfoInqire';

// API 응답 타입
interface HospitalApiItem {
    dutyName?: string;
    dutyAddr?: string;
    dutyTel1?: string;
    latitude?: number | string;
    longitude?: number | string;
    distance?: number;
    hpid?: string;
    dutyDiv?: string;
    dutyDivName?: string;
    // 오늘의 영업시간 (위치 API에서 제공)
    startTime?: string | number;
    endTime?: string | number;
}

interface PlaceResponse {
    id: string;
    type: 'hospital';
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

const CATEGORY_MAP: Record<string, string> = {
    A: '종합병원',
    B: '병원',
    C: '의원',
    D: '요양병원',
    I: '기타',
};

/**
 * 시간을 분 단위로 파싱
 */
function parseTimeToMinutes(time: string | number | undefined): number | null {
    if (time === undefined || time === null) return null;

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
    if (time === undefined || time === null) return '-';

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
 * 영업 상태 및 원본 데이터 반환
 */
function getStatusAndTimeRaw(startTime?: string | number, endTime?: string | number): {
    isOpen: boolean;
    openStatus: OpenStatus;
    todayTimeRaw: BusinessTimeRaw;
} {
    const openMinutes = parseTimeToMinutes(startTime);
    const closeMinutes = parseTimeToMinutes(endTime);

    // 영업시간 정보 없음 - 영업중으로 가정
    if (openMinutes === null || closeMinutes === null) {
        return {
            isOpen: true,
            openStatus: 'open',
            todayTimeRaw: { openMinutes: null, closeMinutes: null, isHoliday: false }
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
 * 좌표 기반 병원 검색
 */
async function fetchHospitalsByLocation(
    lat: number,
    lng: number,
    numOfRows: number
): Promise<HospitalApiItem[]> {
    if (!SERVICE_KEY) {
        console.error('공공데이터 API 서비스 키가 설정되지 않았습니다.');
        return [];
    }

    const url = new URL(HOSPITAL_LOCATION_API);
    url.searchParams.set('WGS84_LAT', String(lat));
    url.searchParams.set('WGS84_LON', String(lng));
    url.searchParams.set('numOfRows', String(numOfRows));
    url.searchParams.set('pageNo', '1');

    const finalUrl = `${url.toString()}&ServiceKey=${SERVICE_KEY}`;

    console.log(`Fetching hospitals by location: lat=${lat}, lng=${lng}`);

    try {
        const response = await fetchWithRetry(finalUrl);

        if (!response.ok) {
            console.error('병원 API 응답 에러:', response.status);
            return [];
        }

        const xmlText = await response.text();
        return parseXmlResponse<HospitalApiItem>(xmlText);
    } catch (error) {
        console.error('병원 API 호출 실패:', error);
        return [];
    }
}

function mapItemToPlace(item: HospitalApiItem): PlaceResponse | null {
    if (!item.latitude || !item.longitude) {
        return null;
    }

    // 숫자로 변환
    const lat = typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude;
    const lng = typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude;

    const category = CATEGORY_MAP[item.dutyDiv || ''] || item.dutyDivName || '병원';

    // 영업 상태 계산 (startTime, endTime 사용)
    const { isOpen, openStatus, todayTimeRaw } = getStatusAndTimeRaw(item.startTime, item.endTime);
    const todayHours = item.startTime && item.endTime
        ? { open: formatTime(item.startTime), close: formatTime(item.endTime) }
        : null;

    return {
        id: item.hpid || `hospital_${lat}_${lng}`,
        type: 'hospital',
        name: item.dutyName || '이름 없음',
        lat,
        lng,
        isOpen,
        openStatus,
        address: item.dutyAddr,
        phone: item.dutyTel1,
        distance: item.distance ? Math.round(item.distance * 1000) : undefined,
        category,
        todayHours,
        todayTimeRaw,
    };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = parseFloat(searchParams.get('lat') || '');
        const lng = parseFloat(searchParams.get('lng') || '');
        const numOfRows = parseInt(searchParams.get('numOfRows') || '100', 10);

        if (isNaN(lat) || isNaN(lng)) {
            return NextResponse.json(
                { success: false, error: '유효한 lat, lng 파라미터가 필요합니다.', data: [] },
                { status: 400 }
            );
        }

        // 캐시 키 생성 (소수점 3자리 = 약 100m 범위)
        const cacheKey = MemoryCache.createLocationKey(lat, lng, 3);
        const cachedData = hospitalListCache.get(cacheKey) as PlaceResponse[] | null;

        if (cachedData) {
            console.log(`[CACHE HIT] Hospitals at ${cacheKey}, ${cachedData.length} items`);
            return NextResponse.json({
                success: true,
                count: cachedData.length,
                cached: true,
                data: cachedData,
            });
        }

        console.log(`[CACHE MISS] Fetching nearby hospitals: lat=${lat}, lng=${lng}`);

        const hospitals = await fetchHospitalsByLocation(lat, lng, numOfRows);

        // B(병원), C(의원) 만 필터링
        const filteredHospitals = hospitals.filter(item => item.dutyDiv === 'B' || item.dutyDiv === 'C');

        console.log(`API returned ${hospitals.length} items. Filtered (B/C): ${filteredHospitals.length}`);

        const places = filteredHospitals
            .map((item) => mapItemToPlace(item))
            .filter((place): place is PlaceResponse => place !== null);

        // 거리순 정렬 및 중복 제거
        places.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        const uniquePlaces = removeDuplicatesByCoords(places);

        const openCount = uniquePlaces.filter(p => p.isOpen).length;
        console.log(`Found ${uniquePlaces.length} hospitals (Open: ${openCount}, Closed: ${uniquePlaces.length - openCount})`);

        // 캐시에 저장
        hospitalListCache.set(cacheKey, uniquePlaces);

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
