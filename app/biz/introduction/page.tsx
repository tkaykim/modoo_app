import type { Metadata } from 'next';
import IntroductionLanding from './IntroductionLanding';

export const metadata: Metadata = {
  title: '도입 안내 | 카페24 연동·홈페이지 제작·생산 파트너',
  description:
    '가지고 계신 쇼핑몰에 붙이는 방법, 홈페이지를 새로 만드는 방법, 모두의 유니폼 생산 파트너로 입점하는 방법을 화면과 가격으로 안내합니다.',
  alternates: { canonical: '/biz/introduction' },
  openGraph: {
    title: '모두의 유니폼 도입 안내',
    description: '카페24 연동, 홈페이지 신규 제작, 생산 파트너 입점 중 우리 업체에 맞는 방식을 확인해 보세요.',
    url: '/biz/introduction',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function BizIntroductionPage() {
  return <IntroductionLanding />;
}
