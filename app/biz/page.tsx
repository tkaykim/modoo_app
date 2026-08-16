import type { Metadata } from 'next';
import BizLanding from './BizLanding';

export const metadata: Metadata = {
  title: '단체복 주문, 고객이 직접 그리고 견적은 자동으로 | 모두굿즈',
  description:
    '단체복·굿즈 제작업체를 위한 커스텀 주문 시스템입니다. 고객이 웹에서 직접 디자인하면 옷 위 실제 크기가 밀리미터로 표시되고 견적이 자동 산출되며, 인쇄용 파일과 작업지시서가 자동으로 만들어집니다.',
  alternates: { canonical: '/biz' },
  openGraph: {
    title: '주문서 한 장에 사흘 쓰고 계십니까',
    description:
      '고객이 직접 그리면 견적이 자동으로 나옵니다. 쓰시던 쇼핑몰은 그대로 두고 주문 접수 단계만 연결합니다.',
    url: '/biz',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function BizPage() {
  return <BizLanding />;
}
