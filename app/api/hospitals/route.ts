import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, parseXmlResponse, removeDuplicatesByCoords } from '@/app/utils/apiUtils';
import { OpenStatus, BusinessTimeRaw } from '@/app/types';
import { hospitalListCache, MemoryCache } from '@/app/utils/cache';

const SERVICE_KEY = process.env.DATA_GO_KR_SERVICE_KEY || '';
const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

// 병·의원 목록정보 조회 API (주소 기반, 요일별 영업시간 포함)
const HOSPITAL_LIST_API = 'http://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncListInfoInqire';

// API 응답 타입 (목록정보 조회)
interface HospitalListApiItem {
    hpid?: string;
    dutyName?: string;
    dutyAddr?: string;
    dutyTel1?: string;
    dutyDiv?: string;
    dutyDivName?: string;
    wgs84Lat?: number | string;
    wgs84Lon?: number | string;
    // 요일별 영업시간 (1:월 ~ 7:일, 8:공휴일)
    dutyTime1s?: string | number; // 월요일 시작
    dutyTime1c?: string | number; // 월요일 종료
    dutyTime2s?: string | number;
    dutyTime2c?: string | number;
    dutyTime3s?: string | number;
    dutyTime3c?: string | number;
    dutyTime4s?: string | number;
    dutyTime4c?: string | number;
    dutyTime5s?: string | number;
    dutyTime5c?: string | number;
    dutyTime6s?: string | number; // 토요일
    dutyTime6c?: string | number;
    dutyTime7s?: string | number; // 일요일
    dutyTime7c?: string | number;
    dutyTime8s?: string | number; // 공휴일
    dutyTime8c?: string | number;
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
function getTodayBusinessTime(item: HospitalListApiItem): { startTime?: string | number; endTime?: string | number } {
    const today = new Date().getDay(); // 0:일, 1:월, 2:화, ... 6:토

    // 공휴일 체크는 별도 API가 필요하므로 일단 요일만 처리
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
 * 주소 기반 병원 목록 조회
 */
async function fetchHospitalsByAddress(
    sido: string,
    sigungu: string,
    numOfRows: number
): Promise<HospitalListApiItem[]> {
    if (!SERVICE_KEY) {
        console.error('공공데이터 API 서비스 키가 설정되지 않았습니다.');
        return [];
    }

    const url = new URL(HOSPITAL_LIST_API);
    url.searchParams.set('Q0', sido);
    url.searchParams.set('Q1', sigungu);
    // QZ 파라미터는 아래에서 개별 설정
    url.searchParams.set('numOfRows', String(numOfRows));
    url.searchParams.set('pageNo', '1');

    const baseUrl = url.toString();

    console.log(`Fetching hospitals: ${sido} ${sigungu}`);

    try {
        // 병원(B)과 의원(C) 병렬 조회
        // 서비스 키는 이미 인코딩되어 있다고 가정하고 수동으로 붙임 (URL 객체 사용 시 이중 인코딩 주의)
        const getUrl = (type: string) => {
            const u = new URL(baseUrl);
            u.searchParams.set('QZ', type);
            return `${u.toString()}&ServiceKey=${SERVICE_KEY}`;
        };

        const [hospitalsA, hospitalsB, hospitalsC] = await Promise.all([
            fetchHospitalList(getUrl('A')), // 종합병원
            fetchHospitalList(getUrl('B')), // 병원
            fetchHospitalList(getUrl('C')), // 의원
        ]);

        return [...hospitalsA, ...hospitalsB, ...hospitalsC];
    } catch (error) {
        console.error('병원 API 호출 실패:', error);
        return [];
    }
}

async function fetchHospitalList(url: string): Promise<HospitalListApiItem[]> {
    try {
        // 첫 페이지 요청
        const firstResponse = await fetchWithRetry(url);
        if (!firstResponse.ok) return [];

        const firstXml = await firstResponse.text();
        const { items: firstItems, totalCount } = parseXmlResponse<HospitalListApiItem>(firstXml);

        console.log(`Hospital API Total Count: ${totalCount} (First fetch: ${firstItems.length})`);

        if (totalCount <= firstItems.length) {
            return firstItems;
        }

        // 추가 페이지 계산 (최대 2000개 제한)
        const numOfRows = 500; // 현재 설정된 numOfRows와 맞춰야 함 (URL 파싱해서 확인하거나 상수로 관리 권장)
        const maxItems = 2000;
        const targetCount = Math.min(totalCount, maxItems);
        const totalPages = Math.ceil(targetCount / numOfRows);

        const promises: Promise<HospitalListApiItem[]>[] = [];

        for (let page = 2; page <= totalPages; page++) {
            const pageUrl = url.replace('pageNo=1', `pageNo=${page}`);
            promises.push(
                fetchWithRetry(pageUrl)
                    .then(res => res.text())
                    .then(xml => parseXmlResponse<HospitalListApiItem>(xml).items)
                    .catch(err => {
                        console.error(`Page ${page} fetch failed:`, err);
                        return [];
                    })
            );
        }

        const restItems = await Promise.all(promises);
        return [...firstItems, ...restItems.flat()];

    } catch (error) {
        console.error('병원 API 호출 실패:', error);
        return [];
    }
}

/**
 * 두 좌표 사이의 거리 계산 (미터)
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // 지구 반경 (미터)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

function mapItemToPlace(item: HospitalListApiItem, userLat: number, userLng: number): PlaceResponse | null {
    if (!item.wgs84Lat || !item.wgs84Lon) {
        return null;
    }

    const lat = typeof item.wgs84Lat === 'string' ? parseFloat(item.wgs84Lat) : item.wgs84Lat;
    const lng = typeof item.wgs84Lon === 'string' ? parseFloat(item.wgs84Lon) : item.wgs84Lon;

    if (isNaN(lat) || isNaN(lng)) {
        return null;
    }

    const category = CATEGORY_MAP[item.dutyDiv || ''] || item.dutyDivName || '병원';
    const { startTime, endTime } = getTodayBusinessTime(item);
    const { isOpen, openStatus, todayTimeRaw } = getStatusAndTimeRaw(startTime, endTime);

    const todayHours = startTime && endTime
        ? { open: formatTime(startTime), close: formatTime(endTime) }
        : null;

    const distance = calculateDistance(userLat, userLng, lat, lng);

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
        distance,
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
        // 시/군/구 단위 검색이므로 충분한 데이터를 가져오기 위해 기본값을 500으로 설정
        const numOfRows = parseInt(searchParams.get('numOfRows') || '500', 10);

        if (isNaN(lat) || isNaN(lng)) {
            return NextResponse.json(
                { success: false, error: '유효한 lat, lng 파라미터가 필요합니다.', data: [] },
                { status: 400 }
            );
        }

        // 캐시 키 생성 (소수점 2자리 = 약 1km 범위)
        const cacheKey = MemoryCache.createLocationKey(lat, lng, 2);
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

        // 좌표를 주소로 변환
        const address = await reverseGeocode(lat, lng);

        if (!address) {
            return NextResponse.json({
                success: false,
                error: '주소를 찾을 수 없습니다.',
                data: [],
            });
        }

        console.log(`[CACHE MISS] Fetching hospitals: ${address.sido} ${address.sigungu}`);

        const hospitals = await fetchHospitalsByAddress(address.sido, address.sigungu, numOfRows);
        console.log(`API returned ${hospitals.length} hospitals`);

        const places = hospitals
            .map((item) => mapItemToPlace(item, lat, lng))
            .filter((place): place is PlaceResponse => place !== null);

        // 거리순 정렬 및 중복 제거
        places.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        const uniquePlaces = removeDuplicatesByCoords(places);

        const openCount = uniquePlaces.filter(p => p.isOpen).length;
        const closedCount = uniquePlaces.filter(p => p.openStatus === 'closed').length;
        const holidayCount = uniquePlaces.filter(p => p.openStatus === 'holiday').length;
        console.log(`Found ${uniquePlaces.length} hospitals (Open: ${openCount}, Closed: ${closedCount}, Holiday: ${holidayCount})`);

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
