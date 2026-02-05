import { FilterType, MedicalDepartment, DEPARTMENT_NAMES } from '../types';

interface HeaderProps {
    filter: FilterType;
    setFilter: (filter: FilterType) => void;
    department: MedicalDepartment;
    setDepartment: (dept: MedicalDepartment) => void;
}

const POPULAR_DEPARTMENTS: MedicalDepartment[] = [
    'all', 'D001', 'D008', 'D013', 'D012', 'D005', 'D002', 'D026', 'D011', 'D014'
];

export function Header({ filter, setFilter, department, setDepartment }: HeaderProps) {

    return (
        <header className="relative bg-white shadow-md z-20">
            <div className="relative px-4 py-4">
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1 tracking-tight flex items-center gap-1.5">
                    {/* 메인 아이콘 */}
                    <svg xmlns="http://www.w3.org/2000/svg" height="30px" viewBox="0 -960 960 960" width="30px" fill="#3b82f6"><path d="M444-408h72v-108h108v-72H516v-108h-72v108H336v72h108v108Zm36 312Q323.03-227.11 245.51-339.55 168-452 168-549q0-134 89-224.5T479.5-864q133.5 0 223 90.5T792-549q0 97-77 209T480-96Z" /></svg>
                    아프면 바로가
                </h1>
                <p className="text-sm text-gray-600">지금 바로 갈 수 있는 병원과 약국이에요</p>
            </div>

            {/* 필터 버튼 */}
            <div className="relative px-4 pb-3 flex gap-2">
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
                    onClick={() => { setFilter('pharmacy'); setDepartment('all'); }}
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

            {/* 진료과목 필터 (병원 선택 시 슬라이드, 레이아웃 시프트 방지) */}
            <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${filter === 'hospital' ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="relative px-4 pb-3">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {POPULAR_DEPARTMENTS.map((dept) => (
                            <button
                                key={dept}
                                onClick={() => setDepartment(dept)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${department === dept
                                    ? 'bg-rose-100 text-rose-600 border border-rose-200'
                                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                                    }`}
                            >
                                {DEPARTMENT_NAMES[dept]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </header>
    );
}
