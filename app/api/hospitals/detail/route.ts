import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, parseXmlResponse } from '@/app/utils/apiUtils';
import { checkIsOpen, getTodayBusinessHours, TimeFields } from '@/app/utils/businessHours';

const SERVICE_KEY = process.env.DATA_GO_KR_SERVICE_KEY || '';
// 병원 기본정보 조회 (상세 정보, 영업시간 포함)
const ONE_HOSPITAL_API_URL = 'http://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlBassInfoInqire';

interface HospitalDetailApiItem extends TimeFields {
    dutyName?: string;
    dutyAddr?: string;
    dutyTel1?: string;
    hpid?: string;
    // 필요한 다른 상세 필드들
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const hpid = searchParams.get('hpid');

        if (!hpid) {
            return NextResponse.json(
                { success: false, error: 'hpid 파라미터가 필요합니다.', data: null },
                { status: 400 }
            );
        }

        if (!SERVICE_KEY) {
            console.error('공공데이터 API 서비스 키가 설정되지 않았습니다.');
            return NextResponse.json(
                { success: false, error: '서버 설정 오류', data: null },
                { status: 500 }
            );
        }

        const url = new URL(ONE_HOSPITAL_API_URL);
        url.searchParams.set('ServiceKey', SERVICE_KEY);
        url.searchParams.set('HPID', hpid);

        console.log(`Fetching hospital detail: hpid=${hpid}`);

        const response = await fetchWithRetry(url.toString());

        if (!response.ok) {
            console.error('병원 상세 API 응답 에러:', response.status);
            return NextResponse.json(
                { success: false, error: '외부 API 호출 에러', data: null },
                { status: 502 }
            );
        }

        const xmlText = await response.text();
        const items = parseXmlResponse<HospitalDetailApiItem>(xmlText);

        if (items.length === 0) {
            return NextResponse.json(
                { success: false, error: '데이터를 찾을 수 없습니다.', data: null },
                { status: 404 }
            );
        }

        const item = items[0];
        const currentDate = new Date();

        // 필요한 정보만 추출하여 반환
        const detailInfo = {
            todayHours: getTodayBusinessHours(item, currentDate),
            isOpen: checkIsOpen(item, currentDate),
            // 필요한 경우 추가 상세 정보 (진료과목 등)
        };

        return NextResponse.json({
            success: true,
            data: detailInfo,
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: '서버 오류가 발생했습니다.', data: null },
            { status: 500 }
        );
    }
}
