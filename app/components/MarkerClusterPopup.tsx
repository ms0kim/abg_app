'use client';

import { Place } from '../types';

interface MarkerClusterPopupProps {
    places: Place[];
    onPlaceClick: (place: Place) => void;
    onClose: () => void;
    position: { x: number; y: number };
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
                className="fixed z-40 glass rounded-2xl shadow-2xl max-w-sm w-80 max-h-96 overflow-hidden"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    transform: 'translate(-50%, -100%) translateY(-20px)',
                }}
            >
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-bold">{places.length}</span>
                        </div>
                        <h3 className="text-white font-bold text-sm">이 위치의 병원/약국</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
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
                        const bgColor = place.isOpen
                            ? isHospital
                                ? 'bg-rose-50'
                                : 'bg-emerald-50'
                            : 'bg-gray-50';
                        const textColor = place.isOpen
                            ? isHospital
                                ? 'text-rose-600'
                                : 'text-emerald-600'
                            : 'text-gray-600';

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
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${place.isOpen ? (isHospital ? 'bg-rose-500' : 'bg-emerald-500') : 'bg-gray-400'}`}>
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
                                            {place.isOpen ? '영업중' : '영업종료'}
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
