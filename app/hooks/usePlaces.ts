import { useState, useCallback, useEffect, useRef } from 'react';
import { Place, Location, MapBounds, FilterType, MedicalDepartment } from '../types';

// 위치 요청 옵션
const GEOLOCATION_OPTIONS = {
    fast: { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 },
    accurate: { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
};

// 기본 위치 (서울 시청)
const DEFAULT_LOCATION: Location = { lat: 37.5665, lng: 126.978 };

// 최적화 설정 (API 호출 최소화)
const DEBOUNCE_MS = 500; // 지도 이동 후 API 호출 대기 시간
const MIN_MOVE_THRESHOLD = 0.25; // bounds 25% 이상 이동 시에만 재검색 (API 호출 최소화)
const NUM_OF_ROWS = 150; // API에서 가져올 최대 데이터 수 (거리순 정렬되므로 가까운 곳 위주)

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

    // 이동 거리가 bounds의 15% 이상이면 재검색 (API 호출 최소화)
    return movedLat > prevHeight * MIN_MOVE_THRESHOLD || movedLng > prevWidth * MIN_MOVE_THRESHOLD;
}

export function usePlaces() {
    const [userLocation, setUserLocation] = useState<Location | null>(null);
    const [places, setPlaces] = useState<Place[]>([]);
    const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');
    const [department, setDepartment] = useState<MedicalDepartment>('all');
    const [isLoading, setIsLoading] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
    const [lastSearchCount, setLastSearchCount] = useState<number | null>(null); // 마지막 검색 결과 개수

    // 최적화용 refs
    const lastFetchedBoundsRef = useRef<MapBounds | null>(null);
    const lastFetchedDepartmentRef = useRef<MedicalDepartment>('all');
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastCenterRef = useRef<Location | null>(null);
    const lastZoomRef = useRef<number>(16);
    const initialSearchDoneRef = useRef<boolean>(false); // 초기 검색 완료 여부

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
    const fetchPlaces = useCallback(async (center: Location, bounds: MapBounds, zoom?: number, dept?: MedicalDepartment) => {
        // 이전 요청 취소
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setIsLoading(true);
        setError(null);

        // 거리순으로 정렬되므로 가까운 곳 위주로 가져옴
        const numOfRows = NUM_OF_ROWS;
        const currentDept = dept !== undefined ? dept : department;

        try {
            // 병원과 약국을 병렬로 조회
            const hospitalUrl = currentDept !== 'all'
                ? `/api/hospitals?lat=${center.lat}&lng=${center.lng}&numOfRows=${numOfRows}&QD=${currentDept}`
                : `/api/hospitals?lat=${center.lat}&lng=${center.lng}&numOfRows=${numOfRows}`;

            const [hospitalsRes, pharmaciesRes] = await Promise.all([
                fetch(hospitalUrl, {
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
            const allPlaces = [...hospitals, ...pharmacies];
            setPlaces(allPlaces);
            setLastSearchCount(allPlaces.length); // 검색 결과 개수 저장
            lastFetchedBoundsRef.current = bounds;
            lastFetchedDepartmentRef.current = currentDept;
            lastCenterRef.current = center;
            lastZoomRef.current = zoom || 16;
            initialSearchDoneRef.current = true; // 초기 검색 완료 표시
        } catch (err) {
            // 취소된 요청은 에러로 처리하지 않음
            if (err instanceof Error && err.name === 'AbortError') {
                return;
            }
            setError('데이터를 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [department]);

    // Geolocation Promise 래퍼 함수
    const getPosition = (options?: PositionOptions): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });
    };

    useEffect(() => {
        let isMounted = true;

        const initLocation = async () => {
            if (!('geolocation' in navigator)) {
                setUserLocation(DEFAULT_LOCATION);
                setError('위치 서비스를 지원하지 않는 브라우저입니다.');
                return;
            }

            setIsLoading(true);

            try {
                // 1단계: 빠른 위치 시도 (캐시된 위치가 있으면 즉시 반환)
                try {
                    const fastPos = await getPosition({ ...GEOLOCATION_OPTIONS.fast, timeout: 1000 });
                    if (isMounted) {
                        setUserLocation({
                            lat: fastPos.coords.latitude,
                            lng: fastPos.coords.longitude
                        });
                    }
                } catch {
                    // 빠른 위치 실패 시 무시하고 정밀 위치 진행
                }

                // 2단계: 정밀 위치 요청 (실제 GPS)
                const accuratePos = await getPosition(GEOLOCATION_OPTIONS.accurate);

                if (isMounted) {
                    setUserLocation({
                        lat: accuratePos.coords.latitude,
                        lng: accuratePos.coords.longitude
                    });
                    setIsLoading(false);
                }

            } catch (err: unknown) {
                if (isMounted) {
                    setUserLocation(DEFAULT_LOCATION);

                    const geoError = err as GeolocationPositionError;
                    const messages: Record<number, string> = {
                        1: '위치 권한이 거부되었습니다.',
                        2: '위치 정보를 사용할 수 없습니다.',
                        3: '위치 요청 시간이 초과되었습니다.',
                    };
                    setError(messages[geoError.code] || '위치 정보를 가져올 수 없습니다.');
                    setIsLoading(false);
                }
            }
        };

        initLocation();

        return () => {
            isMounted = false;
        };
    }, []);

    // 필터 적용 (엄격한 Viewport 필터링)
    useEffect(() => {
        if (!currentBounds) return;

        let result = places.filter((place) => isWithinBounds(place, currentBounds));

        if (filter !== 'all') {
            result = result.filter((place) => place.type === filter);
        }

        setFilteredPlaces(result);
    }, [places, filter, currentBounds, isWithinBounds]);

    // 진료과목 변경 핸들러 (즉시 재검색)
    const handleDepartmentChange = useCallback((dept: MedicalDepartment) => {
        setDepartment(dept);
        // 같은 과목이면 재검색 불필요
        if (dept === lastFetchedDepartmentRef.current) return;
        const center = lastCenterRef.current;
        const bounds = currentBounds || lastFetchedBoundsRef.current;
        if (center && bounds) {
            fetchPlaces(center, bounds, lastZoomRef.current, dept);
        }
    }, [fetchPlaces, currentBounds]);

    // 지도 이동 시 실시간 검색 (debounce + 최적화)
    const handleMapIdle = useCallback(
        (center: Location, bounds: MapBounds, zoom: number) => {
            setCurrentBounds(bounds);
            lastCenterRef.current = center;
            lastZoomRef.current = zoom;

            // 기존 타이머 취소
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            // 초기 검색이 안 된 상태면 즉시 검색 (debounce 없이)
            if (!initialSearchDoneRef.current) {
                fetchPlaces(center, bounds, zoom, department);
                return;
            }

            // 충분히 이동하지 않았으면 기존 데이터로 필터링만
            if (!shouldRefetch(lastFetchedBoundsRef.current, bounds)) {
                return;
            }

            // debounce 적용 - 현재 department 상태를 명시적으로 전달
            debounceTimerRef.current = setTimeout(() => {
                fetchPlaces(center, bounds, zoom, department);
            }, DEBOUNCE_MS);
        },
        [fetchPlaces, department]
    );

    // 현재 위치에서 다시 검색 (지도 이동 없이)
    const handleRefreshSearch = useCallback(() => {
        // center 결정: lastCenterRef > userLocation > DEFAULT_LOCATION
        const center = lastCenterRef.current || userLocation || DEFAULT_LOCATION;

        // bounds 결정: currentBounds > lastFetchedBoundsRef > center 기준 기본 bounds 생성
        const bounds = currentBounds || lastFetchedBoundsRef.current || {
            sw: { lat: center.lat - 0.01, lng: center.lng - 0.01 },
            ne: { lat: center.lat + 0.01, lng: center.lng + 0.01 }
        };

        // 캐시 초기화하여 강제 재검색
        lastFetchedBoundsRef.current = null;
        fetchPlaces(center, bounds, lastZoomRef.current, department);
    }, [fetchPlaces, currentBounds, userLocation, department]);

    // 내 위치에서 다시 찾기
    const handleRefreshLocation = useCallback(() => {
        if (!('geolocation' in navigator)) return;

        setIsLoading(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = { lat: position.coords.latitude, lng: position.coords.longitude };
                // 캐시 초기화 - 위치 획득 후에 초기화하여 race condition 방지
                lastFetchedBoundsRef.current = null;
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
        department,
        setDepartment: handleDepartmentChange,
        isLoading,
        isDetailLoading,
        error,
        lastSearchCount, // 마지막 검색 결과 개수
        handleMapIdle,
        handleRefreshLocation,
        handleRefreshSearch,
        handlePlaceClick,
    };
}
