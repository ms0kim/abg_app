import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, parseXmlResponse, removeDuplicatesByCoords } from '@/app/utils/apiUtils';
import { checkIsOpen, getTodayBusinessHours, TimeFields } from '@/app/utils/businessHours';

const SERVICE_KEY = '863eb4017203c5738f818b59039fcc77d35a7849d9f9c1b7ea2bffeedc5133a4';
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

async function fetchHospitalsByType(
    lat: number,
    lng: number,
    qd: 'B' | 'C',
    numOfRows: number
): Promise<HospitalApiItem[]> {
    if (!SERVICE_KEY) {
        console.error('공공데이터 API 서비스 키가 설정되지 않았습니다.');
        return [];
    }

    const url = new URL(HOSPITAL_API_URL);
    url.searchParams.set('ServiceKey', SERVICE_KEY);
    url.searchParams.set('WGS84_LAT', String(lat));
    url.searchParams.set('WGS84_LON', String(lng));
    url.searchParams.set('QD', qd);
    url.searchParams.set('numOfRows', String(numOfRows));
    url.searchParams.set('pageNo', '1');

    const typeName = qd === 'B' ? '병원' : '의원';
    console.log(`Fetching ${typeName}: lat=${lat}, lng=${lng}`);

    try {
        const response = await fetchWithRetry(url.toString());

        if (!response.ok) {
            console.error(`${typeName} API 응답 에러:`, response.status);
            return [];
        }

        const xmlText = await response.text();
        return parseXmlResponse<HospitalApiItem>(xmlText);
    } catch (error) {
        console.error(`${typeName} API 호출 실패:`, error);
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
        const numOfRows = parseInt(searchParams.get('numOfRows') || '30', 10);

        if (isNaN(lat) || isNaN(lng)) {
            return NextResponse.json(
                { success: false, error: '유효한 lat, lng 파라미터가 필요합니다.', data: [] },
                { status: 400 }
            );
        }

        console.log(`Fetching nearby hospitals (dual search): lat=${lat}, lng=${lng}`);

        const currentDate = new Date();

        // 병원(B)과 의원(C) 병렬 조회
        const [hospitals, clinics] = await Promise.all([
            fetchHospitalsByType(lat, lng, 'B', numOfRows),
            fetchHospitalsByType(lat, lng, 'C', numOfRows),
        ]);

        const allItems = [...hospitals, ...clinics];

        const places = allItems
            .map((item) => mapItemToPlace(item, currentDate))
            .filter((place): place is PlaceResponse => place !== null);

        // 거리순 정렬 및 중복 제거
        places.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        const uniquePlaces = removeDuplicatesByCoords(places);

        console.log(`Found ${uniquePlaces.length} hospitals/clinics`);

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
