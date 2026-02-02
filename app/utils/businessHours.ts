/**
 * 영업시간 관련 공통 유틸리티
 */

import { OpenStatus } from '../types';

// 시간 정보를 담고 있는 아이템 타입
export interface TimeFields {
    dutyTime1s?: string | number;  // 월요일 시작
    dutyTime1c?: string | number;  // 월요일 종료
    dutyTime2s?: string | number;  // 화요일 시작
    dutyTime2c?: string | number;  // 화요일 종료
    dutyTime3s?: string | number;  // 수요일 시작
    dutyTime3c?: string | number;  // 수요일 종료
    dutyTime4s?: string | number;  // 목요일 시작
    dutyTime4c?: string | number;  // 목요일 종료
    dutyTime5s?: string | number;  // 금요일 시작
    dutyTime5c?: string | number;  // 금요일 종료
    dutyTime6s?: string | number;  // 토요일 시작
    dutyTime6c?: string | number;  // 토요일 종료
    dutyTime7s?: string | number;  // 일요일 시작
    dutyTime7c?: string | number;  // 일요일 종료
    dutyTime8s?: string | number;  // 공휴일 시작
    dutyTime8c?: string | number;  // 공휴일 종료
}

/**
 * 시간 문자열(HHMM)을 분 단위로 변환
 */
export function timeToMinutes(timeStr: string | undefined | number): number | null {
    if (timeStr === undefined || timeStr === null) return null;

    const str = String(timeStr).padStart(4, '0');
    if (str.length < 4) return null;

    const hours = parseInt(str.substring(0, 2), 10);
    const minutes = parseInt(str.substring(2, 4), 10);

    if (isNaN(hours) || isNaN(minutes)) return null;

    return hours * 60 + minutes;
}

/**
 * 시간 문자열을 읽기 좋은 형식으로 변환
 */
export function formatTime(timeStr: string | undefined | number): string {
    if (timeStr === undefined || timeStr === null) return '-';

    const str = String(timeStr).padStart(4, '0');
    if (str.length < 4) return '-';

    const hours = parseInt(str.substring(0, 2), 10);
    const minutes = parseInt(str.substring(2, 4), 10);

    if (isNaN(hours) || isNaN(minutes)) return '-';

    const period = hours >= 12 ? '오후' : '오전';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const displayMinutes = minutes.toString().padStart(2, '0');

    return `${period} ${displayHours}:${displayMinutes}`;
}

/**
 * 요일별 영업시간 가져오기
 */
function getDayTimes(item: TimeFields, dayOfWeek: number): { start?: string | number; end?: string | number } {
    const timeMap: Record<number, { start?: string | number; end?: string | number }> = {
        0: { start: item.dutyTime7s, end: item.dutyTime7c }, // 일요일
        1: { start: item.dutyTime1s, end: item.dutyTime1c }, // 월요일
        2: { start: item.dutyTime2s, end: item.dutyTime2c }, // 화요일
        3: { start: item.dutyTime3s, end: item.dutyTime3c }, // 수요일
        4: { start: item.dutyTime4s, end: item.dutyTime4c }, // 목요일
        5: { start: item.dutyTime5s, end: item.dutyTime5c }, // 금요일
        6: { start: item.dutyTime6s, end: item.dutyTime6c }, // 토요일
    };
    return timeMap[dayOfWeek] || {};
}

/**
 * 해당 요일에 영업시간 정보가 있는지 확인 (휴일 판별용)
 */
function hasTodayHours(item: TimeFields, dayOfWeek: number): boolean {
    const { start, end } = getDayTimes(item, dayOfWeek);
    return start !== undefined && start !== null && end !== undefined && end !== null;
}

/**
 * 전체 영업시간 정보가 있는지 확인 (최소 하나의 요일이라도 시간 정보가 있는지)
 */
function hasAnyTimeInfo(item: TimeFields): boolean {
    return !!(
        item.dutyTime1s || item.dutyTime1c ||
        item.dutyTime2s || item.dutyTime2c ||
        item.dutyTime3s || item.dutyTime3c ||
        item.dutyTime4s || item.dutyTime4c ||
        item.dutyTime5s || item.dutyTime5c ||
        item.dutyTime6s || item.dutyTime6c ||
        item.dutyTime7s || item.dutyTime7c ||
        item.dutyTime8s || item.dutyTime8c
    );
}

/**
 * 현재 시간이 영업시간 내인지 확인
 */
export function checkIsOpen(item: TimeFields, currentDate: Date = new Date()): boolean {
    const dayOfWeek = currentDate.getDay();
    const { start: startTimeStr, end: endTimeStr } = getDayTimes(item, dayOfWeek);

    // 영업시간 정보가 없으면 (해당 요일에 영업 안 함 = 휴일)
    if (!startTimeStr || !endTimeStr) {
        // 다른 요일에 시간 정보가 있다면 오늘은 휴일 = 영업종료
        if (hasAnyTimeInfo(item)) {
            return false;
        }
        // 아예 시간 정보가 없으면 알 수 없음 = 영업종료로 처리
        return false;
    }

    const startMinutes = timeToMinutes(startTimeStr);
    const endMinutes = timeToMinutes(endTimeStr);

    if (startMinutes === null || endMinutes === null) {
        return false;
    }

    const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

    // 24시간 운영 또는 익일 종료 처리
    if (endMinutes <= startMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * 영업 상태 반환 (open/closed/holiday)
 */
export function getOpenStatus(item: TimeFields, currentDate: Date = new Date()): OpenStatus {
    const dayOfWeek = currentDate.getDay();
    const { start: startTimeStr, end: endTimeStr } = getDayTimes(item, dayOfWeek);

    // 해당 요일에 영업시간 정보가 없는 경우
    if (!startTimeStr || !endTimeStr) {
        // 다른 요일에 시간 정보가 있다면 오늘은 휴일
        if (hasAnyTimeInfo(item)) {
            return 'holiday';
        }
        // 아예 시간 정보가 없으면 closed로 처리 (정보 없음)
        return 'closed';
    }

    const startMinutes = timeToMinutes(startTimeStr);
    const endMinutes = timeToMinutes(endTimeStr);

    if (startMinutes === null || endMinutes === null) {
        return 'closed';
    }

    const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

    // 24시간 운영 또는 익일 종료 처리
    if (endMinutes <= startMinutes) {
        if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
            return 'open';
        }
        return 'closed';
    }

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return 'open';
    }

    return 'closed';
}

/**
 * 오늘의 영업시간 정보 가져오기
 */
export function getTodayBusinessHours(
    item: TimeFields,
    currentDate: Date = new Date()
): { open: string; close: string } | null {
    const dayOfWeek = currentDate.getDay();
    const { start: startTimeStr, end: endTimeStr } = getDayTimes(item, dayOfWeek);

    if (!startTimeStr || !endTimeStr) {
        return null;
    }

    return {
        open: formatTime(startTimeStr),
        close: formatTime(endTimeStr),
    };
}
