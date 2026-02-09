import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '개인정보처리방침 | 아프면 바로가',
    description: '아프면 바로가 서비스의 개인정보처리방침입니다.',
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 py-12">
                <Link href="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-8">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                        <path d="M400-80 0-480l400-400 71 71-329 329 329 329-71 71Z" />
                    </svg>
                    홈으로 돌아가기
                </Link>

                <h1 className="text-3xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
                <p className="text-gray-500 mb-8">최종 수정일: 2026년 2월 9일</p>

                <div className="bg-white rounded-2xl p-6 shadow-sm space-y-8">
                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">1. 개인정보의 처리 목적</h2>
                        <p className="text-gray-600 leading-relaxed">
                            아프면 바로가(이하 &quot;서비스&quot;)는 다음의 목적을 위하여 개인정보를 처리합니다.
                            처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며,
                            이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
                        </p>
                        <ul className="list-disc list-inside text-gray-600 mt-3 space-y-1">
                            <li>위치 기반 서비스 제공 (주변 병원/약국 검색)</li>
                            <li>서비스 이용 통계 및 분석</li>
                            <li>서비스 개선 및 신규 서비스 개발</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">2. 수집하는 개인정보 항목</h2>
                        <p className="text-gray-600 leading-relaxed">
                            서비스는 원활한 서비스 제공을 위해 다음과 같은 최소한의 개인정보를 수집합니다.
                        </p>
                        <ul className="list-disc list-inside text-gray-600 mt-3 space-y-1">
                            <li><strong>위치 정보</strong>: 주변 병원/약국 검색을 위한 현재 위치 (사용자 동의 시에만 수집)</li>
                            <li><strong>기기 정보</strong>: 서비스 최적화를 위한 기기 유형, 브라우저 정보</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">3. 개인정보의 보유 및 이용기간</h2>
                        <p className="text-gray-600 leading-relaxed">
                            서비스는 위치 정보를 서버에 저장하지 않으며, 검색 요청 시에만 일시적으로 사용됩니다.
                            서비스 이용 기록은 서비스 개선 목적으로 최대 1년간 보관 후 파기됩니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">4. 개인정보의 제3자 제공</h2>
                        <p className="text-gray-600 leading-relaxed">
                            서비스는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
                            다만, 아래의 경우에는 예외로 합니다.
                        </p>
                        <ul className="list-disc list-inside text-gray-600 mt-3 space-y-1">
                            <li>이용자가 사전에 동의한 경우</li>
                            <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">5. 쿠키의 사용</h2>
                        <p className="text-gray-600 leading-relaxed">
                            서비스는 이용자에게 개별적인 맞춤 서비스를 제공하기 위해 쿠키(cookie)를 사용할 수 있습니다.
                            쿠키는 웹사이트를 운영하는데 이용되는 서버가 이용자의 브라우저에게 보내는 소량의 정보이며,
                            이용자의 기기에 저장됩니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">6. 개인정보 보호책임자</h2>
                        <p className="text-gray-600 leading-relaxed">
                            서비스는 개인정보 처리에 관한 업무를 총괄해서 책임지고,
                            개인정보 처리와 관련한 이용자의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
                        </p>
                        <div className="mt-3 p-4 bg-gray-50 rounded-lg text-gray-600">
                            <p><strong>개인정보 보호책임자</strong></p>
                            <p>이메일: ms0kim@naver.com</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">7. 개인정보처리방침의 변경</h2>
                        <p className="text-gray-600 leading-relaxed">
                            이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는
                            변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
                        </p>
                    </section>
                </div>

                <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
                    <div className="flex justify-center gap-6">
                        <Link href="/about" className="hover:text-gray-700">서비스 소개</Link>
                        <Link href="/terms" className="hover:text-gray-700">이용약관</Link>
                    </div>
                </footer>
            </div>
        </div>
    );
}
