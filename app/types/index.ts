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

// 영업시간 정보
export interface BusinessHours {
    open: string;
    close: string;
}

// 장소 정보
export interface Place {
    id: string;
    type: PlaceType;
    name: string;
    lat: number;
    lng: number;
    isOpen: boolean;
    address?: string;
    phone?: string;
    distance?: number;
    category?: string;
    todayHours?: BusinessHours | null;
}
