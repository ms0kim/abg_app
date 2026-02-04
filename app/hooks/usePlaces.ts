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
const MIN_MOVE_THRESHOLD = 0.1; // bounds 10% 이상 이동 시에만 재검색

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

        // 줌 레벨에 따라 검색 개수 조정 (기본적으로 많이 가져오도록 설정)
        const numOfRows = 500;

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

            const hospitals: Place[] = hospitalsData.success ? hospitalsData.data : [];
            const pharmacies: Place[] = pharmaciesData.success ? pharmaciesData.data : [];

            // API에서 이미 지역 기반으로 데이터를 가져오므로 클라이언트에서 bounds로 필터링하지 않음
            // (행정구역 단위 검색이므로 화면 밖의 데이터도 포함될 수 있으나, 미리 보여주는 것이 UX상 좋음)
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
    }, []);

    // Geolocation Promise 래퍼 함수 (컴포넌트 밖이나 안에 정의)
    const getPosition = (options?: PositionOptions): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });
    };

    useEffect(() => {
        let isMounted = true; // 컴포넌트 마운트 상태 추적

        const initLocation = async () => {
            if (!('geolocation' in navigator)) {
                setUserLocation(DEFAULT_LOCATION);
                setError('위치 서비스를 지원하지 않는 브라우저입니다.');
                return;
            }

            setIsLoading(true);

            try {
                // 1단계: 빠른 위치 시도 (캐시된 위치가 있으면 즉시 반환)
                // 타임아웃을 짧게 주어 캐시가 없으면 바로 에러를 내고 다음 단계로 넘어가게 함
                try {
                    const fastPos = await getPosition({ ...GEOLOCATION_OPTIONS.fast, timeout: 1000 });
                    if (isMounted) {
                        setUserLocation({
                            lat: fastPos.coords.latitude,
                            lng: fastPos.coords.longitude
                        });
                        // 빠른 위치를 잡았더라도 로딩을 끄지 않고 정밀 위치를 계속 시도할지,
                        // 아니면 여기서 일단 로딩을 끌지 결정 (UX 선택).
                        // 보통 지도가 이동해야 하므로 로딩을 유지하거나, 사용자에게 대략적 위치를 먼저 보여줍니다.
                    }
                } catch (e) {
                    // 빠른 위치 실패 시 무시하고 정밀 위치 진행
                }

                // 2단계: 정밀 위치 요청 (실제 GPS)
                // 앞선 단계에서 위치를 잡았더라도, 더 정확한 위치로 보정합니다.
                const accuratePos = await getPosition(GEOLOCATION_OPTIONS.accurate);

                if (isMounted) {
                    setUserLocation({
                        lat: accuratePos.coords.latitude,
                        lng: accuratePos.coords.longitude
                    });
                    setIsLoading(false); // 최종 완료 시 로딩 해제
                }

            } catch (err: any) {
                // 정밀 위치까지 실패했을 경우
                if (isMounted) {
                    // 이미 1단계에서 위치를 잡았다면 에러 처리 하지 않음
                    if (!userLocation) {
                        setUserLocation(DEFAULT_LOCATION);

                        const messages: Record<number, string> = {
                            1: '위치 권한이 거부되었습니다.', // PERMISSION_DENIED
                            2: '위치 정보를 사용할 수 없습니다.', // POSITION_UNAVAILABLE
                            3: '위치 요청 시간이 초과되었습니다.', // TIMEOUT
                        };
                        setError(messages[err.code] || '위치 정보를 가져올 수 없습니다.');
                    }
                    setIsLoading(false);
                }
            }
        };

        initLocation();

        return () => {
            isMounted = false; // 클린업
        };
    }, []);

    // 필터 적용 (엄격한 Viewport 필터링)
    useEffect(() => {
        if (!currentBounds) return; // 아직 지도가 준비되지 않았으면 필터링 보류

        let result = places.filter((place) => isWithinBounds(place, currentBounds));

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
