/**
 * 영업시간 관련 공통 유틸리티
 */

// 시간 정보를 담고 있는 아이템 타입
export interface TimeFields {
    dutyTime1s?: string;  // 월요일 시작
    dutyTime1c?: string;  // 월요일 종료
    dutyTime2s?: string;  // 화요일 시작
    dutyTime2c?: string;  // 화요일 종료
    dutyTime3s?: string;  // 수요일 시작
    dutyTime3c?: string;  // 수요일 종료
    dutyTime4s?: string;  // 목요일 시작
    dutyTime4c?: string;  // 목요일 종료
    dutyTime5s?: string;  // 금요일 시작
    dutyTime5c?: string;  // 금요일 종료
    dutyTime6s?: string;  // 토요일 시작
    dutyTime6c?: string;  // 토요일 종료
    dutyTime7s?: string;  // 일요일 시작
    dutyTime7c?: string;  // 일요일 종료
    dutyTime8s?: string;  // 공휴일 시작
    dutyTime8c?: string;  // 공휴일 종료
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
function getDayTimes(item: TimeFields, dayOfWeek: number): { start?: string; end?: string } {
    const timeMap: Record<number, { start?: string; end?: string }> = {
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
 * 현재 시간이 영업시간 내인지 확인
 */
export function checkIsOpen(item: TimeFields, currentDate: Date = new Date()): boolean {
    const dayOfWeek = currentDate.getDay();
    const { start: startTimeStr, end: endTimeStr } = getDayTimes(item, dayOfWeek);

    // 영업시간 정보가 없으면 영업 중으로 가정
    if (!startTimeStr || !endTimeStr) {
        return true;
    }

    const startMinutes = timeToMinutes(startTimeStr);
    const endMinutes = timeToMinutes(endTimeStr);

    if (startMinutes === null || endMinutes === null) {
        return true;
    }

    const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

    // 24시간 운영 또는 익일 종료 처리
    if (endMinutes <= startMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
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
