'use client';

import { NaverMapProvider } from './providers/NaverMapProvider';
import { MapContainer } from './components/MapContainer';
import { BottomSheet } from './components/BottomSheet';
import { usePlaces } from './hooks/usePlaces';
import { Header } from './components/Header';
import { useEffect } from 'react';

export default function HomePage() {
    const {
        userLocation,
        filteredPlaces,
        selectedPlace,
        setSelectedPlace,
        filter,
        setFilter,
        department,
        setDepartment,
        isLoading,
        isDetailLoading,
        lastSearchCount,
        handleMapIdle,
        handleRefreshLocation,
        handleRefreshSearch,
        handlePlaceClick
    } = usePlaces();

    useEffect(() => {
        // 지도 페이지 스크롤 방지
        document.body.classList.add('map-page');
        return () => {
            document.body.classList.remove('map-page');
        };
    }, []);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => console.log('Scope: ', registration.scope))
                .catch((err) => console.log('SW registration failed: ', err));
        }
    }, []);

    return (
        <NaverMapProvider>
            <div className="relative w-full h-screen flex flex-col">
                <Header
                    filter={filter}
                    setFilter={setFilter}
                    department={department}
                    setDepartment={setDepartment}
                />

                {/* 지도 */}
                <div className="flex-1 relative">
                    <MapContainer
                        userLocation={userLocation}
                        places={filteredPlaces}
                        onPlaceClick={handlePlaceClick}
                        onRefreshLocation={handleRefreshLocation}
                        onRefreshSearch={handleRefreshSearch}
                        onMapIdle={handleMapIdle}
                        isLoading={isLoading}
                        lastSearchCount={lastSearchCount}
                    />
                </div>

                {/* 바텀시트 */}
                <BottomSheet
                    place={selectedPlace}
                    onClose={() => setSelectedPlace(null)}
                    isLoading={isDetailLoading}
                />
            </div>
        </NaverMapProvider>
    );
}
