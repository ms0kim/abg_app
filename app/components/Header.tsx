import { FilterType, Place } from '../types';

interface HeaderProps {
    filter: FilterType;
    setFilter: (filter: FilterType) => void;
    places: Place[];
    error: string | null;
    isLoading: boolean;
}

export function Header({ filter, setFilter, places, error, isLoading }: HeaderProps) {
    return (
        <header className="relative bg-white shadow-md z-20">
            <div className="relative px-4 py-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight flex items-center gap-2">
                    {/* 메인 아이콘 */}
                    <svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 -960 960 960" width="28px" fill="#3b82f6"><path d="M444-408h72v-108h108v-72H516v-108h-72v108H336v72h108v108Zm36 312Q323.03-227.11 245.51-339.55 168-452 168-549q0-134 89-224.5T479.5-864q133.5 0 223 90.5T792-549q0 97-77 209T480-96Z" /></svg>
                    아프면 바로가
                </h1>
                <p className="text-sm text-gray-600">지금 바로 갈 수 있는 병원과 약국이에요</p>
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
                        전체
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
                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M336-144v-192H144v-288h192v-192h288v192h192v288H624v192H336Zm72-72h144v-192h192v-144H552v-192H408v192H216v144h192v192Zm72-264Z" /></svg>
                        병원
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
                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M354-144q-87.73 0-148.87-61.13Q144-266.27 144-354q0-42 16-81t45-68l252-252q29-29 68-45t81-16q87.73 0 148.87 61.13Q816-693.73 816-606q0 42-16 81t-45 68L503-205q-29 29-68 45t-81 16Zm249-264 101-100q20-20 30-45t10-52.67q0-57.24-40.55-97.78Q662.91-744 605.67-744 578-744 553-734t-45 30L408-603l195 195ZM354.33-216Q382-216 407-226t45-30l100-101-195-195-100 100q-20 20-30.5 45T216-354.33q0 57.24 40.55 97.78Q297.09-216 354.33-216Z" /></svg>
                        약국
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
    );
}
