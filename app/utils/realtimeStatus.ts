/**
 * 클라이언트에서 실시간 영업 상태를 계산하는 유틸리티
 */

import { Place, OpenStatus, BusinessTimeRaw } from '../types';

/**
 * 현재 시간(분)을 반환
 */
export function getCurrentMinutes(): number {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

/**
 * 영업시간 원본 데이터를 기반으로 현재 영업 상태 계산
 */
export function calculateOpenStatus(timeRaw: BusinessTimeRaw | undefined): { isOpen: boolean; openStatus: OpenStatus } {
    // 데이터 없으면 영업중으로 가정
    if (!timeRaw) {
        return { isOpen: true, openStatus: 'open' };
    }

    // 휴일인 경우
    if (timeRaw.isHoliday) {
        return { isOpen: false, openStatus: 'holiday' };
    }

    // 영업시간 정보 없으면 영업중으로 가정
    if (timeRaw.openMinutes === null || timeRaw.closeMinutes === null) {
        return { isOpen: true, openStatus: 'open' };
    }

    const currentMinutes = getCurrentMinutes();
    const { openMinutes, closeMinutes } = timeRaw;

    // 24시간 운영 또는 익일 종료 처리
    if (closeMinutes <= openMinutes) {
        const isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes;
        return { isOpen, openStatus: isOpen ? 'open' : 'closed' };
    }

    const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    return { isOpen, openStatus: isOpen ? 'open' : 'closed' };
}

/**
 * Place 객체의 영업 상태를 실시간으로 업데이트
 */
export function updatePlaceStatus(place: Place): Place {
    const { isOpen, openStatus } = calculateOpenStatus(place.todayTimeRaw);
    return {
        ...place,
        isOpen,
        openStatus,
    };
}

/**
 * Place 배열의 영업 상태를 실시간으로 업데이트
 */
export function updatePlacesStatus(places: Place[]): Place[] {
    return places.map(updatePlaceStatus);
}
