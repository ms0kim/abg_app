/**
 * 영업시간 마커 표시 테스트를 위한 더미 데이터
 *
 * 사용법:
 * 1. 개발 환경에서 이 파일의 함수를 import하여 사용
 * 2. 또는 브라우저 콘솔에서 window.__testMarkerStatus() 호출
 */

import { Place, BusinessTimeRaw, OpenStatus } from '../types';
import { calculateOpenStatus, getCurrentMinutes } from './realtimeStatus';

/**
 * 다양한 영업 상태의 더미 장소 데이터 생성
 */
export function createTestPlaces(baseLat: number = 37.5665, baseLng: number = 126.978): Place[] {
    const currentMinutes = getCurrentMinutes();

    // 1. 영업 중인 병원 (현재 시간이 영업시간 내)
    const openHospital: Place = {
        id: 'test_hospital_open',
        type: 'hospital',
        name: '[테스트] 영업중 병원',
        lat: baseLat + 0.001,
        lng: baseLng + 0.001,
        isOpen: true,
        openStatus: 'open',
        address: '테스트 주소 1',
        phone: '02-1234-5678',
        distance: 100,
        category: '의원',
        todayHours: { open: '오전 9:00', close: '오후 10:00' },
        todayTimeRaw: {
            openMinutes: 540, // 09:00
            closeMinutes: 1320, // 22:00
            isHoliday: false,
        },
    };

    // 2. 영업 종료된 병원 (이미 종료 시간이 지남)
    const closedHospital: Place = {
        id: 'test_hospital_closed',
        type: 'hospital',
        name: '[테스트] 영업종료 병원',
        lat: baseLat + 0.002,
        lng: baseLng + 0.002,
        isOpen: false,
        openStatus: 'closed',
        address: '테스트 주소 2',
        phone: '02-1234-5679',
        distance: 200,
        category: '의원',
        todayHours: { open: '오전 9:00', close: '오후 5:00' },
        todayTimeRaw: {
            openMinutes: 540, // 09:00
            closeMinutes: 300, // 05:00 (새벽 - 이미 지남)
            isHoliday: false,
        },
    };

    // 3. 휴일인 병원
    const holidayHospital: Place = {
        id: 'test_hospital_holiday',
        type: 'hospital',
        name: '[테스트] 휴일 병원',
        lat: baseLat + 0.003,
        lng: baseLng + 0.003,
        isOpen: false,
        openStatus: 'holiday',
        address: '테스트 주소 3',
        phone: '02-1234-5680',
        distance: 300,
        category: '병원',
        todayHours: null,
        todayTimeRaw: {
            openMinutes: null,
            closeMinutes: null,
            isHoliday: true,
        },
    };

    // 4. 영업 중인 약국
    const openPharmacy: Place = {
        id: 'test_pharmacy_open',
        type: 'pharmacy',
        name: '[테스트] 영업중 약국',
        lat: baseLat - 0.001,
        lng: baseLng - 0.001,
        isOpen: true,
        openStatus: 'open',
        address: '테스트 주소 4',
        phone: '02-1234-5681',
        distance: 150,
        category: '약국',
        todayHours: { open: '오전 8:00', close: '오후 11:00' },
        todayTimeRaw: {
            openMinutes: 480, // 08:00
            closeMinutes: 1380, // 23:00
            isHoliday: false,
        },
    };

    // 5. 영업 종료된 약국 (현재 시간 기준으로 이미 종료)
    // 현재 시간보다 1시간 전에 종료된 것으로 설정
    const closedPharmacy: Place = {
        id: 'test_pharmacy_closed',
        type: 'pharmacy',
        name: '[테스트] 영업종료 약국',
        lat: baseLat - 0.002,
        lng: baseLng - 0.002,
        isOpen: false,
        openStatus: 'closed',
        address: '테스트 주소 5',
        phone: '02-1234-5682',
        distance: 250,
        category: '약국',
        todayHours: { open: '오전 9:00', close: formatMinutesToTime(Math.max(0, currentMinutes - 60)) },
        todayTimeRaw: {
            openMinutes: 540, // 09:00
            closeMinutes: Math.max(0, currentMinutes - 60), // 현재 시간 1시간 전
            isHoliday: false,
        },
    };

    // 6. 24시간 영업 약국
    const allDayPharmacy: Place = {
        id: 'test_pharmacy_24h',
        type: 'pharmacy',
        name: '[테스트] 24시간 약국',
        lat: baseLat - 0.003,
        lng: baseLng - 0.003,
        isOpen: true,
        openStatus: 'open',
        address: '테스트 주소 6',
        phone: '02-1234-5683',
        distance: 350,
        category: '약국',
        todayHours: { open: '오전 0:00', close: '오전 0:00' },
        todayTimeRaw: {
            openMinutes: 0, // 00:00
            closeMinutes: 0, // 00:00 (다음날)
            isHoliday: false,
        },
    };

    return [
        openHospital,
        closedHospital,
        holidayHospital,
        openPharmacy,
        closedPharmacy,
        allDayPharmacy,
    ];
}

/**
 * 분을 시간 문자열로 변환
 */
function formatMinutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? '오후' : '오전';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${period} ${displayHours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * 테스트 실행 - 콘솔에 결과 출력
 */
export function runMarkerStatusTest(): void {
    console.log('=== 마커 영업 상태 테스트 시작 ===');
    console.log(`현재 시간: ${formatMinutesToTime(getCurrentMinutes())} (${getCurrentMinutes()}분)`);
    console.log('');

    const testPlaces = createTestPlaces();

    testPlaces.forEach((place) => {
        const { isOpen, openStatus } = calculateOpenStatus(place.todayTimeRaw);
        const markerColor = isOpen
            ? (place.type === 'hospital' ? '🔴 Rose/Pink (영업중)' : '🟢 Emerald/Teal (영업중)')
            : '⚪ Gray (영업종료/휴일)';

        console.log(`📍 ${place.name}`);
        console.log(`   타입: ${place.type}`);
        console.log(`   영업시간: ${place.todayHours?.open || '정보없음'} - ${place.todayHours?.close || '정보없음'}`);
        console.log(`   휴일여부: ${place.todayTimeRaw?.isHoliday ? '예' : '아니오'}`);
        console.log(`   실시간 계산 결과: isOpen=${isOpen}, openStatus=${openStatus}`);
        console.log(`   마커 색상: ${markerColor}`);
        console.log('');
    });

    console.log('=== 테스트 완료 ===');
}

// 브라우저 환경에서 전역으로 접근 가능하도록 설정
if (typeof window !== 'undefined') {
    (window as unknown as { __testMarkerStatus: () => void }).__testMarkerStatus = runMarkerStatusTest;
    (window as unknown as { __createTestPlaces: typeof createTestPlaces }).__createTestPlaces = createTestPlaces;
}
