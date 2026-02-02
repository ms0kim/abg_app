'use client';

import { Place, OpenStatus } from '../types';

interface BottomSheetProps {
    place: Place | null;
    onClose: () => void;
}

/**
 * 영업 상태에 따른 텍스트 및 스타일
 */
function getStatusDisplay(openStatus: OpenStatus): { text: string; bgClass: string; textClass: string } {
    switch (openStatus) {
        case 'open':
            return {
                text: '영업중',
                bgClass: 'bg-gradient-to-r from-emerald-500 to-teal-500',
                textClass: 'text-white'
            };
        case 'holiday':
            return {
                text: '휴일',
                bgClass: 'bg-amber-100',
                textClass: 'text-amber-700'
            };
        case 'closed':
        default:
            return {
                text: '영업종료',
                bgClass: 'bg-gray-100',
                textClass: 'text-gray-600'
            };
    }
}

export function BottomSheet({ place, onClose }: BottomSheetProps) {
    if (!place) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleCallClick = () => {
        if (place.phone) {
            window.location.href = `tel:${place.phone}`;
        }
    };

    const handleDetailClick = () => {
        // 정확도를 높이기 위해 이름과 주소(앞부분)를 함께 검색
        const query = place.address
            ? `${place.address.split(' ').slice(0, 2).join(' ')} ${place.name}`
            : place.name;

        const encodedQuery = encodeURIComponent(query);

        // 네이버 지도 검색 URL (PC/모바일 공통 - p/search)
        const searchUrl = `https://map.naver.com/p/search/${encodedQuery}`;

        // 새 탭에서 열기
        window.open(searchUrl, '_blank');
    };

    return (
        <>
            {/* 배경 오버레이 */}
            <div
                className="fixed inset-0 bg-gradient-to-b from-black/40 to-black/60 z-40 animate-fadeIn backdrop-blur-sm"
                onClick={handleBackdropClick}
            />

            {/* 바텀시트 */}
            <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 animate-slideUp max-h-[70vh] overflow-y-auto">
                {/* 핸들 */}
                <div className="flex justify-center pt-4 pb-2">
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                </div>

                {/* 컨텐츠 */}
                <div className="px-6 pb-8">
                    {/* 헤더 */}
                    <div className="flex items-start justify-between mb-5">
                        <div className="flex-1">
                            <div className="flex items-center gap-2.5 mb-2">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    {place.name}
                                </h2>
                                {(() => {
                                    const status = getStatusDisplay(place.openStatus);
                                    return (
                                        <span className={`px-3 py-1.5 ${status.bgClass} ${status.textClass} text-xs font-bold rounded-full shadow-md`}>
                                            {status.text}
                                        </span>
                                    );
                                })()}
                            </div>
                            {place.category && (
                                <div className="flex items-center gap-2">
                                    <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg">
                                        {place.category}
                                    </span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
                        >
                            <svg
                                className="w-6 h-6 text-gray-400 hover:text-gray-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>

                    {/* 정보 섹션 */}
                    <div className="space-y-4">
                        {/* 주소 */}
                        {place.address && (
                            <div className="flex gap-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl border border-gray-200/50">
                                <svg
                                    className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-gray-500 mb-1">주소</p>
                                    <p className="text-sm text-gray-900 font-medium">{place.address}</p>
                                </div>
                            </div>
                        )}

                        {/* 전화번호 */}
                        {place.phone && (
                            <div className="flex gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl border border-blue-200/50">
                                <svg
                                    className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                    />
                                </svg>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-gray-500 mb-1">전화번호</p>
                                    <button
                                        onClick={handleCallClick}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-bold"
                                    >
                                        {place.phone}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 운영시간 */}
                        {(place.todayHours || place.openStatus === 'holiday') && (
                            <div className={`flex gap-3 p-4 rounded-xl border ${
                                place.openStatus === 'holiday'
                                    ? 'bg-gradient-to-r from-amber-50 to-orange-50/50 border-amber-200/50'
                                    : 'bg-gradient-to-r from-emerald-50 to-teal-50/50 border-emerald-200/50'
                            }`}>
                                <svg
                                    className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                        place.openStatus === 'holiday' ? 'text-amber-500' : 'text-emerald-500'
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-gray-500 mb-1">오늘 운영시간</p>
                                    {place.openStatus === 'holiday' ? (
                                        <p className="text-sm text-amber-700 font-bold">오늘은 휴일입니다</p>
                                    ) : place.todayHours ? (
                                        <p className="text-sm text-gray-900 font-bold">
                                            {place.todayHours.open} - {place.todayHours.close}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        )}

                        {/* 거리 */}
                        {place.distance !== undefined && (
                            <div className="flex gap-3 p-4 bg-gradient-to-r from-blue-50 to-sky-50/50 rounded-xl border border-blue-200/50">
                                <svg
                                    className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                                    />
                                </svg>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-gray-500 mb-1">거리</p>
                                    <p className="text-sm text-gray-900 font-bold">
                                        {place.distance < 1000
                                            ? `${place.distance}m`
                                            : `${(place.distance / 1000).toFixed(1)}km`}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 버튼 영역 */}
                    <div className="flex gap-3 mt-6">
                        {/* 전화 걸기 버튼 */}
                        {place.phone && (
                            <button
                                onClick={handleCallClick}
                                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                            >
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2.5}
                                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                    />
                                </svg>
                                전화
                            </button>
                        )}

                        {/* 상세보기 버튼 */}
                        <button
                            onClick={handleDetailClick}
                            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-4 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                            </svg>
                            상세보기
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
