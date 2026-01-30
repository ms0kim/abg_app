import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, parseXmlResponse, removeDuplicatesByCoords } from '@/app/utils/apiUtils';
import { checkIsOpen, getTodayBusinessHours, TimeFields } from '@/app/utils/businessHours';

const SERVICE_KEY = process.env.DATA_GO_KR_SERVICE_KEY || '';
const HOSPITAL_API_URL = 'http://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncLcinfoInqire';

interface HospitalApiItem extends TimeFields {
    dutyName?: string;
    dutyAddr?: string;
    dutyTel1?: string;
    latitude?: number;
    longitude?: number;
    distance?: number;
    dutyDiv?: string;
    dutyDivName?: string;
    hpid?: string;
}

interface PlaceResponse {
    id: string;
    type: 'hospital';
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

const CATEGORY_MAP: Record<string, string> = {
    A: '종합병원',
    B: '병원',
    C: '의원',
    D: '요양병원',
    I: '기타',
};

async function fetchHospitalsLocation(
    lat: number,
    lng: number,
    numOfRows: number
): Promise<HospitalApiItem[]> {
    if (!SERVICE_KEY) {
        console.error('공공데이터 API 서비스 키가 설정되지 않았습니다.');
        return [];
    }

    const url = new URL(HOSPITAL_API_URL);
    // ServiceKey는 인코딩된 상태로 오므로 searchParams.set 대신 직접 문자열로 연결
    url.searchParams.set('WGS84_LAT', String(lat));
    url.searchParams.set('WGS84_LON', String(lng));
    url.searchParams.set('numOfRows', String(numOfRows));
    url.searchParams.set('pageNo', '1');

    const finalUrl = `${url.toString()}&ServiceKey=${SERVICE_KEY}`;

    console.log(`Fetching hospitals via Location API: lat=${lat}, lng=${lng}`);

    try {
        const response = await fetchWithRetry(finalUrl);

        if (!response.ok) {
            console.error(`Hospital Location API 응답 에러:`, response.status);
            return [];
        }

        const xmlText = await response.text();
        return parseXmlResponse<HospitalApiItem>(xmlText);
    } catch (error) {
        console.error(`Hospital Location API 호출 실패:`, error);
        return [];
    }
}

function mapItemToPlace(item: HospitalApiItem, currentDate: Date): PlaceResponse | null {
    if (!item.latitude || !item.longitude) {
        return null;
    }

    const category = CATEGORY_MAP[item.dutyDiv || ''] || item.dutyDivName || '병원';

    return {
        id: item.hpid || `hospital_${item.latitude}_${item.longitude}`,
        type: 'hospital',
        name: item.dutyName || '이름 없음',
        lat: item.latitude,
        lng: item.longitude,
        isOpen: checkIsOpen(item, currentDate),
        address: item.dutyAddr,
        phone: item.dutyTel1,
        distance: item.distance ? Math.round(item.distance * 1000) : undefined,
        category,
        todayHours: getTodayBusinessHours(item, currentDate),
    };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = parseFloat(searchParams.get('lat') || '');
        const lng = parseFloat(searchParams.get('lng') || '');
        const numOfRows = parseInt(searchParams.get('numOfRows') || '100', 10); // 한 번에 많이 가져와서 필터링

        if (isNaN(lat) || isNaN(lng)) {
            return NextResponse.json(
                { success: false, error: '유효한 lat, lng 파라미터가 필요합니다.', data: [] },
                { status: 400 }
            );
        }

        console.log(`Fetching nearby hospitals: lat=${lat}, lng=${lng}`);

        const currentDate = new Date();

        // 위치 기반 통합 조회 (QD 파라미터 제외하여 전체 로드)
        const allItems = await fetchHospitalsLocation(lat, lng, numOfRows);

        // B(병원), C(의원) 만 필터링
        const filteredItems = allItems.filter(item => item.dutyDiv === 'B' || item.dutyDiv === 'C');

        console.log(`API returned ${allItems.length} items. Filtered (B/C): ${filteredItems.length}`);

        // 디버깅: 첫 번째 아이템의 dutyTime 필드 확인
        if (filteredItems.length > 0) {
            console.log('Sample item dutyTime:', {
                name: filteredItems[0].dutyName,
                time1s: filteredItems[0].dutyTime1s,
                time1c: filteredItems[0].dutyTime1c
            });
        }

        const places = filteredItems
            .map((item) => mapItemToPlace(item, currentDate))
            .filter((place): place is PlaceResponse => place !== null);

        // 거리순 정렬 및 중복 제거
        places.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        const uniquePlaces = removeDuplicatesByCoords(places);

        const openCount = uniquePlaces.filter(p => p.isOpen).length;
        const closedCount = uniquePlaces.length - openCount;
        console.log(`Found ${uniquePlaces.length} hospitals/clinics (Open: ${openCount}, Closed: ${closedCount})`);

        return NextResponse.json({
            success: true,
            count: uniquePlaces.length,
            debug: {
                totalFetched: allItems.length,
                filteredCount: filteredItems.length,
                firstItemRaw: allItems.length > 0 ? allItems[0] : null,
                filterCriteria: "dutyDiv === 'B' || dutyDiv === 'C'"
            },
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
