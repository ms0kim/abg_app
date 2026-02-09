'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNaverMap } from '../providers/NaverMapProvider';
import { Place, Location, MapBounds } from '../types';
import { MarkerClusterPopup } from './MarkerClusterPopup';
import { calculateOpenStatus } from '../utils/realtimeStatus';

interface MapContainerProps {
    userLocation: Location | null;
    places: Place[];
    onPlaceClick: (place: Place) => void;
    onRefreshLocation: () => void;
    onRefreshSearch?: () => void;
    onMapIdle?: (center: Location, bounds: MapBounds, zoom: number) => void;
    isLoading?: boolean;
    lastSearchCount?: number | null; // API에서 반환된 실제 검색 결과 개수
}

// 기본 위치 (서울 시청)
const DEFAULT_LOCATION = { lat: 37.5665, lng: 126.978 };

// 마커 아이콘 SVG
const HOSPITAL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="white"><path d="M371-196v-175H196v-217h175v-176h217v176h176v217H588v175H371Z"/></svg>`;
const PHARMACY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" height="19px" viewBox="0 -960 960 960" width="19px" fill="white"><path d="m654-357 101-100q29-29 45-68t16-81q0-87.73-61.13-148.87Q693.73-816 606-816q-42 0-81 16t-68 45L357-654l297 297ZM354-144q42 0 81-16t68-45l100-101-297-297-101 100q-29 29-45 68t-16 81q0 87.73 61.13 148.87Q266.27-144 354-144Z"/></svg>`;

// 마커 색상
const MARKER_COLORS = {
    hospital: { bg: 'linear-gradient(to right, #f43f5e, #ec4899)', arrow: '#f43f5e' },
    pharmacy: { bg: 'linear-gradient(to right, #10b981, #14b8a6)', arrow: '#10b981' },
    closed: { bg: '#9ca3af', arrow: '#9ca3af' },
};

export function MapContainer({ userLocation, places, onPlaceClick, onRefreshLocation, onRefreshSearch, onMapIdle, isLoading, lastSearchCount }: MapContainerProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<naver.maps.Map | null>(null);
    const markersRef = useRef<naver.maps.Marker[]>([]);
    const userMarkerRef = useRef<naver.maps.Marker | null>(null);
    const idleListenerRef = useRef<naver.maps.MapEventListener | null>(null);

    // 콜백 ref - 항상 최신 콜백을 참조하도록
    const onMapIdleRef = useRef(onMapIdle);
    useEffect(() => {
        onMapIdleRef.current = onMapIdle;
    }, [onMapIdle]);

    const { isLoaded } = useNaverMap();
    const [isMapReady, setIsMapReady] = useState(false);
    const [selectedCluster, setSelectedCluster] = useState<{ places: Place[]; position: { x: number; y: number } } | null>(null);

    // 검색 상태 UI 관리
    const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'loading' | 'success' | 'error' } | null>(null);
    const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const prevLoadingRef = useRef(isLoading);
    const prevSearchCountRef = useRef(lastSearchCount);

    // 로딩 시작 감지
    useEffect(() => {
        if (isLoading && !prevLoadingRef.current) {
            if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
            setStatusMessage({ text: '주변 병원·약국을 검색하고 있어요', type: 'loading' });
        }
        prevLoadingRef.current = isLoading;
    }, [isLoading]);

    // 검색 완료 감지 (lastSearchCount가 변경되면 결과 표시)
    useEffect(() => {
        // lastSearchCount가 숫자이고, 이전 값과 다르면 검색이 완료된 것
        if (typeof lastSearchCount === 'number' && lastSearchCount !== prevSearchCountRef.current) {
            if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);

            if (lastSearchCount > 0) {
                setStatusMessage({ text: '병원·약국을 찾았어요', type: 'success' });
            } else {
                setStatusMessage({ text: '주변에 검색된 장소가 없어요', type: 'error' });
            }
            // 2초 후 메시지 숨김
            statusTimeoutRef.current = setTimeout(() => {
                setStatusMessage(null);
            }, 2000);
        }
        prevSearchCountRef.current = lastSearchCount;
    }, [lastSearchCount]);

    // cleanup
    useEffect(() => {
        return () => {
            if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        };
    }, []);

    // 내 위치에서 다시 찾기
    const handleRefreshClick = useCallback(() => {
        onRefreshLocation();
    }, [onRefreshLocation]);

    // 지도 bounds 정보 추출
    const extractMapInfo = useCallback((map: naver.maps.Map) => {
        const center = map.getCenter() as naver.maps.LatLng;
        const bounds = map.getBounds() as naver.maps.LatLngBounds;
        return {
            center: { lat: center.lat(), lng: center.lng() },
            bounds: {
                sw: { lat: bounds.getSW().lat(), lng: bounds.getSW().lng() },
                ne: { lat: bounds.getNE().lat(), lng: bounds.getNE().lng() },
            },
            zoom: map.getZoom(),
        };
    }, []);

    // handleIdle 함수를 ref로 관리하여 다른 useEffect에서도 사용 가능하게
    const handleIdleRef = useRef<(() => void) | null>(null);

    // 지도 초기화 및 이벤트 등록
    useEffect(() => {
        if (!isLoaded || !mapRef.current || !window.naver?.maps) return;

        // 이미 지도 인스턴스가 있으면 ready 상태만 설정
        if (mapInstanceRef.current) {
            setIsMapReady(true);
            return;
        }

        const center = userLocation || DEFAULT_LOCATION;

        try {
            const map = new window.naver.maps.Map(mapRef.current, {
                center: new window.naver.maps.LatLng(center.lat, center.lng),
                zoom: 16,
                minZoom: 10,
                maxZoom: 19,
                zoomControl: true,
                zoomControlOptions: { position: window.naver.maps.Position.TOP_RIGHT },
            });

            mapInstanceRef.current = map;

            // 지도 로드 완료 및 이동 이벤트 통합 처리
            const handleIdle = () => {
                setSelectedCluster(null);
                if (onMapIdleRef.current && mapInstanceRef.current) {
                    const info = extractMapInfo(mapInstanceRef.current);
                    onMapIdleRef.current(info.center, info.bounds, info.zoom);
                }
            };

            // handleIdle을 ref에 저장하여 다른 useEffect에서도 호출 가능하게
            handleIdleRef.current = handleIdle;

            // 즉시 ready 상태로 설정하여 마커 등이 그려질 수 있게 함
            setIsMapReady(true);

            // 지도 렌더링이 완료된 후 초기 검색 실행 (requestAnimationFrame으로 DOM 안정화 대기)
            requestAnimationFrame(() => {
                setTimeout(() => {
                    handleIdle();
                }, 100);
            });

            // 이후 이동에 대해 지속적 리스너 등록
            idleListenerRef.current = window.naver.maps.Event.addListener(map, 'idle', handleIdle);

        } catch (e) {
            console.error('지도 초기화 실패:', e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, extractMapInfo]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (idleListenerRef.current) {
                window.naver.maps.Event.removeListener(idleListenerRef.current);
            }
        };
    }, []);

    // 사용자 위치 마커
    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current || !userLocation) return;

        userMarkerRef.current?.setMap(null);

        userMarkerRef.current = new window.naver.maps.Marker({
            position: new window.naver.maps.LatLng(userLocation.lat, userLocation.lng),
            map: mapInstanceRef.current,
            icon: {
                content: `<div style="width:24px;height:24px;background:#3b82f6;border:4px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.5)"></div>`,
                anchor: new window.naver.maps.Point(12, 12),
            },
            zIndex: 1000,
        });

        mapInstanceRef.current.setCenter(new window.naver.maps.LatLng(userLocation.lat, userLocation.lng));
        // setCenter 호출 시 자동으로 idle 이벤트가 발생하므로 별도 호출 불필요
    }, [isMapReady, userLocation]);

    // 장소 클러스터링
    const clusterPlaces = useCallback((places: Place[]) => {
        const clusters: Place[][] = [];

        for (const place of places) {
            let matched: Place[] | null = null;

            for (const cluster of clusters) {
                const rep = cluster[0];

                // 주소 일치 또는 근접 좌표
                if (
                    (place.address && rep.address && place.address === rep.address) ||
                    (place.distance !== undefined && rep.distance !== undefined &&
                        Math.abs(place.distance - rep.distance) <= 10 &&
                        Math.abs(place.lat - rep.lat) < 0.0005 &&
                        Math.abs(place.lng - rep.lng) < 0.0005) ||
                    (Math.abs(place.lat - rep.lat) < 0.000005 && Math.abs(place.lng - rep.lng) < 0.000005)
                ) {
                    matched = cluster;
                    break;
                }
            }

            matched ? matched.push(place) : clusters.push([place]);
        }

        return clusters;
    }, []);

    // 마커 콘텐츠 생성
    const createMarkerContent = useCallback((place: Place) => {
        const isHospital = place.type === 'hospital';
        const { isOpen } = place.todayTimeRaw ? calculateOpenStatus(place.todayTimeRaw) : { isOpen: place.isOpen };

        const colors = isOpen ? MARKER_COLORS[place.type] : MARKER_COLORS.closed;
        const icon = isHospital ? HOSPITAL_ICON : PHARMACY_ICON;

        return `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.3))">
                <div style="position:relative;z-index:2;width:36px;height:36px;background:${colors.bg};border-radius:50%;display:flex;align-items:center;justify-content:center">${icon}</div>
                <div style="position:relative;z-index:1;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid ${colors.arrow};margin-top:-4px"></div>
            </div>
        `;
    }, []);

    // 단일 마커 생성
    const createPlaceMarker = useCallback((place: Place): naver.maps.Marker | null => {
        if (!mapInstanceRef.current) return null;

        try {
            const marker = new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(place.lat, place.lng),
                map: mapInstanceRef.current,
                icon: { content: createMarkerContent(place), anchor: new window.naver.maps.Point(18, 44) },
            });

            window.naver.maps.Event.addListener(marker, 'click', () => onPlaceClick(place));
            return marker;
        } catch {
            return null;
        }
    }, [createMarkerContent, onPlaceClick]);

    // 클러스터 마커 생성
    const createClusterMarker = useCallback((clusterPlaces: Place[]): naver.maps.Marker | null => {
        if (!mapInstanceRef.current || clusterPlaces.length === 0) return null;
        if (clusterPlaces.length === 1) return createPlaceMarker(clusterPlaces[0]);

        try {
            const first = clusterPlaces[0];
            const content = `
                <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer">
                    <div style="position:relative;z-index:2;width:36px;height:36px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(59,130,246,0.4);border:2px solid #3b82f6">
                        <span style="color:#2563eb;font-size:15px;font-weight:bold;font-family:-apple-system,sans-serif">${clusterPlaces.length}</span>
                    </div>
                    <div style="position:relative;z-index:1;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid #3b82f6;margin-top:-2px"></div>
                </div>
            `;

            const marker = new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(first.lat, first.lng),
                map: mapInstanceRef.current,
                icon: { content, anchor: new window.naver.maps.Point(22, 54) },
                zIndex: 100,
            });

            window.naver.maps.Event.addListener(marker, 'click', () => {
                const map = mapInstanceRef.current!;
                const projection = map.getProjection();
                const offset = projection.fromCoordToOffset(marker.getPosition());
                const bounds = map.getBounds() as naver.maps.LatLngBounds;
                const topLeft = projection.fromCoordToOffset(
                    new window.naver.maps.LatLng(bounds.getNE().lat(), bounds.getSW().lng())
                );
                setSelectedCluster({ places: clusterPlaces, position: { x: offset.x - topLeft.x, y: offset.y - topLeft.y } });
            });

            return marker;
        } catch {
            return null;
        }
    }, [createPlaceMarker]);

    // 마커 업데이트
    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current) return;

        // 기존 마커 제거
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        // 모바일에서 지도 렌더링 완료 후 마커 생성 (Safari 대응)
        const rafId = requestAnimationFrame(() => {
            if (!mapInstanceRef.current) return;

            markersRef.current = clusterPlaces(places)
                .map((cluster) => createClusterMarker(cluster))
                .filter((m): m is naver.maps.Marker => m !== null);
        });

        return () => cancelAnimationFrame(rafId);
    }, [isMapReady, places, clusterPlaces, createClusterMarker]);

    if (!isLoaded) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">지도를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full">
            <div ref={mapRef} className="w-full h-full" style={{ minHeight: '400px' }} />

            {/* 검색 상태 인디케이터 */}
            {statusMessage && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 transition-all duration-300">
                    <div className={`px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 ${statusMessage.type === 'loading' ? 'glass' :
                        statusMessage.type === 'success' ? 'bg-emerald-500 text-white' :
                            'bg-gray-500 text-white'
                        }`}>
                        {statusMessage.type === 'loading' ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                        ) : statusMessage.type === 'success' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" /></svg>
                        )}
                        <span className={`text-xs font-medium ${statusMessage.type === 'loading' ? 'text-gray-700' : 'text-white'
                            }`}>{statusMessage.text}</span>
                    </div>
                </div>
            )}

            {/* 범례 */}
            <div className="absolute top-4 left-4 glass rounded-2xl p-4 text-xs z-10 shadow-lg">
                <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 shadow-md" />
                        <span className="text-gray-700 font-medium">병원 (영업중)</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md" />
                        <span className="text-gray-700 font-medium">약국 (영업중)</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-gray-400 shadow-md" />
                        <span className="text-gray-700 font-medium">영업종료 / 휴일</span>
                    </div>
                </div>
            </div>

            {/* 하단 버튼 영역 */}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {/* 내 위치에서 다시 찾기 버튼 */}
                <button
                    onClick={handleRefreshClick}
                    className="glass px-5 py-3 rounded-full shadow-xl border-2 border-white/50 flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all duration-300 whitespace-nowrap"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#3b82f6" className="flex-shrink-0"><path d="M536.5-503.5Q560-527 560-560t-23.5-56.5Q513-640 480-640t-56.5 23.5Q400-593 400-560t23.5 56.5Q447-480 480-480t56.5-23.5ZM480-186q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z" /></svg>
                    <span className="text-xs font-bold text-gray-800">내 위치</span>
                </button>

                {/* 현재 지도 위치에서 재검색 버튼 */}
                {onRefreshSearch && (
                    <button
                        onClick={onRefreshSearch}
                        className="glass px-5 py-3 rounded-full shadow-xl border-2 border-emerald-200 flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all duration-300 whitespace-nowrap"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#10b981" className="flex-shrink-0"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 178t-196 72Z" /></svg>
                        <span className="text-xs font-bold text-gray-800">재검색</span>
                    </button>
                )}
            </div>

            {selectedCluster && (
                <MarkerClusterPopup
                    places={selectedCluster.places}
                    onPlaceClick={onPlaceClick}
                    onClose={() => setSelectedCluster(null)}
                    position={selectedCluster.position}
                />
            )}
        </div>
    );
}
