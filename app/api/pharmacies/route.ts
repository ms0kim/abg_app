import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, parseXmlResponse, removeDuplicatesByCoords } from '@/app/utils/apiUtils';

const SERVICE_KEY = process.env.NEXT_PUBLIC_DATA_GO_KR_SERVICE_KEY || '';

// 좌표 기반 약국 검색 API (getParmacyLcinfoInqire)
const PHARMACY_LOCATION_API = 'http://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyLcinfoInqire';

// 좌표 기반 API 응답 타입 (필드명이 다름, XML 파서가 타입을 자동 변환할 수 있음)
interface PharmacyLocationApiItem {
    dutyName?: string;
    dutyAddr?: string;
    dutyTel1?: string;
    latitude?: number | string;
    longitude?: number | string;
    distance?: number;
    hpid?: string;
    startTime?: string | number;
    endTime?: string | number;
    dutyDiv?: string;
    dutyDivName?: string;
}

interface PlaceResponse {
    id: string;
    type: 'pharmacy';
    name: string;
    lat: number;
    lng: number;
    isOpen: boolean;
    address?: string;
    phone?: string;
    distance?: number;
    category?: string;
    todayHours?: { open: string; close: string } | null;
}

/**
 * 시간을 분 단위로 파싱 (숫자 또는 문자열 지원)
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
 * 현재 영업 중인지 확인
 */
function checkIsOpen(startTime?: string | number, endTime?: string | number): boolean {
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);

    if (startMinutes === null || endMinutes === null) return true; // 정보 없으면 영업 중으로 가정

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 24시간 운영 또는 익일 종료
    if (endMinutes <= startMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * 좌표 기반 약국 검색 (getParmacyLcinfoInqire)
 */
async function fetchPharmaciesByLocation(
    lat: number,
    lng: number,
    numOfRows: number
): Promise<PharmacyLocationApiItem[]> {
    if (!SERVICE_KEY) {
        console.error('공공데이터 API 서비스 키가 설정되지 않았습니다.');
        return [];
    }

    const url = new URL(PHARMACY_LOCATION_API);
    url.searchParams.set('WGS84_LON', String(lng));
    url.searchParams.set('WGS84_LAT', String(lat));
    url.searchParams.set('numOfRows', String(numOfRows));
    url.searchParams.set('pageNo', '1');

    const finalUrl = `${url.toString()}&ServiceKey=${SERVICE_KEY}`;

    console.log(`Fetching pharmacies by location: lat=${lat}, lng=${lng}`);

    try {
        const response = await fetchWithRetry(finalUrl);

        if (!response.ok) {
            console.error('약국 API 응답 에러:', response.status);
            return [];
        }

        const xmlText = await response.text();
        return parseXmlResponse<PharmacyLocationApiItem>(xmlText);
    } catch (error) {
        console.error('약국 API 호출 실패:', error);
        return [];
    }
}

function mapItemToPlace(item: PharmacyLocationApiItem): PlaceResponse | null {
    // 좌표 기반 API는 latitude/longitude 필드 사용
    if (!item.latitude || !item.longitude) {
        return null;
    }

    // 숫자로 변환 (XML 파서가 문자열로 반환할 수 있음)
    const lat = typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude;
    const lng = typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude;

    const isOpen = checkIsOpen(item.startTime, item.endTime);
    const todayHours = item.startTime && item.endTime
        ? { open: formatTime(item.startTime), close: formatTime(item.endTime) }
        : null;

    return {
        id: item.hpid || `pharmacy_${lat}_${lng}`,
        type: 'pharmacy',
        name: item.dutyName || '이름 없음',
        lat,
        lng,
        isOpen,
        address: item.dutyAddr,
        phone: item.dutyTel1,
        distance: item.distance ? Math.round(item.distance * 1000) : undefined,
        category: '약국',
        todayHours,
    };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = parseFloat(searchParams.get('lat') || '');
        const lng = parseFloat(searchParams.get('lng') || '');
        const numOfRows = parseInt(searchParams.get('numOfRows') || '50', 10);

        if (isNaN(lat) || isNaN(lng)) {
            return NextResponse.json(
                { success: false, error: '유효한 lat, lng 파라미터가 필요합니다.', data: [] },
                { status: 400 }
            );
        }

        console.log(`Fetching nearby pharmacies: lat=${lat}, lng=${lng}`);

        const pharmacies = await fetchPharmaciesByLocation(lat, lng, numOfRows);

        const places = pharmacies
            .map((item) => mapItemToPlace(item))
            .filter((place): place is PlaceResponse => place !== null);

        // 거리순 정렬 및 중복 제거
        places.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        const uniquePlaces = removeDuplicatesByCoords(places);

        console.log(`Found ${uniquePlaces.length} pharmacies`);

        return NextResponse.json({
            success: true,
            count: uniquePlaces.length,
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
