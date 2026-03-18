import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="bg-white text-gray-500 pb-20">
      <div className="container mx-auto px-3 py-6 md:px-4 md:py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
          <div>
            <h3 className="text-sm md:text-lg font-semibold text-gray-700">사업자 정보</h3>
            <ul className="text-[11px] md:text-sm text-gray-500 mt-2 md:mt-4 space-y-0.5 md:space-y-1">
              <li>상호명: 피스코프</li>
              <li>주소지: 서울특별시 마포구 새터산 4길 2, b102호</li>
              <li>전화번호: 010-2087-0621</li>
              <li>사업자등록번호: 118-08-15095</li>
              <li>대표자 이름: 김현준</li>
              <li>개인정보 책임자: 이은원</li>
              <li>통신판매업신고번호: 2021-서울마포-1399</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm md:text-lg font-semibold text-gray-700">BANK INFO</h3>
            <ul className="text-[11px] md:text-sm text-gray-500 mt-2 md:mt-4 space-y-0.5 md:space-y-1">
              <li>우리은행</li>
              <li>1005904144208</li>
              <li>예금주: 피스코프</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm md:text-lg font-semibold text-gray-700">고객 지원</h3>
            <ul className="text-[11px] md:text-sm text-gray-500 mt-2 md:mt-4 space-y-0.5 md:space-y-1">
              <li>운영시간: 평일 10:00 ~ 18:00</li>
              <li>점심시간: 12:00 ~ 13:00</li>
              <li>주말/공휴일 휴무</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 mt-6 pt-3 md:mt-8 md:pt-4">
          <div className="flex flex-wrap justify-center gap-3 md:gap-4 text-xs md:text-sm text-gray-400">
            <Link href="/policies" className="hover:underline">이용약관</Link>
            <span>|</span>
            <Link href="/support/privacy" className="hover:underline">개인정보처리방침</Link>
          </div>
          <p className="mt-3 md:mt-4 text-center text-[10px] md:text-xs text-gray-400">
            © {new Date().getFullYear()} 피스코프. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;