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
    useEffect(() => {
        const openCount = places.filter(p => p.isOpen).length;
        const closedCount = places.length - openCount;
        console.log(`MapContainer received ${places.length} places (Open: ${openCount}, Closed: ${closedCount})`);
    }, [places]);
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
            return;
        }

        const defaultCenter = userLocation || { lat: 37.5665, lng: 126.978 };

        try {
            const map = new window.naver.maps.Map(mapRef.current, {
                center: new window.naver.maps.LatLng(defaultCenter.lat, defaultCenter.lng),
                zoom: 16,
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

                // 지도 이동 시 팝업 닫기
                setSelectedCluster(null);

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
        const clusters: Place[][] = [];

        places.forEach((place) => {
            let matchedCluster: Place[] | null = null;

            // 기존 클러스터들과 비교
            for (const cluster of clusters) {
                const representative = cluster[0];

                // 1. 주소가 같으면 같은 클러스터 (가장 강력한 조건)
                if (place.address && representative.address && place.address === representative.address) {
                    matchedCluster = cluster;
                    break;
                }

                // 2. 거리(distance)가 비슷하고 물리적 위치도 가까우면 같은 클러스터
                // 사용자가 "나와 떨어진 거리의 기준"으로 묶이길 원함
                if (place.distance !== undefined && representative.distance !== undefined) {
                    const distanceDiff = Math.abs(place.distance - representative.distance);

                    // 거리가 10m 이내로 차이나면 같은 거리로 간주
                    if (distanceDiff <= 10) {
                        const latDiff = Math.abs(place.lat - representative.lat);
                        const lngDiff = Math.abs(place.lng - representative.lng);

                        // 좌표상으로도 가까워야 함 (약 50m 이내, 0.0005도)
                        if (latDiff < 0.0005 && lngDiff < 0.0005) {
                            matchedCluster = cluster;
                            break;
                        }
                    }
                }

                // 3. 좌표 정밀 일치 (백업)
                // 소수점 6자리 오차 범위 (약 0.1m)
                if (Math.abs(place.lat - representative.lat) < 0.000005 &&
                    Math.abs(place.lng - representative.lng) < 0.000005) {
                    matchedCluster = cluster;
                    break;
                }
            }

            if (matchedCluster) {
                matchedCluster.push(place);
            } else {
                clusters.push([place]);
            }
        });

        return clusters;
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
                        width: 36px;
                        height: 36px;
                        background: #ffffff;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                        border: 2px solid #3b82f6;
                    ">
                        <span style="
                            color: #2563eb;
                            font-size: 15px;
                            font-weight: bold;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        ">${count}</span>
                    </div>
                    <div style="
                        position: relative;
                        z-index: 1;
                        width: 0;
                        height: 0;
                        border-left: 8px solid transparent;
                        border-right: 8px solid transparent;
                        border-top: 8px solid #3b82f6;
                        margin-top: -2px;
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

                const map = mapInstanceRef.current;
                const position = marker.getPosition();
                const projection = map.getProjection();

                // 마커의 오프셋 좌표
                const offset = projection.fromCoordToOffset(position);

                // 현재 지도 영역의 좌상단 오프셋 좌표 구하기
                const bounds = map.getBounds() as naver.maps.LatLngBounds;
                const northWest = new window.naver.maps.LatLng(
                    bounds.getNE().lat(),
                    bounds.getSW().lng()
                );
                const topLeft = projection.fromCoordToOffset(northWest);

                // 지도 컨테이너 기준 상대 좌표 계산
                const x = offset.x - topLeft.x;
                const y = offset.y - topLeft.y;

                setSelectedCluster({
                    places: clusterPlaces,
                    position: { x, y },
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

            // 병원: Rose-Pink Gradient
            // 약국: Emerald-Teal Gradient
            let bgStyle: string;
            let arrowColor: string;

            if (place.isOpen) {
                if (isHospital) {
                    bgStyle = 'linear-gradient(to right, #f43f5e, #ec4899)'; // rose-500 to pink-500
                    arrowColor = '#f43f5e'; // rose-500
                } else {
                    bgStyle = 'linear-gradient(to right, #10b981, #14b8a6)'; // emerald-500 to teal-500
                    arrowColor = '#10b981'; // emerald-500
                }
            } else {
                bgStyle = '#9ca3af'; // gray-400
                arrowColor = '#9ca3af';
            }

            const icon = isHospital
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
          </svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M4.5 10.5L10.5 4.5C11.3 3.7 12.7 3.7 13.5 4.5L19.5 10.5C20.3 11.3 20.3 12.7 19.5 13.5L13.5 19.5C12.7 20.3 11.3 20.3 10.5 19.5L4.5 13.5C3.7 12.7 3.7 11.3 4.5 10.5ZM13.5 7.5L7.5 13.5"/>
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
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          "></div>`;

            const markerContent = `
        <div style="
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));
        ">
          <div style="
            position: relative;
            z-index: 2;
            width: 36px;
            height: 36px;
            background: ${bgStyle};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
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
            border-top: 10px solid ${arrowColor};
            margin-top: -4px;
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
