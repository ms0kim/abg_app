'use client';

import { Place, OpenStatus } from '../types';
import { calculateOpenStatus } from '../utils/realtimeStatus';

interface MarkerClusterPopupProps {
    places: Place[];
    onPlaceClick: (place: Place) => void;
    onClose: () => void;
    position: { x: number; y: number };
}

/**
 * 영업 상태에 따른 텍스트
 */
function getStatusText(openStatus: OpenStatus): string {
    switch (openStatus) {
        case 'open':
            return '영업중';
        case 'holiday':
            return '휴일';
        case 'closed':
        default:
            return '영업종료';
    }
}

/**
 * 실시간 영업 상태 계산
 */
function getRealtimeStatus(place: Place): { isOpen: boolean; openStatus: OpenStatus } {
    if (place.todayTimeRaw) {
        return calculateOpenStatus(place.todayTimeRaw);
    }
    return { isOpen: place.isOpen, openStatus: place.openStatus };
}

export function MarkerClusterPopup({ places, onPlaceClick, onClose, position }: MarkerClusterPopupProps) {
    return (
        <>
            {/* 배경 오버레이 */}
            <div
                className="fixed inset-0 bg-black/20 z-30"
                onClick={onClose}
            />

            {/* 팝업 */}
            <div
                className="absolute z-40 glass rounded-2xl shadow-2xl max-w-sm w-80 max-h-96 overflow-hidden"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    transform: 'translate(-50%, -100%) translateY(-60px)',
                }}
            >
                {/* 헤더 */}
                <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center border border-blue-100">
                            <span className="text-blue-600 text-sm font-bold">{places.length}</span>
                        </div>
                        <h3 className="text-gray-900 font-bold text-sm">이 위치의 병원/약국</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 장소 목록 */}
                <div className="overflow-y-auto max-h-80 divide-y divide-gray-100">
                    {places.map((place, index) => {
                        const isHospital = place.type === 'hospital';
                        const isTestMarker = place.id.startsWith('test_');
                        // 실시간 영업 상태 계산
                        const { isOpen, openStatus } = getRealtimeStatus(place);

                        // 테스트 마커는 노란색 배경
                        const bgColor = isTestMarker
                            ? 'bg-amber-50'
                            : isOpen
                                ? isHospital
                                    ? 'bg-rose-50'
                                    : 'bg-emerald-50'
                                : 'bg-gray-50';
                        // 테스트 마커는 노란색 텍스트, 휴일일 경우 특별 색상
                        const textColor = isTestMarker
                            ? 'text-amber-600'
                            : openStatus === 'open'
                                ? isHospital
                                    ? 'text-rose-600'
                                    : 'text-emerald-600'
                                : openStatus === 'holiday'
                                    ? 'text-amber-600'
                                    : 'text-gray-600';

                        // 아이콘 배경색 결정
                        const iconBgColor = isTestMarker
                            ? 'bg-amber-500'
                            : isOpen
                                ? (isHospital ? 'bg-rose-500' : 'bg-emerald-500')
                                : 'bg-gray-400';

                        return (
                            <button
                                key={`${place.id}-${index}`}
                                onClick={() => {
                                    onPlaceClick(place);
                                    onClose();
                                }}
                                className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors ${bgColor}`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* 아이콘 */}
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconBgColor}`}>
                                        {isHospital ? (
                                            <svg className="w-4 h-4" fill="white" viewBox="0 0 24 24">
                                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="white" viewBox="0 0 24 24">
                                                <path d="M4.22 11.29l6.07 6.07c1.56 1.56 4.09 1.56 5.66 0l4.07-4.07c1.56-1.56 1.56-4.09 0-5.66l-6.07-6.07c-1.56-1.56-4.09-1.56-5.66 0L4.22 5.63c-1.56 1.57-1.56 4.1 0 5.66zm7.48-4.9l4.95 4.95-2.12 2.12-4.95-4.95 2.12-2.12z" />
                                            </svg>
                                        )}
                                    </div>

                                    {/* 정보 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-gray-900 text-sm truncate">
                                            {place.name}
                                        </div>
                                        <div className="text-xs text-gray-600 mt-0.5 truncate">
                                            {place.address}
                                        </div>
                                        <div className={`text-xs font-medium mt-1 ${textColor}`}>
                                            {getStatusText(openStatus)}
                                            {place.todayHours && ` · ${place.todayHours.open}-${place.todayHours.close}`}
                                        </div>
                                    </div>

                                    {/* 화살표 */}
                                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
