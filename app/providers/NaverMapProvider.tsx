'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';

interface NaverMapContextType {
  isLoaded: boolean;
}

const NaverMapContext = createContext<NaverMapContextType>({ isLoaded: false });

export function useNaverMap() {
  return useContext(NaverMapContext);
}

interface NaverMapProviderProps {
  children: ReactNode;
  clientId?: string;
}

// 스크립트 로드 상태를 전역으로 관리
let isScriptLoading = false;
let isScriptLoaded = false;
const loadCallbacks: (() => void)[] = [];

export function NaverMapProvider({
  children,
  clientId = '0cacc5gdmw'
}: NaverMapProviderProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  const checkAndSetLoaded = useCallback(() => {
    if (typeof window !== 'undefined' && window.naver?.maps) {
      setIsLoaded(true);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    // 이미 로드되어 있으면 바로 설정
    if (isScriptLoaded && checkAndSetLoaded()) {
      return;
    }

    // 이미 로딩 중이면 콜백만 등록
    if (isScriptLoading) {
      loadCallbacks.push(() => {
        checkAndSetLoaded();
      });
      return;
    }

    // 스크립트가 이미 DOM에 있는지 확인
    const existingScript = document.querySelector(
      'script[src*="openapi.map.naver.com"]'
    ) as HTMLScriptElement;

    if (existingScript) {
      if (checkAndSetLoaded()) {
        return;
      }
      // 로드 완료 대기
      existingScript.addEventListener('load', () => {
        isScriptLoaded = true;
        checkAndSetLoaded();
      });
      return;
    }

    // 새로 스크립트 로드
    isScriptLoading = true;

    const script = document.createElement('script');
    script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}&submodules=geocoder`;
    script.async = true;

    script.onload = () => {
      isScriptLoading = false;
      isScriptLoaded = true;
      setIsLoaded(true);

      // 대기 중인 콜백들 실행
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };

    script.onerror = () => {
      isScriptLoading = false;
      console.error('네이버 지도 API 로드 실패');
    };

    document.head.appendChild(script);
  }, [clientId, checkAndSetLoaded]);

  return (
    <NaverMapContext.Provider value={{ isLoaded }}>
      {children}
    </NaverMapContext.Provider>
  );
}
