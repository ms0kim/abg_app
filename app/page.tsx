'use client';

import { useEffect, useState, useCallback } from 'react';
import { NaverMapProvider } from './providers/NaverMapProvider';
import { MapContainer } from './components/MapContainer';
import { BottomSheet } from './components/BottomSheet';
import { InstallPrompt } from './components/InstallPrompt';
import { Place, Location, FilterType, MapBounds } from './types';

export default function HomePage() {
    const [userLocation, setUserLocation] = useState<Location | null>(null);
    const [places, setPlaces] = useState<Place[]>([]);
    const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);

    // 사용자 위치 가져오기
    useEffect(() => {
        const getLocation = () => {
            if ('geolocation' in navigator) {
                setIsLoading(true);
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const location = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        };
                        console.log('위치 감지 성공:', location);
                        setUserLocation(location);
                        setIsLoading(false);
                    },
                    (error) => {
                        console.error('위치 정보를 가져올 수 없습니다:', error);
                        // 기본 위치 (서울 시청)
                        setUserLocation({ lat: 37.5665, lng: 126.978 });
                        setError('위치 정보를 가져올 수 없어 기본 위치로 설정했습니다.');
                        setIsLoading(false);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 60000,
                    }
                );
            } else {
                // 기본 위치
                setUserLocation({ lat: 37.5665, lng: 126.978 });
                setError('위치 서비스를 지원하지 않는 브라우저입니다.');
            }
        };

        getLocation();
    }, []);

    // 장소가 bounds 내에 있는지 확인
    const isWithinBounds = useCallback((place: Place, bounds: MapBounds): boolean => {
        return (
            place.lat >= bounds.sw.lat &&
            place.lat <= bounds.ne.lat &&
            place.lng >= bounds.sw.lng &&
            place.lng <= bounds.ne.lng
        );
    }, []);

    // 병원과 약국 데이터 가져오기
    const fetchPlaces = useCallback(async (location: Location, bounds?: MapBounds, zoom?: number) => {
        setIsLoading(true);
        setError(null);

        // 줌 레벨에 따라 검색 개수 조정 (줌이 높을수록 좁은 영역 = 적은 개수)
        const numOfRows = zoom && zoom >= 16 ? 20 : zoom && zoom >= 14 ? 30 : 50;

        try {
            // 병원과 약국을 병렬로 조회
            const [hospitalsRes, pharmaciesRes] = await Promise.all([
                fetch(`/api/hospitals?lat=${location.lat}&lng=${location.lng}&numOfRows=${numOfRows}`),
                fetch(`/api/pharmacies?lat=${location.lat}&lng=${location.lng}&numOfRows=${numOfRows}`),
            ]);

            const hospitalsData = await hospitalsRes.json();
            const pharmaciesData = await pharmaciesRes.json();

            let hospitals: Place[] = hospitalsData.success ? hospitalsData.data : [];
            let pharmacies: Place[] = pharmaciesData.success ? pharmaciesData.data : [];

            // bounds가 있으면 해당 영역 내 장소만 필터링
            if (bounds) {
                hospitals = hospitals.filter((p) => isWithinBounds(p, bounds));
                pharmacies = pharmacies.filter((p) => isWithinBounds(p, bounds));
            }

            const allPlaces = [...hospitals, ...pharmacies];
            setPlaces(allPlaces);

            console.log(`총 ${allPlaces.length}개 장소 로드 (병원: ${hospitals.length}, 약국: ${pharmacies.length})`);
        } catch (error) {
            console.error('데이터 로드 실패:', error);
            setError('데이터를 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [isWithinBounds]);

    // 초기 데이터 로드
    useEffect(() => {
        if (userLocation) {
            fetchPlaces(userLocation);
        }
    }, [userLocation, fetchPlaces]);

    // 필터 적용 (bounds 내 장소만)
    useEffect(() => {
        let result = places;

        // bounds 필터링
        if (currentBounds) {
            result = result.filter((place) => isWithinBounds(place, currentBounds));
        }

        // 타입 필터링
        if (filter !== 'all') {
            result = result.filter((place) => place.type === filter);
        }

        setFilteredPlaces(result);
    }, [places, filter, currentBounds, isWithinBounds]);

    // 지도 이동 시 실시간 검색
    const handleMapIdle = useCallback(
        (center: Location, bounds: MapBounds, zoom: number) => {
            console.log('지도 이동 완료, 새 위치에서 검색:', center, 'zoom:', zoom);
            setCurrentBounds(bounds);
            fetchPlaces(center, bounds, zoom);
        },
        [fetchPlaces]
    );

    // 내 위치에서 다시 찾기
    const handleRefreshLocation = useCallback(() => {
        if ('geolocation' in navigator) {
            setIsLoading(true);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    console.log('위치 새로고침 성공:', location);
                    setUserLocation(location);
                    fetchPlaces(location);
                },
                (error) => {
                    console.error('위치 정보를 가져올 수 없습니다:', error);
                    setError('위치 정보를 가져올 수 없습니다.');
                    setIsLoading(false);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0, // 새로고침 시에는 캐시된 위치 사용 안함
                }
            );
        }
    }, [fetchPlaces]);

    return (
        <NaverMapProvider>
            <div className="relative w-full h-screen flex flex-col">
                {/* 헤더 */}
                <header className="relative bg-white shadow-md z-20">
                    <div className="relative px-4 py-4">
                        <h1 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">
                            🏥 동네건강지도
                        </h1>
                        <p className="text-sm text-gray-600">내 주변 병원과 약국을 찾아보세요</p>
                    </div>

                    {/* 필터 버튼 */}
                    <div className="relative px-4 pb-4 flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 ${filter === 'all'
                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <span className="flex items-center gap-1.5">
                                전체 <span className="font-bold">({places.length})</span>
                            </span>
                        </button>
                        <button
                            onClick={() => setFilter('hospital')}
                            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 ${filter === 'hospital'
                                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <span className="flex items-center gap-1.5">
                                🏥 병원 <span className="font-bold">({places.filter((p) => p.type === 'hospital').length})</span>
                            </span>
                        </button>
                        <button
                            onClick={() => setFilter('pharmacy')}
                            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 ${filter === 'pharmacy'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <span className="flex items-center gap-1.5">
                                💊 약국 <span className="font-bold">({places.filter((p) => p.type === 'pharmacy').length})</span>
                            </span>
                        </button>
                    </div>

                    {/* 에러 메시지 */}
                    {error && (
                        <div className="relative px-4 pb-3">
                            <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-3 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <p className="text-sm text-amber-800 font-medium">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 로딩 인디케이터 */}
                    {isLoading && (
                        <div className="relative px-4 pb-3">
                            <div className="bg-blue-50 border-l-4 border-blue-400 rounded-lg p-3 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="animate-spin rounded-full h-5 w-5 border-3 border-blue-600 border-t-transparent" />
                                        <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-pulse-glow" />
                                    </div>
                                    <p className="text-sm text-blue-800 font-medium">주변 병원과 약국을 검색하는 중...</p>
                                </div>
                            </div>
                        </div>
                    )}
                </header>

                {/* 지도 */}
                <div className="flex-1 relative">
                    <MapContainer
                        userLocation={userLocation}
                        places={filteredPlaces}
                        onPlaceClick={setSelectedPlace}
                        onRefreshLocation={handleRefreshLocation}
                        onMapIdle={handleMapIdle}
                    />
                </div>

                {/* 바텀시트 */}
                <BottomSheet place={selectedPlace} onClose={() => setSelectedPlace(null)} />

                {/* PWA 설치 프롬프트 */}
                <InstallPrompt />
            </div>
        </NaverMapProvider>
    );
}
