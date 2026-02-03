import { useState, useCallback, useEffect, useRef } from 'react';
import { Place, Location, MapBounds, FilterType } from '../types';

// 위치 요청 옵션
const GEOLOCATION_OPTIONS = {
    fast: { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 },
    accurate: { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
};

// 기본 위치 (서울 시청)
const DEFAULT_LOCATION: Location = { lat: 37.5665, lng: 126.978 };

// 최적화 설정
const DEBOUNCE_MS = 300; // 지도 이동 후 API 호출 대기 시간
const MIN_MOVE_THRESHOLD = 0.3; // bounds 30% 이상 이동 시에만 재검색

/**
 * 두 bounds가 충분히 다른지 확인 (최적화용)
 */
function shouldRefetch(prev: MapBounds | null, next: MapBounds): boolean {
    if (!prev) return true;

    // 이전 bounds의 크기 계산
    const prevWidth = prev.ne.lng - prev.sw.lng;
    const prevHeight = prev.ne.lat - prev.sw.lat;

    // 중심점 이동 거리
    const prevCenterLat = (prev.ne.lat + prev.sw.lat) / 2;
    const prevCenterLng = (prev.ne.lng + prev.sw.lng) / 2;
    const nextCenterLat = (next.ne.lat + next.sw.lat) / 2;
    const nextCenterLng = (next.ne.lng + next.sw.lng) / 2;

    const movedLat = Math.abs(nextCenterLat - prevCenterLat);
    const movedLng = Math.abs(nextCenterLng - prevCenterLng);

    // 이동 거리가 bounds의 30% 이상이면 재검색
    return movedLat > prevHeight * MIN_MOVE_THRESHOLD || movedLng > prevWidth * MIN_MOVE_THRESHOLD;
}

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

    // 최적화용 refs
    const lastFetchedBoundsRef = useRef<MapBounds | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

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
    const fetchPlaces = useCallback(async (center: Location, bounds: MapBounds, zoom?: number) => {
        // 이전 요청 취소
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setIsLoading(true);
        setError(null);

        // 줌 레벨에 따라 검색 개수 조정
        const numOfRows = zoom && zoom >= 16 ? 30 : zoom && zoom >= 14 ? 50 : 100;

        try {
            // 병원과 약국을 병렬로 조회
            const [hospitalsRes, pharmaciesRes] = await Promise.all([
                fetch(`/api/hospitals?lat=${center.lat}&lng=${center.lng}&numOfRows=${numOfRows}`, {
                    signal: abortControllerRef.current.signal
                }),
                fetch(`/api/pharmacies?lat=${center.lat}&lng=${center.lng}&numOfRows=${numOfRows}`, {
                    signal: abortControllerRef.current.signal
                }),
            ]);

            const [hospitalsData, pharmaciesData] = await Promise.all([
                hospitalsRes.json(),
                pharmaciesRes.json(),
            ]);

            let hospitals: Place[] = hospitalsData.success ? hospitalsData.data : [];
            let pharmacies: Place[] = pharmaciesData.success ? pharmaciesData.data : [];

            // 현재 지도 범위 내 장소만 필터링
            hospitals = hospitals.filter((p) => isWithinBounds(p, bounds));
            pharmacies = pharmacies.filter((p) => isWithinBounds(p, bounds));

            setPlaces([...hospitals, ...pharmacies]);
            lastFetchedBoundsRef.current = bounds;
        } catch (err) {
            // 취소된 요청은 에러로 처리하지 않음
            if (err instanceof Error && err.name === 'AbortError') {
                return;
            }
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
            () => { },
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

    // 지도 이동 시 실시간 검색 (debounce + 최적화)
    const handleMapIdle = useCallback(
        (center: Location, bounds: MapBounds, zoom: number) => {
            setCurrentBounds(bounds);

            // 기존 타이머 취소
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            // 충분히 이동하지 않았으면 기존 데이터로 필터링만
            if (!shouldRefetch(lastFetchedBoundsRef.current, bounds)) {
                return;
            }

            // debounce 적용
            debounceTimerRef.current = setTimeout(() => {
                fetchPlaces(center, bounds, zoom);
            }, DEBOUNCE_MS);
        },
        [fetchPlaces]
    );

    // 내 위치에서 다시 찾기
    const handleRefreshLocation = useCallback(() => {
        if (!('geolocation' in navigator)) return;

        setIsLoading(true);
        setError(null);
        // 캐시 초기화
        lastFetchedBoundsRef.current = null;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = { lat: position.coords.latitude, lng: position.coords.longitude };
                setUserLocation(location);
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
    }, []);

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

    // 컴포넌트 언마운트 시 정리
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
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
