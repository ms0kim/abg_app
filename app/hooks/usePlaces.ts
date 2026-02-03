import { useState, useCallback, useEffect } from 'react';
import { Place, Location, MapBounds, FilterType } from '../types';
import { createTestPlaces, runMarkerStatusTest } from '../utils/testDummyData';

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
    const [testModeEnabled, setTestModeEnabled] = useState(false);

    // 개발 환경에서 테스트 데이터 주입 함수를 전역으로 노출
    useEffect(() => {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            // 테스트 모드 활성화 함수
            (window as unknown as { __enableTestMode: () => void }).__enableTestMode = () => {
                setTestModeEnabled(true);
                console.log('✅ 테스트 모드가 활성화되었습니다. 더미 데이터가 지도에 추가됩니다.');
                runMarkerStatusTest();
            };

            // 테스트 모드 비활성화 함수
            (window as unknown as { __disableTestMode: () => void }).__disableTestMode = () => {
                setTestModeEnabled(false);
                console.log('❌ 테스트 모드가 비활성화되었습니다.');
            };

            console.log('💡 개발 모드 힌트: window.__enableTestMode()를 호출하여 테스트 데이터를 추가할 수 있습니다.');
        }
    }, []);

    // 사용자 위치 가져오기 (정확도 향상)
    useEffect(() => {
        const getLocation = () => {
            if ('geolocation' in navigator) {
                setIsLoading(true);

                // 먼저 빠른 위치를 가져온 후, 고정밀 위치로 업데이트
                let hasReceivedLocation = false;

                // 1단계: 빠른 위치 (캐시 허용)
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        if (!hasReceivedLocation) {
                            const location = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                            };
                            console.log(`📍 빠른 위치 획득: ${location.lat}, ${location.lng} (정확도: ${position.coords.accuracy}m)`);
                            setUserLocation(location);
                            hasReceivedLocation = true;
                        }
                    },
                    () => {}, // 에러 무시 (2단계에서 처리)
                    {
                        enableHighAccuracy: false,
                        timeout: 5000,
                        maximumAge: 30000, // 30초 이내 캐시 허용
                    }
                );

                // 2단계: 고정밀 위치 (GPS 사용)
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const location = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        };
                        console.log(`📍 고정밀 위치 획득: ${location.lat}, ${location.lng} (정확도: ${position.coords.accuracy}m)`);
                        setUserLocation(location);
                        hasReceivedLocation = true;
                        setIsLoading(false);
                    },
                    (error) => {
                        console.error('위치 정보를 가져올 수 없습니다:', error);
                        if (!hasReceivedLocation) {
                            // 기본 위치 (서울 시청)
                            setUserLocation({ lat: 37.5665, lng: 126.978 });
                            setError('위치 정보를 가져올 수 없어 기본 위치로 설정했습니다.');
                        }
                        setIsLoading(false);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 15000, // GPS는 더 오래 걸릴 수 있음
                        maximumAge: 0, // 캐시 사용 안함, 새 위치만
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

        // 줌 레벨에 따라 검색 개수 조정
        const numOfRows = zoom && zoom >= 16 ? 50 : zoom && zoom >= 14 ? 100 : 200;

        try {
            let sido = '';
            let gungu = '';

            // 주소 정보 가져오기 (Reverse Geocoding) - 병원 List API 사용을 위해 필요
            if (window.naver && window.naver.maps && window.naver.maps.Service) {
                try {
                    const addressInfo = await new Promise<{ sido: string, gungu: string }>((resolve, reject) => {
                        window.naver.maps.Service.reverseGeocode({
                            coords: new window.naver.maps.LatLng(location.lat, location.lng),
                        }, function (status, response) {
                            if (status !== window.naver.maps.Service.Status.OK) {
                                resolve({ sido: '', gungu: '' });
                                return;
                            }

                            const result = response.v2;
                            if (result.results && result.results.length > 0) {
                                const region = result.results[0].region;
                                resolve({
                                    sido: region.area1.name,
                                    gungu: region.area2.name
                                });
                            } else {
                                resolve({ sido: '', gungu: '' });
                            }
                        });
                    });

                    sido = addressInfo.sido;
                    gungu = addressInfo.gungu;
                } catch (e) {
                    console.error('Reverse Geocoding failed:', e);
                }
            }

            console.log(`Fetching places for ${sido} ${gungu}`);

            // 병원과 약국을 병렬로 조회
            const [hospitalsRes, pharmaciesRes] = await Promise.all([
                fetch(`/api/hospitals?lat=${location.lat}&lng=${location.lng}&numOfRows=${numOfRows}&sido=${encodeURIComponent(sido)}&gungu=${encodeURIComponent(gungu)}`),
                fetch(`/api/pharmacies?lat=${location.lat}&lng=${location.lng}&numOfRows=${numOfRows}`),
            ]);

            const hospitalsData = await hospitalsRes.json();
            const pharmaciesData = await pharmaciesRes.json();

            let hospitals: Place[] = hospitalsData.success ? hospitalsData.data : [];
            let pharmacies: Place[] = pharmaciesData.success ? pharmaciesData.data : [];

            // bounds가 있으면 해당 영역 내 장소만 필터링 (화면 밖 제거)
            if (bounds) {
                hospitals = hospitals.filter((p) => isWithinBounds(p, bounds));
                pharmacies = pharmacies.filter((p) => isWithinBounds(p, bounds));
            }

            const allPlaces = [...hospitals, ...pharmacies];
            setPlaces(allPlaces);


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

        // 테스트 모드일 경우 더미 데이터 추가
        if (testModeEnabled && userLocation) {
            const testPlaces = createTestPlaces(userLocation.lat, userLocation.lng);
            result = [...testPlaces, ...result];
        }

        // bounds 필터링
        if (currentBounds) {
            result = result.filter((place) => isWithinBounds(place, currentBounds));
        }

        // 타입 필터링
        if (filter !== 'all') {
            result = result.filter((place) => place.type === filter);
        }

        setFilteredPlaces(result);
    }, [places, filter, currentBounds, isWithinBounds, testModeEnabled, userLocation]);

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
        if ('geolocation' in navigator) {
            setIsLoading(true);
            setError(null);
            console.log('📍 위치 새로고침 시작...');

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };

                    console.log(`📍 새 위치 획득: ${location.lat}, ${location.lng} (정확도: ${position.coords.accuracy}m)`);
                    setUserLocation(location);
                    fetchPlaces(location);
                },
                (error) => {
                    console.error('위치 정보를 가져올 수 없습니다:', error);
                    let errorMessage = '위치 정보를 가져올 수 없습니다.';
                    if (error.code === error.PERMISSION_DENIED) {
                        errorMessage = '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.';
                    } else if (error.code === error.POSITION_UNAVAILABLE) {
                        errorMessage = '위치 정보를 사용할 수 없습니다.';
                    } else if (error.code === error.TIMEOUT) {
                        errorMessage = '위치 요청 시간이 초과되었습니다. 다시 시도해주세요.';
                    }
                    setError(errorMessage);
                    setIsLoading(false);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000, // 15초로 증가 (GPS는 시간이 더 걸림)
                    maximumAge: 0, // 새로고침 시에는 캐시된 위치 사용 안함
                }
            );
        }
    }, [fetchPlaces]);

    // 장소 클릭 핸들러 (병원 상세 정보 로드)
    const handlePlaceClick = useCallback(async (place: Place) => {
        // 병원이고 실시간 계산용 데이터(todayTimeRaw)가 없는 경우에만 상세 정보 로드
        // todayTimeRaw가 있으면 클라이언트에서 실시간 계산 가능하므로 API 호출 불필요
        if (place.type === 'hospital' && !place.todayTimeRaw) {
            // HPID가 유효한지 확인 (좌표 기반 임시 ID인 경우 상세 조회 불가)
            if (place.id.startsWith('hospital_')) {
                console.warn('HPID가 없어 상세 정보를 조회할 수 없습니다:', place.name);
                setSelectedPlace(place);
                return;
            }

            // 로딩 시작 - 바텀시트 먼저 열고 로딩 표시
            setIsDetailLoading(true);
            setSelectedPlace(place);

            try {
                const response = await fetch(`/api/hospitals/detail?hpid=${place.id}`);
                const result = await response.json();

                if (result.success && result.data) {
                    // 1. 선택된 장소 상태 업데이트 (바텀시트 내용 갱신)
                    setSelectedPlace((prev) => {
                        if (prev && prev.id === place.id) {
                            return { ...prev, ...result.data };
                        }
                        return prev;
                    });

                    // 2. 전체 장소 목록 업데이트 (캐싱 효과)
                    setPlaces((prev) =>
                        prev.map((p) => (p.id === place.id ? { ...p, ...result.data } : p))
                    );
                }
            } catch (error) {
                console.error('병원 상세 정보 로드 실패:', error);
            } finally {
                setIsDetailLoading(false);
            }
        } else {
            // 상세 정보 로드 불필요 - 바로 바텀시트 표시
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
        handlePlaceClick
    };
}
