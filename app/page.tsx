'use client';

import { NaverMapProvider } from './providers/NaverMapProvider';
import { MapContainer } from './components/MapContainer';
import { BottomSheet } from './components/BottomSheet';
import { InstallPrompt } from './components/InstallPrompt';
import { usePlaces } from './hooks/usePlaces';
import { Header } from './components/Header';

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
        error,
        handleMapIdle,
        handleRefreshLocation,
        handlePlaceClick
    } = usePlaces();

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
                <BottomSheet place={selectedPlace} onClose={() => setSelectedPlace(null)} />

                {/* PWA 설치 프롬프트 */}
                <InstallPrompt />
            </div>
        </NaverMapProvider>
    );
}
