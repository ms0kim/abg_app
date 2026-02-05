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

// 진료과목 코드 (공공데이터 API CODE_MST D000 참조)
export type MedicalDepartment =
    | 'all'      // 전체
    | 'D001'     // 내과
    | 'D002'     // 소아청소년과
    | 'D003'     // 신경과
    | 'D004'     // 정신건강의학과
    | 'D005'     // 피부과
    | 'D006'     // 외과
    | 'D008'     // 정형외과
    | 'D009'     // 신경외과
    | 'D011'     // 산부인과
    | 'D012'     // 안과
    | 'D013'     // 이비인후과
    | 'D014'     // 비뇨의학과
    | 'D019'     // 재활의학과
    | 'D021'     // 가정의학과
    | 'D026';    // 치과

// 진료과목 이름 매핑
export const DEPARTMENT_NAMES: Record<MedicalDepartment, string> = {
    'all': '전체',
    'D001': '내과',
    'D002': '소아청소년과',
    'D003': '신경과',
    'D004': '정신건강의학과',
    'D005': '피부과',
    'D006': '외과',
    'D008': '정형외과',
    'D009': '신경외과',
    'D011': '산부인과',
    'D012': '안과',
    'D013': '이비인후과',
    'D014': '비뇨의학과',
    'D019': '재활의학과',
    'D021': '가정의학과',
    'D026': '치과',
};

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
    departmentCode?: string; // 진료과목 코드 (병원만)
    todayHours?: BusinessHours | null;
    todayTimeRaw?: BusinessTimeRaw; // 실시간 계산용 원본 데이터
}
