'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNaverMap } from '../providers/NaverMapProvider';
import { Place, Location, MapBounds } from '../types';
import { MarkerClusterPopup } from './MarkerClusterPopup';

interface MapContainerProps {
    userLocation: Location | null;
    places: Place[];
    onPlaceClick: (place: Place) => void;
    onRefreshLocation: () => void;
    onMapIdle?: (center: Location, bounds: MapBounds, zoom: number) => void;
}

export function MapContainer({
    userLocation,
    places,
    onPlaceClick,
    onRefreshLocation,
    onMapIdle,
}: MapContainerProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<naver.maps.Map | null>(null);
    const markersRef = useRef<naver.maps.Marker[]>([]);
    const userMarkerRef = useRef<naver.maps.Marker | null>(null);
    const idleListenerRef = useRef<naver.maps.MapEventListener | null>(null);
    const { isLoaded } = useNaverMap();
    const [isMapReady, setIsMapReady] = useState(false);
    const isInitialMoveRef = useRef(true);
    const [selectedCluster, setSelectedCluster] = useState<{ places: Place[]; position: { x: number; y: number } } | null>(null);

    // 지도 초기화 - isLoaded만 의존성으로
    useEffect(() => {
        if (!isLoaded || !mapRef.current) return;

        // 이미 초기화되어 있으면 스킵
        if (mapInstanceRef.current) return;

        // window.naver.maps가 실제로 존재하는지 확인
        if (!window.naver?.maps) {
            console.error('Naver Maps SDK not loaded');
            return;
        }

        const defaultCenter = userLocation || { lat: 37.5665, lng: 126.978 };

        try {
            const map = new window.naver.maps.Map(mapRef.current, {
                center: new window.naver.maps.LatLng(defaultCenter.lat, defaultCenter.lng),
                zoom: 15,
                minZoom: 10,
                maxZoom: 19,
                zoomControl: true,
                zoomControlOptions: {
                    position: window.naver.maps.Position.TOP_RIGHT,
                },
            });

            mapInstanceRef.current = map;

            // 지도 이동 완료 이벤트 (idle) 핸들러
            if (onMapIdle) {
                idleListenerRef.current = window.naver.maps.Event.addListener(map, 'idle', () => {
                    // 초기 이동은 무시
                    if (isInitialMoveRef.current) {
                        isInitialMoveRef.current = false;
                        return;
                    }

                    const center = map.getCenter() as naver.maps.LatLng;
                    const mapBounds = map.getBounds() as naver.maps.LatLngBounds;
                    const zoom = map.getZoom();

                    onMapIdle(
                        { lat: center.lat(), lng: center.lng() },
                        {
                            sw: { lat: mapBounds.getSW().lat(), lng: mapBounds.getSW().lng() },
                            ne: { lat: mapBounds.getNE().lat(), lng: mapBounds.getNE().lng() },
                        },
                        zoom
                    );
                });
            }

            setIsMapReady(true);
        } catch (error) {
            console.error('지도 초기화 실패:', error);
        }

        // Cleanup
        return () => {
            if (idleListenerRef.current && mapInstanceRef.current) {
                window.naver.maps.Event.removeListener(idleListenerRef.current);
            }
        };
    }, [isLoaded]); // userLocation 제거 - 초기화는 한번만

    // idle 핸들러 업데이트 (placeFilter 변경 시 재연결)
    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current || !onMapIdle) return;

        // 기존 리스너 제거
        if (idleListenerRef.current) {
            window.naver.maps.Event.removeListener(idleListenerRef.current);
        }

        // 새 리스너 등록
        idleListenerRef.current = window.naver.maps.Event.addListener(
            mapInstanceRef.current,
            'idle',
            () => {
                if (isInitialMoveRef.current) {
                    isInitialMoveRef.current = false;
                    return;
                }

                const map = mapInstanceRef.current!;
                const center = map.getCenter() as naver.maps.LatLng;
                const mapBounds = map.getBounds() as naver.maps.LatLngBounds;
                const zoom = map.getZoom();

                onMapIdle(
                    { lat: center.lat(), lng: center.lng() },
                    {
                        sw: { lat: mapBounds.getSW().lat(), lng: mapBounds.getSW().lng() },
                        ne: { lat: mapBounds.getNE().lat(), lng: mapBounds.getNE().lng() },
                    },
                    zoom
                );
            }
        );

        return () => {
            if (idleListenerRef.current) {
                window.naver.maps.Event.removeListener(idleListenerRef.current);
            }
        };
    }, [isMapReady, onMapIdle]);

    // 사용자 위치 마커 업데이트
    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current || !userLocation) return;

        // 기존 사용자 마커 제거
        if (userMarkerRef.current) {
            userMarkerRef.current.setMap(null);
        }

        // 새 사용자 위치 마커 생성
        const marker = new window.naver.maps.Marker({
            position: new window.naver.maps.LatLng(userLocation.lat, userLocation.lng),
            map: mapInstanceRef.current,
            icon: {
                content: `
          <div style="
            width: 24px;
            height: 24px;
            background: #3b82f6;
            border: 4px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
          "></div>
        `,
                anchor: new window.naver.maps.Point(12, 12),
            },
            zIndex: 1000,
        });

        userMarkerRef.current = marker;

        // 지도 중심 이동 (초기 로딩 시에만)
        if (isInitialMoveRef.current) {
            mapInstanceRef.current.setCenter(
                new window.naver.maps.LatLng(userLocation.lat, userLocation.lng)
            );
        }
    }, [isMapReady, userLocation]);

    // 장소들을 좌표별로 클러스터링
    const clusterPlaces = useCallback((places: Place[]) => {
        const clusters = new Map<string, Place[]>();

        places.forEach((place) => {
            // 좌표를 키로 사용 (소수점 6자리까지 - 약 0.1m 정밀도)
            // API에서 문자열로 올 수 있으므로 Number로 변환
            const key = `${Number(place.lat).toFixed(6)},${Number(place.lng).toFixed(6)}`;

            if (!clusters.has(key)) {
                clusters.set(key, []);
            }
            clusters.get(key)!.push(place);
        });

        return Array.from(clusters.values());
    }, []);

    // 클러스터 마커 생성
    const createClusterMarker = useCallback(
        (clusterPlaces: Place[]): naver.maps.Marker | null => {
            if (!mapInstanceRef.current || clusterPlaces.length === 0) return null;

            const firstPlace = clusterPlaces[0];
            const count = clusterPlaces.length;

            // 단일 마커는 기존 방식 사용
            if (count === 1) {
                return createPlaceMarker(firstPlace);
            }

            // 클러스터 마커 (파란색 원형 + 숫자)
            const markerContent = `
                <div style="
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    cursor: pointer;
                ">
                    <div style="
                        position: relative;
                        z-index: 2;
                        width: 44px;
                        height: 44px;
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                        border: 3px solid white;
                    ">
                        <span style="
                            color: white;
                            font-size: 16px;
                            font-weight: bold;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        ">${count}</span>
                    </div>
                    <div style="
                        position: relative;
                        z-index: 1;
                        width: 0;
                        height: 0;
                        border-left: 10px solid transparent;
                        border-right: 10px solid transparent;
                        border-top: 10px solid #2563eb;
                        margin-top: -3px;
                    "></div>
                </div>
            `;

            const marker = new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(firstPlace.lat, firstPlace.lng),
                map: mapInstanceRef.current,
                icon: {
                    content: markerContent,
                    anchor: new window.naver.maps.Point(22, 54),
                },
                zIndex: 100,
            });

            // 클러스터 클릭 시 팝업 표시
            window.naver.maps.Event.addListener(marker, 'click', () => {
                if (!mapInstanceRef.current) return;

                const position = marker.getPosition() as naver.maps.LatLng;
                const projection = mapInstanceRef.current.getProjection();
                const point = projection.fromCoordToOffset(position);

                setSelectedCluster({
                    places: clusterPlaces,
                    position: { x: point.x, y: point.y },
                });
            });

            return marker;
        },
        []
    );

    // 장소 마커 생성
    const createPlaceMarker = useCallback(
        (place: Place): naver.maps.Marker | null => {
            if (!mapInstanceRef.current) return null;

            const isHospital = place.type === 'hospital';

            // 병원: 빨강(영업중) / 회색(영업종료)
            // 약국: 초록(영업중) / 회색(영업종료)
            let bgColor: string;
            if (place.isOpen) {
                bgColor = isHospital ? '#ef4444' : '#22c55e'; // 빨강 / 초록
            } else {
                bgColor = '#9ca3af'; // 회색
            }

            const icon = isHospital
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
          </svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M4.22 11.29l6.07 6.07c1.56 1.56 4.09 1.56 5.66 0l4.07-4.07c1.56-1.56 1.56-4.09 0-5.66l-6.07-6.07c-1.56-1.56-4.09-1.56-5.66 0L4.22 5.63c-1.56 1.57-1.56 4.1 0 5.66zm7.48-4.9l4.95 4.95-2.12 2.12-4.95-4.95 2.12-2.12z"/>
          </svg>`;

            // 영업 상태 표시 (점)
            const statusDot = place.isOpen
                ? '' // 영업중이면 표시 안함
                : `<div style="
            position: absolute;
            top: -4px;
            right: -4px;
            width: 10px;
            height: 10px;
            background: #ef4444;
            border: 2px solid white;
            border-radius: 50%;
          "></div>`;

            const markerContent = `
        <div style="
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
        ">
          <div style="
            position: relative;
            z-index: 2;
            width: 36px;
            height: 36px;
            background: ${bgColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            border: 2px solid white;
          ">
            ${icon}
          </div>
          <div style="
            position: relative;
            z-index: 1;
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 8px solid ${bgColor};
            margin-top: -2px;
          "></div>
          ${statusDot}
        </div>
      `;

            const marker = new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(place.lat, place.lng),
                map: mapInstanceRef.current,
                icon: {
                    content: markerContent,
                    anchor: new window.naver.maps.Point(18, 44),
                },
            });

            window.naver.maps.Event.addListener(marker, 'click', () => {
                onPlaceClick(place);
            });

            return marker;
        },
        [onPlaceClick]
    );

    // 장소 마커들 업데이트 (클러스터링 적용)
    useEffect(() => {
        if (!isMapReady) return;

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        // 장소들을 클러스터링
        const clustered = clusterPlaces(places);

        // 각 클러스터에 대해 마커 생성
        const newMarkers = clustered
            .map((cluster) => createClusterMarker(cluster))
            .filter((marker): marker is naver.maps.Marker => marker !== null);

        markersRef.current = newMarkers;
    }, [isMapReady, places, clusterPlaces, createClusterMarker]);

    // 로딩 상태
    if (!isLoaded) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">지도를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full">
            {/* 지도 컨테이너 - 명시적 높이 지정 */}
            <div
                ref={mapRef}
                className="w-full h-full"
                style={{ minHeight: '400px' }}
            />

            {/* 범례 */}
            <div className="absolute top-4 left-4 glass rounded-2xl p-4 text-xs z-10 shadow-lg">
                <div className="font-bold text-gray-800 mb-3 text-sm">범례</div>
                <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 shadow-md"></div>
                        <span className="text-gray-700 font-medium">병원 (영업중)</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md"></div>
                        <span className="text-gray-700 font-medium">약국 (영업중)</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-gray-400 shadow-md"></div>
                        <span className="text-gray-700 font-medium">영업종료</span>
                    </div>
                </div>
            </div>

            {/* 내 위치에서 다시 찾기 버튼 */}
            <button
                onClick={onRefreshLocation}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 glass px-6 py-3.5 rounded-full shadow-xl border-2 border-white/50 flex items-center gap-2.5 hover:scale-105 active:scale-95 transition-all duration-300 z-10 group"
            >
                <svg
                    className="w-5 h-5 text-blue-500 group-hover:rotate-12 transition-transform duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                </svg>
                <span className="text-sm font-bold text-gray-800">
                    내 위치에서 다시 찾기
                </span>
            </button>

            {/* 클러스터 팝업 */}
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
