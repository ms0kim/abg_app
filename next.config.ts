import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: false, // 개발 환경에서도 PWA 기능 활성화 (테스트용)
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  // Turbopack 빌드 지원을 위한 빈 설정
  turbopack: {},
};

export default withPWA(nextConfig);
