'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // iOS 감지
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // 이미 설치된 앱인지 확인 (standalone 모드)
    const isInStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isInStandaloneMode);

    // 이미 설치되어 있으면 프롬프트 표시하지 않음
    if (isInStandaloneMode) return;

    // 이전에 닫았는지 확인
    const dismissed = localStorage.getItem('installPromptDismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // 7일 후에 다시 표시
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) return;
    }

    // beforeinstallprompt 이벤트 리스너 (Android/Desktop Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('👍 beforeinstallprompt event fired!'); // 디버깅용 로그
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS의 경우 자동으로 프롬프트 표시 (3초 후)
    let iosTimer: NodeJS.Timeout;
    if (isIOSDevice && !isInStandaloneMode) {
      iosTimer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    }

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', Date.now().toString());
  };

  // 이미 설치되어 있거나 프롬프트를 표시하지 않아야 하는 경우
  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 max-w-md mx-auto">
        <div className="flex items-start gap-4">
          {/* 앱 아이콘 */}
          <div className="w-14 h-14 bg-gradient-to-br rounded-xl flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#3b82f6"><path d="M444-408h72v-108h108v-72H516v-108h-72v108H336v72h108v108Zm36 312Q323.03-227.11 245.51-339.55 168-452 168-549q0-134 89-224.5T479.5-864q133.5 0 223 90.5T792-549q0 97-77 209T480-96Z" /></svg>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900">앱으로 설치하기</h3>
            <p className="text-sm text-gray-600 mt-1">
              {isIOS
                ? '홈 화면에 추가하여 앱처럼 사용하세요'
                : '홈 화면에서 바로 접근할 수 있어요'}
            </p>

            {isIOS ? (
              // iOS 설치 가이드
              <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                <p className="flex items-center gap-2">
                  <span>1. 하단의</span>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                  <span>공유 버튼 탭</span>
                </p>
                <p className="mt-1">2. &quot;홈 화면에 추가&quot; 선택</p>
              </div>
            ) : (
              // Android/Desktop 설치 버튼
              <button
                onClick={handleInstall}
                className="mt-3 w-full text-white py-2.5 rounded-xl font-medium transition-colors bg-blue-500 text-white shadow-lg shadow-blue-500/30"
              >
                설치하기
              </button>
            )}
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={handleDismiss}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors -mt-1 -mr-1"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
