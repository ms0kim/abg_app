'use client';

import { Place, OpenStatus } from '../types';
import { calculateOpenStatus } from '../utils/realtimeStatus';

interface MarkerClusterPopupProps {
    places: Place[];
    onPlaceClick: (place: Place) => void;
    onClose: () => void;
    position: { x: number; y: number };
}

// 마커/UI 색상 테마
const COLORS = {
    hospital: {
        gradient: 'linear-gradient(135deg, #f43f5e, #ec4899)',
        primary: '#f43f5e',
        light: '#fef2f2',
        border: '#fecdd3',
        text: '#be123c',
    },
    pharmacy: {
        gradient: 'linear-gradient(135deg, #10b981, #14b8a6)',
        primary: '#10b981',
        light: '#ecfdf5',
        border: '#a7f3d0',
        text: '#047857',
    },
    closed: {
        gradient: '#9ca3af',
        primary: '#9ca3af',
        light: '#f9fafb',
        border: '#e5e7eb',
        text: '#6b7280',
    },
    holiday: {
        text: '#d97706',
    },
};

const STATUS_TEXT: Record<OpenStatus, string> = {
    open: '영업중',
    holiday: '휴일',
    closed: '영업종료',
};

function getRealtimeStatus(place: Place) {
    return place.todayTimeRaw ? calculateOpenStatus(place.todayTimeRaw) : { isOpen: place.isOpen, openStatus: place.openStatus };
}

export function MarkerClusterPopup({ places, onPlaceClick, onClose, position }: MarkerClusterPopupProps) {
    return (
        <>
            <div className="fixed inset-0 bg-black/20 z-30" onClick={onClose} />

            <div
                className="absolute z-40 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-sm w-80 max-h-96 overflow-hidden border border-gray-200/50"
                style={{ left: `${position.x}px`, top: `${position.y}px`, transform: 'translate(-50%, -100%) translateY(-60px)' }}
            >
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
                        >
                            <span className="text-white text-xs font-bold">{places.length}</span>
                        </div>
                        <h3 className="text-gray-800 font-bold text-sm">이 위치의 병원/약국</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 장소 목록 */}
                <div className="overflow-y-auto max-h-80">
                    {places.map((place, index) => {
                        const isHospital = place.type === 'hospital';
                        const { isOpen, openStatus } = getRealtimeStatus(place);

                        // 색상 테마 선택
                        const theme = isOpen
                            ? (isHospital ? COLORS.hospital : COLORS.pharmacy)
                            : COLORS.closed;

                        const statusTextColor = openStatus === 'open'
                            ? theme.text
                            : openStatus === 'holiday'
                                ? COLORS.holiday.text
                                : COLORS.closed.text;

                        return (
                            <button
                                key={`${place.id}-${index}`}
                                onClick={() => { onPlaceClick(place); onClose(); }}
                                className="w-full px-4 py-3 text-left transition-all duration-200 hover:scale-[1.01] border-b border-gray-100 last:border-b-0"
                                style={{
                                    backgroundColor: theme.light,
                                }}
                            >
                                <div className="flex items-start gap-3">
                                    {/* 아이콘 */}
                                    <div
                                        className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
                                        style={{ background: theme.gradient }}
                                    >
                                        {isHospital ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="white"><path d="M371-196v-175H196v-217h175v-176h217v176h176v217H588v175H371Z" /></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" height="19px" viewBox="0 -960 960 960" width="19px" fill="white"><path d="m654-357 101-100q29-29 45-68t16-81q0-87.73-61.13-148.87Q693.73-816 606-816q-42 0-81 16t-68 45L357-654l297 297ZM354-144q42 0 81-16t68-45l100-101-297-297-101 100q-29 29-45 68t-16 81q0 87.73 61.13 148.87Q266.27-144 354-144Z" /></svg>
                                        )}
                                    </div>

                                    {/* 정보 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-gray-900 text-sm truncate">{place.name}</div>
                                        <div className="text-xs text-gray-500 mt-0.5 truncate">{place.address}</div>
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            <span
                                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                                                style={{
                                                    backgroundColor: isOpen ? `${theme.primary}15` : '#f3f4f6',
                                                    color: statusTextColor,
                                                }}
                                            >
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full mr-1"
                                                    style={{ backgroundColor: statusTextColor }}
                                                />
                                                {STATUS_TEXT[openStatus]}
                                            </span>
                                            {place.todayHours && (
                                                <span className="text-xs text-gray-500">
                                                    {place.todayHours.open} - {place.todayHours.close}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 화살표 */}
                                    <div
                                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-1"
                                        style={{ backgroundColor: `${theme.primary}10` }}
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke={theme.primary} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
