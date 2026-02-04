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
    } = usePlaces();

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
                    places={places}
                    error={error}
                    isLoading={isLoading}
                />

                {/* 지도 */}
                <div className="flex-1 relative">
                    <MapContainer
                        userLocation={userLocation}
                        places={filteredPlaces}
                        onPlaceClick={handlePlaceClick}
                        onRefreshLocation={handleRefreshLocation}
                        onMapIdle={handleMapIdle}
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
