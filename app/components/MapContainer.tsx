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
    onMapIdle?: (center: Location, bounds: MapBounds, zoom: number) => void;
}

// 위치 요청 옵션
const GEOLOCATION_OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

// 기본 위치 (서울 시청)
const DEFAULT_LOCATION = { lat: 37.5665, lng: 126.978 };

// 마커 아이콘 SVG
const HOSPITAL_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>`;
const PHARMACY_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M4.5 10.5L10.5 4.5C11.3 3.7 12.7 3.7 13.5 4.5L19.5 10.5C20.3 11.3 20.3 12.7 19.5 13.5L13.5 19.5C12.7 20.3 11.3 20.3 10.5 19.5L4.5 13.5C3.7 12.7 3.7 11.3 4.5 10.5ZM13.5 7.5L7.5 13.5"/></svg>`;

// 마커 색상
const MARKER_COLORS = {
    hospital: { bg: 'linear-gradient(to right, #f43f5e, #ec4899)', arrow: '#f43f5e' },
    pharmacy: { bg: 'linear-gradient(to right, #10b981, #14b8a6)', arrow: '#10b981' },
    closed: { bg: '#9ca3af', arrow: '#9ca3af' },
};

export function MapContainer({ userLocation, places, onPlaceClick, onRefreshLocation, onMapIdle }: MapContainerProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<naver.maps.Map | null>(null);
    const markersRef = useRef<naver.maps.Marker[]>([]);
    const userMarkerRef = useRef<naver.maps.Marker | null>(null);
    const idleListenerRef = useRef<naver.maps.MapEventListener | null>(null);
    const isInitialMoveRef = useRef(true);

    const { isLoaded } = useNaverMap();
    const [isMapReady, setIsMapReady] = useState(false);
    const [selectedCluster, setSelectedCluster] = useState<{ places: Place[]; position: { x: number; y: number } } | null>(null);

    // 내 위치에서 다시 찾기
    const handleRefreshClick = useCallback(() => {
        if (!mapInstanceRef.current || !('geolocation' in navigator)) {
            onRefreshLocation();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                mapInstanceRef.current?.setCenter(
                    new window.naver.maps.LatLng(position.coords.latitude, position.coords.longitude)
                );
                onRefreshLocation();
            },
            () => onRefreshLocation(),
            GEOLOCATION_OPTIONS
        );
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

    // 지도 초기화
    useEffect(() => {
        if (!isLoaded || !mapRef.current || !window.naver?.maps) return;

        // 이미 지도 인스턴스가 있으면 ready 상태만 설정 (Strict Mode 대응)
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

            // 지도가 완전히 렌더링된 후 ready 상태 설정 (Safari 대응)
            const initListener = window.naver.maps.Event.addListener(map, 'idle', () => {
                setIsMapReady(true);
                window.naver.maps.Event.removeListener(initListener);
            });
        } catch {
            // 지도 초기화 실패
        }
    }, [isLoaded, userLocation]);

    // 초기 데이터 로드
    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current || !onMapIdle) return;

        // 지도 준비되면 초기 데이터 로드
        const info = extractMapInfo(mapInstanceRef.current);
        onMapIdle(info.center, info.bounds, info.zoom);
    }, [isMapReady]); // eslint-disable-line react-hooks/exhaustive-deps

    // idle 이벤트 핸들러 (지도 이동 시)
    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current || !onMapIdle) return;

        if (idleListenerRef.current) {
            window.naver.maps.Event.removeListener(idleListenerRef.current);
        }

        idleListenerRef.current = window.naver.maps.Event.addListener(mapInstanceRef.current, 'idle', () => {
            // 초기 로드는 위 useEffect에서 처리하므로 스킵
            if (isInitialMoveRef.current) {
                isInitialMoveRef.current = false;
            }
            setSelectedCluster(null);
            const info = extractMapInfo(mapInstanceRef.current!);
            onMapIdle(info.center, info.bounds, info.zoom);
        });

        return () => {
            if (idleListenerRef.current) {
                window.naver.maps.Event.removeListener(idleListenerRef.current);
            }
        };
    }, [isMapReady, onMapIdle, extractMapInfo]);

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

        if (isInitialMoveRef.current) {
            mapInstanceRef.current.setCenter(new window.naver.maps.LatLng(userLocation.lat, userLocation.lng));
        }
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

            {/* 내 위치에서 다시 찾기 버튼 */}
            <button
                onClick={handleRefreshClick}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 glass px-6 py-3.5 rounded-full shadow-xl border-2 border-white/50 flex items-center gap-2.5 hover:scale-105 active:scale-95 transition-all duration-300 z-10 group"
            >
                <svg className="w-5 h-5 text-blue-500 group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-bold text-gray-800">내 위치에서 다시 찾기</span>
            </button>

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
