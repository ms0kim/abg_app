import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, parseXmlResponse, removeDuplicatesByCoords } from '@/app/utils/apiUtils';
import { getOpenStatus, getTodayBusinessHours, getTodayTimeRaw, TimeFields } from '@/app/utils/businessHours';
import { OpenStatus, BusinessTimeRaw } from '@/app/types';
import { hospitalListCache, MemoryCache } from '@/app/utils/cache';

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

    const hasTime = !!(
        item.dutyTime1s || item.dutyTime1c ||
        item.dutyTime2s || item.dutyTime2c ||
        item.dutyTime3s || item.dutyTime3c ||
        item.dutyTime4s || item.dutyTime4c ||
        item.dutyTime5s || item.dutyTime5c ||
        item.dutyTime6s || item.dutyTime6c ||
        item.dutyTime7s || item.dutyTime7c ||
        item.dutyTime8s || item.dutyTime8c
    );

    // 실시간 계산용 원본 데이터
    const todayTimeRaw = hasTime ? getTodayTimeRaw(item, currentDate) : undefined;

    // 시간 정보가 있으면 상태 체크, 없으면 영업중으로 가정 (상세 조회 시 정확한 정보 확인 가능)
    const openStatus: OpenStatus = hasTime ? getOpenStatus(item, currentDate) : 'open';
    const isOpen = openStatus === 'open';

    return {
        id: item.hpid || `hospital_${item.latitude}_${item.longitude}`,
        type: 'hospital',
        name: item.dutyName || '이름 없음',
        lat: item.latitude,
        lng: item.longitude,
        isOpen,
        openStatus,
        address: item.dutyAddr,
        phone: item.dutyTel1,
        distance: item.distance ? Math.round(item.distance * 1000) : undefined,
        category,
        todayHours: getTodayBusinessHours(item, currentDate),
        todayTimeRaw,
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

        const currentDate = new Date();

        // 위치 기반 통합 조회 (QD 파라미터 제외하여 전체 로드)
        const allItems = await fetchHospitalsLocation(lat, lng, numOfRows);

        // B(병원), C(의원) 만 필터링
        const filteredItems = allItems.filter(item => item.dutyDiv === 'B' || item.dutyDiv === 'C');

        console.log(`API returned ${allItems.length} items. Filtered (B/C): ${filteredItems.length}`);

        // 디버깅: 시간 데이터 존재 여부 확인
        const debugTimeStats = filteredItems.map(item => ({
            name: item.dutyName,
            div: item.dutyDiv,
            hasTime: !!(item.dutyTime1s || item.dutyTime2s || item.dutyTime3s || item.dutyTime4s || item.dutyTime5s),
            Mon: `${item.dutyTime1s}~${item.dutyTime1c}`,
            Sat: `${item.dutyTime6s}~${item.dutyTime6c}`
        }));

        // 시간 정보가 없는 아이템 수
        const missingTimeCount = debugTimeStats.filter(s => !s.hasTime).length;
        console.log(`Time Data Stats: Total ${debugTimeStats.length}, Missing Time: ${missingTimeCount}`);

        if (debugTimeStats.length > 0) {
            console.log('Sample Items Time Data:', JSON.stringify(debugTimeStats.slice(0, 5), null, 2));
        }

        if (debugTimeStats.length > 0) {
            console.log('Sample Items Time Data:', JSON.stringify(debugTimeStats.slice(0, 5), null, 2));
        }

        const places = filteredItems
            .map((item) => mapItemToPlace(item, currentDate))
            .filter((place): place is PlaceResponse => place !== null);

        // ... (sorting code)

        // Debug response update
        const responseDebug = {
            totalFetched: allItems.length,
            filteredCount: filteredItems.length,
            firstItemRaw: allItems.length > 0 ? allItems[0] : null,
            filterCriteria: "dutyDiv === 'B' || dutyDiv === 'C'",
            timeStats: debugTimeStats.slice(0, 5) // Send first 5 stats
        };

        places.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        const uniquePlaces = removeDuplicatesByCoords(places);

        const openCount = uniquePlaces.filter(p => p.isOpen).length;
        const closedCount = uniquePlaces.length - openCount;
        console.log(`Found ${uniquePlaces.length} hospitals/clinics (Open: ${openCount}, Closed: ${closedCount})`);

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
