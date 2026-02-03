import { useState, useCallback, useEffect } from 'react';
import { Place, Location, MapBounds, FilterType } from '../types';

// 위치 요청 옵션
const GEOLOCATION_OPTIONS = {
    fast: { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 },
    accurate: { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
};

// 기본 위치 (서울 시청)
const DEFAULT_LOCATION: Location = { lat: 37.5665, lng: 126.978 };

export function usePlaces() {
    const [userLocation, setUserLocation] = useState<Location | null>(null);
    const [places, setPlaces] = useState<Place[]>([]);
    const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');
    const [isLoading, setIsLoading] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);

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

        // 줌 레벨에 따라 검색 개수 조정
        const numOfRows = zoom && zoom >= 16 ? 50 : zoom && zoom >= 14 ? 100 : 200;

        try {
            // 주소 정보 가져오기 (Reverse Geocoding)
            let sido = '';
            let gungu = '';

            if (window.naver?.maps?.Service) {
                try {
                    const addressInfo = await new Promise<{ sido: string; gungu: string }>((resolve) => {
                        window.naver.maps.Service.reverseGeocode(
                            { coords: new window.naver.maps.LatLng(location.lat, location.lng) },
                            (status, response) => {
                                if (status !== window.naver.maps.Service.Status.OK) {
                                    resolve({ sido: '', gungu: '' });
                                    return;
                                }
                                const region = response.v2?.results?.[0]?.region;
                                resolve(region ? { sido: region.area1.name, gungu: region.area2.name } : { sido: '', gungu: '' });
                            }
                        );
                    });
                    sido = addressInfo.sido;
                    gungu = addressInfo.gungu;
                } catch {
                    // Reverse Geocoding 실패 시 무시
                }
            }

            // 병원과 약국을 병렬로 조회
            const [hospitalsRes, pharmaciesRes] = await Promise.all([
                fetch(`/api/hospitals?lat=${location.lat}&lng=${location.lng}&numOfRows=${numOfRows}&sido=${encodeURIComponent(sido)}&gungu=${encodeURIComponent(gungu)}`),
                fetch(`/api/pharmacies?lat=${location.lat}&lng=${location.lng}&numOfRows=${numOfRows}`),
            ]);

            const [hospitalsData, pharmaciesData] = await Promise.all([
                hospitalsRes.json(),
                pharmaciesRes.json(),
            ]);

            let hospitals: Place[] = hospitalsData.success ? hospitalsData.data : [];
            let pharmacies: Place[] = pharmaciesData.success ? pharmaciesData.data : [];

            // bounds가 있으면 해당 영역 내 장소만 필터링
            if (bounds) {
                hospitals = hospitals.filter((p) => isWithinBounds(p, bounds));
                pharmacies = pharmacies.filter((p) => isWithinBounds(p, bounds));
            }

            setPlaces([...hospitals, ...pharmacies]);
        } catch {
            setError('데이터를 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [isWithinBounds]);

    // 사용자 위치 가져오기 (2단계: 빠른 위치 → 고정밀 위치)
    useEffect(() => {
        if (!('geolocation' in navigator)) {
            setUserLocation(DEFAULT_LOCATION);
            setError('위치 서비스를 지원하지 않는 브라우저입니다.');
            return;
        }

        setIsLoading(true);
        let hasReceivedLocation = false;

        // 1단계: 빠른 위치 (캐시 허용)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (!hasReceivedLocation) {
                    setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                    hasReceivedLocation = true;
                }
            },
            () => {},
            GEOLOCATION_OPTIONS.fast
        );

        // 2단계: 고정밀 위치 (GPS)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                hasReceivedLocation = true;
                setIsLoading(false);
            },
            () => {
                if (!hasReceivedLocation) {
                    setUserLocation(DEFAULT_LOCATION);
                    setError('위치 정보를 가져올 수 없어 기본 위치로 설정했습니다.');
                }
                setIsLoading(false);
            },
            GEOLOCATION_OPTIONS.accurate
        );
    }, []);

    // 초기 데이터 로드
    useEffect(() => {
        if (userLocation) {
            fetchPlaces(userLocation);
        }
    }, [userLocation, fetchPlaces]);

    // 필터 적용
    useEffect(() => {
        let result = places;

        if (currentBounds) {
            result = result.filter((place) => isWithinBounds(place, currentBounds));
        }

        if (filter !== 'all') {
            result = result.filter((place) => place.type === filter);
        }

        setFilteredPlaces(result);
    }, [places, filter, currentBounds, isWithinBounds]);

    // 지도 이동 시 실시간 검색
    const handleMapIdle = useCallback(
        (center: Location, bounds: MapBounds, zoom: number) => {
            setCurrentBounds(bounds);
            fetchPlaces(center, bounds, zoom);
        },
        [fetchPlaces]
    );

    // 내 위치에서 다시 찾기
    const handleRefreshLocation = useCallback(() => {
        if (!('geolocation' in navigator)) return;

        setIsLoading(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = { lat: position.coords.latitude, lng: position.coords.longitude };
                setUserLocation(location);
                fetchPlaces(location);
            },
            (err) => {
                const messages: Record<number, string> = {
                    [err.PERMISSION_DENIED]: '위치 권한이 거부되었습니다.',
                    [err.POSITION_UNAVAILABLE]: '위치 정보를 사용할 수 없습니다.',
                    [err.TIMEOUT]: '위치 요청 시간이 초과되었습니다.',
                };
                setError(messages[err.code] || '위치 정보를 가져올 수 없습니다.');
                setIsLoading(false);
            },
            GEOLOCATION_OPTIONS.accurate
        );
    }, [fetchPlaces]);

    // 장소 클릭 핸들러
    const handlePlaceClick = useCallback(async (place: Place) => {
        // todayTimeRaw가 있으면 상세 API 호출 불필요
        if (place.type === 'hospital' && !place.todayTimeRaw && !place.id.startsWith('hospital_')) {
            setIsDetailLoading(true);
            setSelectedPlace(place);

            try {
                const response = await fetch(`/api/hospitals/detail?hpid=${place.id}`);
                const result = await response.json();

                if (result.success && result.data) {
                    setSelectedPlace((prev) => (prev?.id === place.id ? { ...prev, ...result.data } : prev));
                    setPlaces((prev) => prev.map((p) => (p.id === place.id ? { ...p, ...result.data } : p)));
                }
            } catch {
                // 상세 정보 로드 실패 시 기본 정보 유지
            } finally {
                setIsDetailLoading(false);
            }
        } else {
            setSelectedPlace(place);
        }
    }, []);

    return {
        userLocation,
        places,
        filteredPlaces,
        selectedPlace,
        setSelectedPlace,
        filter,
        setFilter,
        isLoading,
        isDetailLoading,
        error,
        handleMapIdle,
        handleRefreshLocation,
        handlePlaceClick,
    };
}
