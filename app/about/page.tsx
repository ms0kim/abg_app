import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '서비스 소개 | 아프면 바로가',
    description: '아프면 바로가는 내 주변 병원과 약국을 실시간으로 찾아주는 서비스입니다.',
};

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 py-12">
                <Link href="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-8">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                        <path d="M400-80 0-480l400-400 71 71-329 329 329 329-71 71Z" />
                    </svg>
                    홈으로 돌아가기
                </Link>

                <h1 className="text-3xl font-bold text-gray-900 mb-8">서비스 소개</h1>

                <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">아프면 바로가란?</h2>
                    <p className="text-gray-600 leading-relaxed">
                        <strong>아프면 바로가</strong>는 갑자기 아플 때, 내 주변에서 지금 영업 중인 병원과 약국을 빠르게 찾을 수 있도록 도와주는 서비스입니다.
                        공공데이터를 활용하여 실시간 영업 정보를 제공하며, 진료과목별 검색 기능으로 필요한 병원을 쉽게 찾을 수 있습니다.
                    </p>
                </section>

                <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">주요 기능</h2>
                    <ul className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                            <span><strong>실시간 영업 정보</strong> - 현재 시간 기준으로 영업 중인 병원과 약국을 구분하여 표시합니다.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                            <span><strong>진료과목별 검색</strong> - 내과, 외과, 치과 등 원하는 진료과목의 병원만 검색할 수 있습니다.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                            <span><strong>위치 기반 검색</strong> - 내 위치를 기준으로 가까운 순서대로 병원과 약국을 보여줍니다.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                            <span><strong>상세 정보 제공</strong> - 병원 주소, 전화번호, 영업시간 등 필요한 정보를 한눈에 확인할 수 있습니다.</span>
                        </li>
                    </ul>
                </section>

                <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">데이터 출처</h2>
                    <p className="text-gray-600 leading-relaxed mb-4">
                        본 서비스는 다음의 공공데이터를 활용하여 정보를 제공합니다:
                    </p>
                    <ul className="list-disc list-inside text-gray-600 space-y-2">
                        <li>공공데이터포털 - 전국 병·의원 정보</li>
                        <li>공공데이터포털 - 전국 약국 정보</li>
                        <li>네이버 클라우드 플랫폼 - 지도 서비스</li>
                    </ul>
                </section>

                <section className="bg-white rounded-2xl p-6 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">문의하기</h2>
                    <p className="text-gray-600 leading-relaxed">
                        서비스 이용 중 문의사항이나 오류 신고는 아래 이메일로 연락해 주세요.
                    </p>
                    <p className="mt-4">
                        <a href="mailto:ms0kim@naver.com" className="text-blue-600 hover:text-blue-800 font-medium">
                            ms0kim@naver.com
                        </a>
                    </p>
                </section>

                <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
                    <div className="flex justify-center gap-6">
                        <Link href="/privacy" className="hover:text-gray-700">개인정보처리방침</Link>
                        <Link href="/terms" className="hover:text-gray-700">이용약관</Link>
                    </div>
                </footer>
            </div>
        </div>
    );
}
