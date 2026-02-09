import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '이용약관 | 아프면 바로가',
    description: '아프면 바로가 서비스의 이용약관입니다.',
};

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 py-12">
                <Link href="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-8">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                        <path d="M400-80 0-480l400-400 71 71-329 329 329 329-71 71Z" />
                    </svg>
                    홈으로 돌아가기
                </Link>

                <h1 className="text-3xl font-bold text-gray-900 mb-2">이용약관</h1>
                <p className="text-gray-500 mb-8">최종 수정일: 2026년 2월 9일</p>

                <div className="bg-white rounded-2xl p-6 shadow-sm space-y-8">
                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">제1조 (목적)</h2>
                        <p className="text-gray-600 leading-relaxed">
                            이 약관은 아프면 바로가(이하 &quot;서비스&quot;)가 제공하는 위치 기반 병원/약국 검색 서비스의
                            이용 조건 및 절차, 서비스와 이용자의 권리, 의무 및 책임사항 등을 규정함을 목적으로 합니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">제2조 (정의)</h2>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li><strong>&quot;서비스&quot;</strong>란 이용자가 현재 위치를 기반으로 주변의 병원 및 약국 정보를 검색하고 확인할 수 있는 웹 서비스를 말합니다.</li>
                            <li><strong>&quot;이용자&quot;</strong>란 서비스에 접속하여 이 약관에 따라 서비스를 이용하는 자를 말합니다.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">제3조 (약관의 효력과 변경)</h2>
                        <ul className="list-decimal list-inside text-gray-600 space-y-2">
                            <li>이 약관은 서비스를 이용하고자 하는 모든 이용자에 대하여 그 효력을 발생합니다.</li>
                            <li>서비스는 필요한 경우 관련 법령을 위배하지 않는 범위 내에서 이 약관을 변경할 수 있습니다.</li>
                            <li>약관이 변경되는 경우 서비스는 변경 사항을 시행일 7일 전부터 서비스 공지사항을 통해 공지합니다.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">제4조 (서비스의 제공)</h2>
                        <p className="text-gray-600 leading-relaxed mb-3">서비스는 다음과 같은 서비스를 제공합니다:</p>
                        <ul className="list-disc list-inside text-gray-600 space-y-1">
                            <li>위치 기반 주변 병원 검색 서비스</li>
                            <li>위치 기반 주변 약국 검색 서비스</li>
                            <li>진료과목별 병원 검색 서비스</li>
                            <li>병원/약국 상세 정보 제공 서비스</li>
                            <li>실시간 영업 상태 정보 제공 서비스</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">제5조 (서비스 이용)</h2>
                        <ul className="list-decimal list-inside text-gray-600 space-y-2">
                            <li>서비스는 별도의 회원가입 없이 누구나 이용할 수 있습니다.</li>
                            <li>서비스 이용 시 위치 정보 사용에 동의하면 더 정확한 서비스를 제공받을 수 있습니다.</li>
                            <li>위치 정보 사용에 동의하지 않는 경우에도 기본 위치(서울)를 기준으로 서비스를 이용할 수 있습니다.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">제6조 (서비스의 변경 및 중단)</h2>
                        <ul className="list-decimal list-inside text-gray-600 space-y-2">
                            <li>서비스는 운영상, 기술상의 필요에 따라 제공하고 있는 서비스를 변경할 수 있습니다.</li>
                            <li>서비스는 다음 각 호에 해당하는 경우 서비스의 전부 또는 일부를 제한하거나 중단할 수 있습니다:
                                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                    <li>서비스용 설비의 보수 등 공사로 인한 부득이한 경우</li>
                                    <li>전기통신사업법에 규정된 기간통신사업자가 전기통신서비스를 중지했을 경우</li>
                                    <li>국가비상사태, 천재지변 기타 불가항력적 사유가 있는 경우</li>
                                </ul>
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">제7조 (면책사항)</h2>
                        <ul className="list-decimal list-inside text-gray-600 space-y-2">
                            <li>서비스에서 제공하는 병원/약국 정보는 공공데이터를 기반으로 하며, 실제 정보와 차이가 있을 수 있습니다.</li>
                            <li>서비스는 이용자가 서비스에 게재한 정보, 자료, 사실의 신뢰도, 정확성 등에 대해서는 책임을 지지 않습니다.</li>
                            <li>서비스는 이용자 상호간 또는 이용자와 제3자 간에 서비스를 매개로 발생한 분쟁에 대해 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임도 없습니다.</li>
                            <li>병원/약국 방문 전 반드시 해당 기관에 직접 연락하여 영업 여부를 확인하시기 바랍니다.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">제8조 (저작권)</h2>
                        <p className="text-gray-600 leading-relaxed">
                            서비스가 작성한 저작물에 대한 저작권 및 기타 지적재산권은 서비스에 귀속합니다.
                            이용자는 서비스를 이용함으로써 얻은 정보를 서비스의 사전 승낙 없이 복제, 송신, 출판, 배포, 방송 등
                            기타 방법에 의하여 영리 목적으로 이용하거나 제3자에게 이용하게 하여서는 안 됩니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">제9조 (준거법 및 관할법원)</h2>
                        <p className="text-gray-600 leading-relaxed">
                            이 약관의 해석 및 서비스와 이용자 간의 분쟁에 대하여는 대한민국의 법을 적용합니다.
                            서비스와 이용자 간에 발생한 분쟁에 관한 소송은 민사소송법상의 관할법원에 제기합니다.
                        </p>
                    </section>

                    <section className="pt-4 border-t border-gray-200">
                        <p className="text-gray-500 text-sm">
                            본 약관은 2026년 2월 9일부터 시행됩니다.
                        </p>
                    </section>
                </div>

                <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
                    <div className="flex justify-center gap-6">
                        <Link href="/about" className="hover:text-gray-700">서비스 소개</Link>
                        <Link href="/privacy" className="hover:text-gray-700">개인정보처리방침</Link>
                    </div>
                </footer>
            </div>
        </div>
    );
}
