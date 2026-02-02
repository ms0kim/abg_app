import { useState, useCallback, useEffect } from 'react';
import { Place, Location, MapBounds, FilterType } from '../types';

export function usePlaces() {
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

    // 장소 클릭 핸들러 (병원 상세 정보 로드)
    const handlePlaceClick = useCallback(async (place: Place) => {
        // 먼저 기본 정보로 선택 상태 설정 (바텀시트 즉시 표시)
        setSelectedPlace(place);

        // 병원이고 영업시간 정보(todayHours)가 없는 경우 상세 정보 로드
        if (place.type === 'hospital' && !place.todayHours) {
            // HPID가 유효한지 확인 (좌표 기반 임시 ID인 경우 상세 조회 불가)
            if (place.id.startsWith('hospital_')) {
                console.warn('HPID가 없어 상세 정보를 조회할 수 없습니다:', place.name);
                return;
            }

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
                    // 필터된 목록도 setPlaces에 의존하므로 places만 업데이트하면 됨
                    // (단, useEffect에서 필터링 다시 수행됨)
                    setPlaces((prev) =>
                        prev.map((p) => (p.id === place.id ? { ...p, ...result.data } : p))
                    );
                }
            } catch (error) {
                console.error('병원 상세 정보 로드 실패:', error);
            }
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
        error,
        handleMapIdle,
        handleRefreshLocation,
        handlePlaceClick
    };
}
