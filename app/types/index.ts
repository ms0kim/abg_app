// 위치 정보 타입
export interface Location {
    lat: number;
    lng: number;
}

// 지도 영역 (bounds) 타입
export interface MapBounds {
    sw: Location; // 남서쪽 (왼쪽 아래)
    ne: Location; // 북동쪽 (오른쪽 위)
}

// 장소 타입 (병원 또는 약국)
export type PlaceType = 'hospital' | 'pharmacy';

// 필터 타입
export type FilterType = 'all' | 'hospital' | 'pharmacy';

// 영업 상태 타입
export type OpenStatus = 'open' | 'closed' | 'holiday';

// 영업시간 정보 (표시용)
export interface BusinessHours {
    open: string;
    close: string;
}

// 영업시간 원본 데이터 (실시간 계산용, 분 단위)
export interface BusinessTimeRaw {
    openMinutes: number | null;  // 시작 시간 (분 단위, 예: 9:00 = 540)
    closeMinutes: number | null; // 종료 시간 (분 단위, 예: 18:00 = 1080)
    isHoliday: boolean;          // 오늘 휴일 여부
}

// 장소 정보
export interface Place {
    id: string;
    type: PlaceType;
    name: string;
    lat: number;
    lng: number;
    isOpen: boolean;
    openStatus: OpenStatus; // 'open' | 'closed' | 'holiday'
    address?: string;
    phone?: string;
    distance?: number;
    category?: string;
    todayHours?: BusinessHours | null;
    todayTimeRaw?: BusinessTimeRaw; // 실시간 계산용 원본 데이터
}
