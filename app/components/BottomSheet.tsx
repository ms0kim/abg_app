'use client';

import { useEffect, useCallback } from 'react';
import { Place, OpenStatus } from '../types';
import { calculateOpenStatus } from '../utils/realtimeStatus';

interface BottomSheetProps {
    place: Place | null;
    onClose: () => void;
    isLoading?: boolean;
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

export function BottomSheet({ place, onClose, isLoading = false }: BottomSheetProps) {
    // 바텀시트가 열릴 때 배경 터치/스크롤 방지
    useEffect(() => {
        if (place) {
            document.body.classList.add('bottomsheet-open');
            // 배경 터치 이벤트 방지
            const preventTouch = (e: TouchEvent) => {
                const target = e.target as HTMLElement;
                // 바텀시트 내부는 스크롤 허용
                if (!target.closest('.bottomsheet-content')) {
                    e.preventDefault();
                }
            };
            document.addEventListener('touchmove', preventTouch, { passive: false });

            return () => {
                document.body.classList.remove('bottomsheet-open');
                document.removeEventListener('touchmove', preventTouch);
            };
        }
    }, [place]);

    if (!place) return null;

    // 실시간 영업 상태 계산
    const { openStatus: realtimeOpenStatus } = calculateOpenStatus(place.todayTimeRaw);

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
                className="fixed inset-0 bg-gradient-to-b from-black/40 to-black/60 z-[1000] animate-fadeIn backdrop-blur-sm"
                onClick={handleBackdropClick}
            />

            {/* 바텀시트 */}
            <div className="bottomsheet-content fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[1001] animate-slideUp max-h-[90vh] overflow-y-auto pb-safe">
                {/* 핸들 */}
                <div className="flex justify-center pt-4 pb-2">
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                </div>

                {/* 컨텐츠 */}
                <div className="px-6 pb-8">
                    {/* 헤더 */}
                    <div className="flex items-start justify-between mb-5">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-2">
                                <h2 className="text-2xl font-bold text-gray-900 truncate">
                                    {place.name}
                                </h2>
                                {(() => {
                                    const status = getStatusDisplay(realtimeOpenStatus);
                                    return (
                                        <span className={`px-3 py-1.5 ${status.bgClass} ${status.textClass} text-xs font-bold rounded-full shadow-md flex-shrink-0 whitespace-nowrap`}>
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
                                <svg xmlns="http://www.w3.org/2000/svg" height="19px" viewBox="0 -960 960 960" width="19px" fill="#3b82f6"><path d="M536.5-503.5Q560-527 560-560t-23.5-56.5Q513-640 480-640t-56.5 23.5Q400-593 400-560t23.5 56.5Q447-480 480-480t56.5-23.5ZM480-186q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z" /></svg>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-gray-500 mb-1">주소</p>
                                    <p className="text-sm text-gray-900 font-medium">{place.address}</p>
                                </div>
                            </div>
                        )}

                        {/* 전화번호 */}
                        {place.phone && (
                            <div className="flex gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl border border-blue-200/50">
                                <svg xmlns="http://www.w3.org/2000/svg" height="19px" viewBox="0 -960 960 960" width="19px" fill="#3b82f6"><path d="M763-145q-121-9-229.5-59.5T339-341q-86-86-135.5-194T144-764q-2-21 12.29-36.5Q170.57-816 192-816h136q17 0 29.5 10.5T374-779l24 106q2 13-1.5 25T385-628l-97 98q20 38 46 73t57.97 65.98Q422-361 456-335.5q34 25.5 72 45.5l99-96q8-8 20-11.5t25-1.5l107 23q17 5 27 17.5t10 29.5v136q0 21.43-16 35.71Q784-143 763-145ZM255-600l70-70-17.16-74H218q5 38 14 73.5t23 70.5Zm344 344q35.1 14.24 71.55 22.62Q707-225 744-220v-90l-75-16-70 70ZM255-600Zm344 344Z" /></svg>
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
                        {(place.todayHours || realtimeOpenStatus === 'holiday' || isLoading) && (
                            <div className={`flex gap-3 p-4 rounded-xl border ${realtimeOpenStatus === 'holiday'
                                ? 'bg-gradient-to-r from-amber-50 to-orange-50/50 border-amber-200/50'
                                : 'bg-gradient-to-r from-emerald-50 to-teal-50/50 border-emerald-200/50'
                                }`}>
                                <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${realtimeOpenStatus === 'holiday' ? 'text-amber-500' : 'text-emerald-500'}`} xmlns="http://www.w3.org/2000/svg" height="19px" viewBox="0 -960 960 960" width="19px" fill="currentColor"><path d="m614-310 51-51-149-149v-210h-72v240l170 170ZM480-96q-79.38 0-149.19-30T208.5-208.5Q156-261 126-330.96t-30-149.5Q96-560 126-630q30-70 82.5-122t122.46-82q69.96-30 149.5-30t149.55 30.24q70 30.24 121.79 82.08 51.78 51.84 81.99 121.92Q864-559.68 864-480q0 79.38-30 149.19T752-208.5Q700-156 629.87-126T480-96Zm0-384Zm.48 312q129.47 0 220.5-91.5Q792-351 792-480.48q0-129.47-91.02-220.5Q609.95-792 480.48-792 351-792 259.5-700.98 168-609.95 168-480.48 168-351 259.5-259.5T480.48-168Z" /></svg>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-gray-500 mb-1">오늘 운영시간</p>
                                    {isLoading && !place.todayHours ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-sm text-gray-500">불러오는 중...</p>
                                        </div>
                                    ) : realtimeOpenStatus === 'holiday' ? (
                                        <p className="text-sm text-amber-700 font-bold">오늘은 휴일입니다</p>
                                    ) : place.todayHours ? (
                                        <p className="text-sm text-gray-900 font-bold">
                                            {place.todayHours.open} - {place.todayHours.close}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-gray-500">정보 없음</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 거리 */}
                        {place.distance !== undefined && (
                            <div className="flex gap-3 p-4 bg-gradient-to-r from-blue-50 to-sky-50/50 rounded-xl border border-blue-200/50">
                                <svg xmlns="http://www.w3.org/2000/svg" height="19px" viewBox="0 -960 960 960" width="19px" fill="#3b82f6"><path d="m147-257-51-51 196-196q35-35 85-35t85 35l34 34q14 14 34 14t34-14l177-178H624v-72h240v240h-72v-117L614-420q-35 35-85 35t-85-35l-33-33q-14-14-34-14t-34 14L147-257Z" /></svg>
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
                                <svg xmlns="http://www.w3.org/2000/svg" height="19px" viewBox="0 -960 960 960" width="19px" fill="white"><path d="M763-145q-121-9-229.5-59.5T339-341q-86-86-136-194.5T144-765q-2-21 12.5-36.5T192-817h136q17 0 29.5 10.5T374-780l24 107q2 13-1.5 25T385-628l-97 98q20 38 46 73t58 66q30 30 64 55.5t72 45.5l99-96q8-8 20-11.5t25-1.5l107 23q17 5 27 17.5t10 29.5v136q0 21-16 35.5T763-145Z" /></svg>
                                전화
                            </button>
                        )}

                        {/* 상세보기 버튼 */}
                        <button
                            onClick={handleDetailClick}
                            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-4 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" height="19px" viewBox="0 -960 960 960" width="19px" fill="white"><path d="M599-361q49-49 49-119t-49-119q-49-49-119-49t-119 49q-49 49-49 119t49 119q49 49 119 49t119-49Zm-187-51q-28-28-28-68t28-68q28-28 68-28t68 28q28 28 28 68t-28 68q-28 28-68 28t-68-28ZM220-270.5Q103-349 48-480q55-131 172-209.5T480-768q143 0 260 78.5T912-480q-55 131-172 209.5T480-192q-143 0-260-78.5Z" /></svg>
                            상세보기
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
