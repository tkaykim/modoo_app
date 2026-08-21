import Image from 'next/image';
import { cache } from 'react';
import { createAnonClient } from '@/lib/supabase';

type ProductVisual = {
  title: string;
  image: string;
};

const fallbackProductVisuals: ProductVisual[] = [
  { title: '티셔츠 상품 목업', image: '/icons/tshirt.png' },
  { title: '커스텀 상품 목업', image: '/icons/tshirt.png' },
];

const getProductVisuals = cache(async (): Promise<ProductVisual[]> => {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from('products')
      .select('title, thumbnail_image_link')
      .eq('is_active', true)
      .eq('is_featured', true)
      .order('sort_order', { ascending: true })
      .limit(4);

    if (error) {
      console.error('[biz/introduction] Failed to load product visuals:', error);
      return fallbackProductVisuals;
    }

    const visuals = (data ?? []).flatMap((product) => {
      const image = Array.isArray(product.thumbnail_image_link) ? product.thumbnail_image_link[0] : null;
      return image ? [{ title: product.title, image }] : [];
    });

    return visuals.length > 0 ? visuals : fallbackProductVisuals;
  } catch (error) {
    console.error('[biz/introduction] Product visual lookup unavailable:', error);
    return fallbackProductVisuals;
  }
});

const routes = [
  {
    id: 'cafe24',
    number: '01',
    label: '지금 쇼핑몰이 있어요',
    title: '카페24에 주문 화면 붙이기',
    price: '월 59,000원부터',
    note: '세팅비 0원 · 첫 달 비용 없음',
    accent: '#2f6df6',
  },
  {
    id: 'new-homepage',
    number: '02',
    label: '홈페이지를 새로 만들고 싶어요',
    title: '커스텀 주문 홈페이지 새로 만들기',
    price: '200만원부터',
    note: '제품·결제·이전 범위에 따라 협의',
    accent: '#f27d52',
  },
  {
    id: 'partner',
    number: '03',
    label: '생산 설비가 있어요',
    title: '모두의 유니폼 생산 파트너로 입점',
    price: '월 이용료 없음',
    note: '저희 주문을 작업 화면으로 받습니다',
    accent: '#16a085',
  },
];

const processSteps = [
  ['01', '고객이 상품을 고릅니다', '상품 상세나 홈페이지에서 디자인 주문을 시작합니다.'],
  ['02', '고객이 직접 디자인합니다', '앞·뒤·좌·우 도안과 인쇄 크기를 화면에서 확인합니다.'],
  ['03', '견적과 주문이 정리됩니다', '상품·수량·도안·인쇄 사양이 하나의 주문으로 묶입니다.'],
  ['04', '담당 화면에 도착합니다', '운영자는 주문을 확인하고 작업지시서와 원본 파일을 엽니다.'],
];

export default async function IntroductionLanding() {
  const productVisuals = await getProductVisuals();

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#111827] selection:bg-[#cfe0ff]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08111f]/95 text-white backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 lg:px-8">
          <a href="/biz" className="flex items-center gap-2 text-sm font-black tracking-[-0.03em]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[10px] text-[#08111f]">M</span>
            모두의 유니폼
          </a>
          <nav className="hidden items-center gap-5 text-xs font-bold text-white/65 sm:flex" aria-label="페이지 메뉴">
            <a href="#pricing" className="transition hover:text-white">가격</a>
            <a href="#screens" className="transition hover:text-white">보게 되는 화면</a>
            <a href="#process" className="transition hover:text-white">진행 순서</a>
            <a href="/biz#contact" className="rounded-full bg-white px-3.5 py-2 text-[#08111f] transition hover:bg-[#dce8ff]">상담 문의</a>
          </nav>
          <a href="/biz#contact" className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#08111f] sm:hidden">상담 문의</a>
        </div>
      </header>

      <section className="overflow-hidden bg-[#08111f] text-white">
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 lg:px-8 lg:pb-24 lg:pt-24">
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#2f6df6]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-48 left-1/3 h-96 w-96 rounded-full bg-[#16a085]/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-black tracking-[0.18em] text-[#8eb5ff]">MODOO UNIFORM · 도입 안내</p>
            <h1 className="mt-5 text-[clamp(38px,7vw,76px)] font-black leading-[1.03] tracking-[-0.065em]">
              고객이 보는 화면과<br />
              사장님이 받는 화면을<br />
              한 번에 보여드립니다.
            </h1>
            <p className="mt-6 max-w-xl text-[16px] leading-8 text-white/65 lg:text-[18px]">
              기존 쇼핑몰에 붙일지, 홈페이지를 새로 만들지, 생산 파트너로 시작할지 선택하시면 됩니다.
              아래에서 실제 진행 모습과 가격을 먼저 확인해 보세요.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#pricing" className="rounded-2xl bg-white px-5 py-3.5 text-center text-sm font-black text-[#08111f] transition hover:bg-[#dce8ff]">가격과 방식 보기</a>
              <a href="/biz#contact" className="rounded-2xl border border-white/20 px-5 py-3.5 text-center text-sm font-black text-white transition hover:border-white/50 hover:bg-white/5">내 업체 기준으로 상담받기</a>
            </div>
          </div>

          <div className="relative mt-14 grid gap-3 md:grid-cols-3 lg:mt-20">
            {routes.map((route) => (
              <a key={route.id} href={`#${route.id}`} className="group rounded-[22px] border border-white/10 bg-white/[0.06] p-5 transition hover:-translate-y-1 hover:bg-white/[0.1]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black tracking-[0.15em]" style={{ color: route.accent }}>{route.number}</span>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: route.accent }} />
                </div>
                <p className="mt-8 text-xs font-bold text-white/50">{route.label}</p>
                <h2 className="mt-2 text-[20px] font-black leading-tight tracking-[-0.04em]">{route.title}</h2>
                <p className="mt-7 text-[21px] font-black" style={{ color: route.accent }}>{route.price}</p>
                <p className="mt-1 text-xs font-bold text-white/45">{route.note}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-xs font-black text-white/70 transition group-hover:text-white">자세히 보기 <span aria-hidden>↘</span></span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-16 lg:px-8 lg:py-24">
        <SectionIntro eyebrow="먼저 가격부터" title="세 가지 시작 방식이 있습니다." body="지금 운영 중인 채널과 생산 구조에 따라 가장 부담이 적은 방식으로 시작합니다." />
        <div className="mt-9 grid gap-4 lg:grid-cols-3">
          <PriceCard route={routes[0]}>
            <p>카페24·고도몰·아임웹 상품 상세에 주문 버튼을 연결합니다.</p>
            <p>고객은 디자인·견적 화면을 쓰고, 결제와 배송은 기존 쇼핑몰 흐름을 유지합니다.</p>
          </PriceCard>
          <PriceCard route={routes[1]}>
            <p>브랜드 홈페이지와 상품·디자인·견적 흐름을 처음부터 만듭니다.</p>
            <p>도메인·결제·상품 수·기존 자료 이전 범위에 따라 최종 견적을 정합니다.</p>
          </PriceCard>
          <PriceCard route={routes[2]}>
            <p>생산 설비가 있으면 저희가 보내는 주문을 작업 화면으로 받습니다.</p>
            <p>월 이용료 없이 생산 가능한 품목·인쇄 방식·납기 조건을 먼저 맞춥니다.</p>
          </PriceCard>
        </div>
        <p className="mt-5 text-xs leading-6 text-[#7c8798]">표시 가격은 시작 기준입니다. 홈페이지 제작은 제품 수·결제·자료 이전 범위에 따라, 생산 파트너는 품목·인쇄·배송 조건에 따라 상담 후 확정합니다.</p>
      </section>

      <section id="screens" className="border-y border-[#e2e7ed] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
          <SectionIntro eyebrow="어떤 화면을 보게 되나요?" title="고객이 직접 정리한 정보가 다음 화면으로 넘어갑니다." body="카카오톡으로 로고·수량·사이즈를 다시 묻는 과정을 줄이고, 같은 주문 정보를 다음 담당자에게 전달합니다." />
          <div className="mt-10 grid gap-3 md:grid-cols-4">
            {processSteps.map(([num, title, body]) => (
              <div key={num} className="relative rounded-2xl border border-[#e2e7ed] bg-[#f7f9fb] p-5">
                <span className="text-xs font-black text-[#2f6df6]">{num}</span>
                <h3 className="mt-5 text-[16px] font-black leading-snug">{title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-[#667085]">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 grid gap-4 rounded-[28px] bg-[#08111f] p-4 text-white sm:p-6 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:p-8">
            <div className="p-2 sm:p-4">
              <p className="text-xs font-black tracking-[0.16em] text-[#8eb5ff]">고객 화면</p>
              <h3 className="mt-4 text-[27px] font-black leading-tight tracking-[-0.05em]">도안을 올리고,<br />옷에 찍힐 크기를 확인합니다.</h3>
              <p className="mt-4 text-sm leading-7 text-white/60">앞·뒤·좌·우를 바꿔 보면서 디자인을 놓고, 인쇄 방식과 크기에 따라 달라지는 견적을 확인합니다.</p>
            </div>
            <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
              <Image src="/biz/editor.jpg" alt="고객이 상품 위에 디자인을 배치하고 가격을 확인하는 화면" width={1200} height={800} className="h-auto w-full" />
            </div>
          </div>
        </div>
      </section>

      <section id="cafe24" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-16 lg:px-8 lg:py-24">
        <RouteHeading number="01" eyebrow="기존 쇼핑몰이 있는 업체" title="카페24는 그대로 두고, 주문 화면만 붙입니다." body="상품과 브랜드를 전부 옮길 필요 없이 고객이 디자인하고 주문하는 구간부터 연결합니다." accent="#2f6df6" />
        <div className="mt-10 grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-3">
            <InfoStep num="01" title="상품 상세에 버튼을 붙입니다" body="‘내 디자인으로 주문하기’ 버튼이나 상품 상세 안의 편집 화면으로 연결합니다." />
            <InfoStep num="02" title="고객이 직접 디자인합니다" body="로고 업로드, 위치·크기 조정, 앞·뒤·좌·우 확인, 예상 견적까지 한 화면에서 진행합니다." />
            <InfoStep num="03" title="주문은 기존 운영 흐름에 맞춥니다" body="현재 쇼핑몰의 결제·배송을 유지하거나, 상담 후 필요한 구간만 바꿉니다." />
          </div>
          <div className="rounded-[26px] border border-[#dbe5ff] bg-[#eef4ff] p-3 sm:p-5">
            <div className="mb-3 flex items-center justify-between px-1 text-xs font-bold text-[#65748b]"><span>카페24 상품 상세</span><span className="rounded-full bg-white px-2 py-1 text-[10px] text-[#2f6df6]">버튼 한 줄 연결</span></div>
            <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
              <div className="grid gap-5 sm:grid-cols-[0.8fr_1fr] sm:items-center">
                <ProductVisualCard product={productVisuals[0]} tone="blue" />
                <div>
                  <p className="text-[11px] font-bold text-[#8a95a5]">PRINTSTAR · 17수 반팔</p>
                  <h3 className="mt-2 text-xl font-black">내 디자인으로 단체티 주문</h3>
                  <p className="mt-2 text-xs leading-5 text-[#7b8797]">상품은 그대로 두고, 커스텀 주문만 연결합니다.</p>
                  <a href="/biz#contact" className="mt-5 block rounded-xl bg-[#2f6df6] px-4 py-3 text-center text-sm font-black text-white">내 디자인으로 주문하기</a>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs font-bold leading-5 text-[#60708b]">고객은 이 버튼을 눌러 디자인 화면으로 이동합니다.</p>
          </div>
        </div>
      </section>

      <section id="new-homepage" className="border-y border-[#e2e7ed] bg-[#f8fafc]">
        <div className="mx-auto max-w-6xl scroll-mt-16 px-5 py-16 lg:px-8 lg:py-24">
          <RouteHeading number="02" eyebrow="홈페이지가 없거나 새로 만들 업체" title="브랜드 홈페이지부터 주문 화면까지 한 번에 만듭니다." body="고객이 들어오는 첫 화면부터 상품 선택·디자인·견적·주문까지 하나의 흐름으로 설계합니다." accent="#f27d52" />
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="overflow-hidden rounded-[26px] bg-[#08111f] p-3 shadow-xl sm:p-5">
              <div className="mb-4 flex items-center justify-between px-1 text-xs font-bold text-white/50"><span>새로 만드는 홈페이지 예시</span><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-[#ffae92]">200만원부터</span></div>
              <div className="overflow-hidden rounded-2xl bg-white">
                <div className="flex items-center justify-between border-b border-[#eef0f3] px-4 py-3"><span className="text-[11px] font-black">YOUR BRAND</span><span className="flex gap-1.5"><i className="h-2 w-2 rounded-full bg-[#f27d52]" /><i className="h-2 w-2 rounded-full bg-[#cbd5e1]" /><i className="h-2 w-2 rounded-full bg-[#cbd5e1]" /></span></div>
                <div className="grid gap-5 p-5 sm:grid-cols-[1fr_0.8fr] sm:p-8">
                  <div><p className="text-[10px] font-black tracking-[0.14em] text-[#f27d52]">CUSTOM ORDER SYSTEM</p><h3 className="mt-3 text-[27px] font-black leading-[1.05] tracking-[-0.06em] sm:text-[38px]">주문받는 시간을<br />줄여드립니다.</h3><p className="mt-3 text-xs leading-5 text-[#667085]">상품을 고르고, 직접 디자인하고, 필요한 수량을 입력하면 주문 정보가 정리됩니다.</p><div className="mt-5 inline-flex rounded-lg bg-[#111827] px-3 py-2 text-[11px] font-black text-white">상품 둘러보기 →</div></div>
                  <HomepageProductPreview product={productVisuals[1] ?? productVisuals[0]} />
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-[#eef0f3] p-4 text-center text-[10px] font-bold text-[#667085]"><span>직접 디자인</span><span>자동 견적</span><span>작업지시서</span></div>
              </div>
            </div>
            <div className="space-y-3">
              <InfoStep num="01" title="우리 브랜드에 맞는 첫 화면" body="로고·도메인·상품 구성·문의 동선을 기준으로 홈페이지를 설계합니다." />
              <InfoStep num="02" title="상품과 단가를 세팅" body="제품별 기본가와 인쇄 방식·크기 기준을 넣어 고객이 주문 전에 가격을 이해하게 합니다." />
              <InfoStep num="03" title="오픈 전 실제 주문 테스트" body="고객 화면, 주문 확인, 파일 다운로드, 결제·배송까지 테스트한 뒤 공개합니다." />
              <div className="rounded-2xl border border-[#f6c8b8] bg-white p-5"><p className="text-xs font-black text-[#f27d52]">기본 제작비</p><p className="mt-2 text-[30px] font-black tracking-[-0.05em]">200만원부터</p><p className="mt-2 text-xs leading-5 text-[#7a8798]">상품 수와 결제·회원·기존 자료 이전 범위를 확인한 뒤 정확한 견적을 안내합니다.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="partner" className="bg-[#0f2424] text-white">
        <div className="mx-auto max-w-6xl scroll-mt-16 px-5 py-16 lg:px-8 lg:py-24">
          <RouteHeading number="03" eyebrow="생산 설비가 있는 업체" title="주문이 들어오면, 작업지시 화면으로 바로 열립니다." body="고객과 카카오톡을 주고받으며 로고·수량·크기를 다시 확인하는 대신, 필요한 생산 정보가 한 주문에 모여서 도착합니다." accent="#65e0bc" light />
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#071717] p-2 shadow-2xl sm:p-4">
              <div className="mb-3 flex items-center justify-between px-2 text-xs font-bold text-white/45"><span>생산 파트너 작업 화면</span><span className="text-[#65e0bc]">주문 링크로 바로 열기</span></div>
              <Image src="/biz/workorder.jpg" alt="생산 파트너가 앞뒤좌우 도안과 수량, 인쇄 사양을 확인하는 작업 화면" width={1200} height={800} className="h-auto w-full rounded-xl" />
            </div>
            <div className="space-y-3">
              <PartnerInboxMock />
              <p className="px-1 text-xs leading-6 text-white/50">화면 안에서 앞·뒤·좌·우 도안, 사이즈별 수량, 제품 정보, 인쇄 방식·크기, 원본 파일, 담당자 소통을 함께 확인합니다.</p>
            </div>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            <DarkFeature title="월 이용료 없음" body="생산 가능한 품목과 인쇄 조건을 맞춘 뒤 저희 주문을 연결합니다." />
            <DarkFeature title="계정 부담을 줄인 링크 화면" body="초대받은 작업 화면에서 주문을 확인하고 필요한 파일을 내려받습니다." />
            <DarkFeature title="주문 정보가 다시 정리됩니다" body="제품·수량·도안·인쇄 사양이 한 화면에 있어 생산 전 확인이 빠릅니다." />
          </div>
        </div>
      </section>

      <section id="process" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-16 lg:px-8 lg:py-24">
        <SectionIntro eyebrow="도입 후 진행 순서" title="상담에서 실제 운영까지 이렇게 진행합니다." body="업체 상황을 먼저 확인하고, 한 번에 큰 결정을 하지 않도록 작은 범위부터 화면으로 맞춰봅니다." />
        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {[
            ['01', '상황 확인', '현재 쇼핑몰·생산 품목·주문 방식을 확인합니다.'],
            ['02', '방식 선택', '카페24 연동·홈페이지 제작·생산 파트너 중 방향을 잡습니다.'],
            ['03', '화면 설계', '고객 화면과 운영 화면에서 필요한 정보를 정리합니다.'],
            ['04', '테스트', '샘플 상품과 실제 주문 흐름으로 확인합니다.'],
            ['05', '운영 시작', '담당자에게 사용법을 안내하고 주문을 받기 시작합니다.'],
          ].map(([num, title, body]) => (
            <div key={num} className="rounded-2xl border border-[#e2e7ed] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.04)]">
              <span className="text-xs font-black text-[#2f6df6]">{num}</span>
              <h3 className="mt-5 text-[16px] font-black">{title}</h3>
              <p className="mt-2 text-[13px] leading-6 text-[#667085]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[#e2e7ed] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
          <SectionIntro eyebrow="자주 묻는 부분" title="이런 식으로 생각하시면 됩니다." />
          <div className="mt-8 divide-y divide-[#e5e9ef] rounded-2xl border border-[#e2e7ed] bg-[#fbfcfd] px-5 sm:px-7">
            <Faq q="카페24를 쓰고 있는데 쇼핑몰을 전부 바꿔야 하나요?" a="그럴 필요 없이 상품 상세에서 커스텀 주문 화면으로 연결하는 방식부터 검토합니다. 결제·배송을 유지할지, 주문 구간까지 바꿀지는 현재 운영 방식에 맞춰 정합니다." />
            <Faq q="홈페이지 신규 제작 200만원에 어디까지 들어가나요?" a="기본 홈페이지와 커스텀 주문 흐름을 만드는 시작 기준입니다. 상품 수, 결제·회원 기능, 기존 자료·주문 이전, 도메인과 외부 연동 범위를 확인한 뒤 최종 견적을 안내합니다." />
            <Faq q="생산 파트너가 되면 고객을 직접 응대해야 하나요?" a="기본 구조는 저희가 받은 주문을 생산 파트너 작업 화면으로 전달하는 방식입니다. 품목·인쇄·납기·배송 조건을 협의한 뒤 필요한 소통 범위를 정합니다." />
            <Faq q="생산 파트너 화면에서 실제로 무엇을 보나요?" a="앞·뒤·좌·우 도안, 사이즈별 수량, 제품 정보, 인쇄 방식과 크기, 원본 파일, 주문 관련 소통을 한 주문 안에서 확인합니다." />
          </div>
        </div>
      </section>

      <section className="bg-[#eaf1ff]">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center lg:py-24">
          <p className="text-xs font-black tracking-[0.16em] text-[#2f6df6]">맞는 방식을 같이 고릅니다</p>
          <h2 className="mt-4 text-[clamp(30px,5vw,54px)] font-black leading-[1.05] tracking-[-0.06em]">지금 가진 쇼핑몰과<br />생산 구조부터 보여주세요.</h2>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-[#60708b]">카페24 연동이 맞는지, 홈페이지를 새로 만드는 게 맞는지, 생산 파트너로 시작할 수 있는지 화면을 놓고 설명드립니다.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="/biz#contact" className="rounded-2xl bg-[#08111f] px-6 py-4 text-sm font-black text-white transition hover:bg-[#1d3554]">도입 문의 남기기</a>
            <a href="tel:01020870621" className="rounded-2xl border border-[#c5d5f5] bg-white px-6 py-4 text-sm font-black text-[#08111f] transition hover:border-[#2f6df6]">010-2087-0621로 바로 통화</a>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-black tracking-[0.16em] text-[#2f6df6]">{eyebrow}</p>
      <h2 className="mt-3 text-[clamp(28px,4vw,46px)] font-black leading-[1.08] tracking-[-0.06em]">{title}</h2>
      {body && <p className="mt-4 text-[15px] leading-7 text-[#667085]">{body}</p>}
    </div>
  );
}

function RouteHeading({ number, eyebrow, title, body, accent, light = false }: { number: string; eyebrow: string; title: string; body: string; accent: string; light?: boolean }) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3">
        <span className="text-xs font-black tracking-[0.16em]" style={{ color: accent }}>{number}</span>
        <span className={`h-px w-10 ${light ? 'bg-white/20' : 'bg-[#d9e1eb]'}`} />
        <p className={`text-xs font-black tracking-[0.16em] ${light ? 'text-white/55' : 'text-[#7b8797]'}`}>{eyebrow}</p>
      </div>
      <h2 className={`mt-5 text-[clamp(30px,5vw,57px)] font-black leading-[1.05] tracking-[-0.065em] ${light ? 'text-white' : 'text-[#111827]'}`}>{title}</h2>
      <p className={`mt-5 max-w-2xl text-[15px] leading-7 ${light ? 'text-white/60' : 'text-[#667085]'}`}>{body}</p>
    </div>
  );
}

function PriceCard({ route, children }: { route: (typeof routes)[number]; children: React.ReactNode }) {
  return (
    <article className="flex flex-col rounded-[24px] border border-[#e0e6ed] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,.04)]">
      <div className="flex items-center justify-between"><span className="text-xs font-black" style={{ color: route.accent }}>{route.number}</span><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: route.accent }} /></div>
      <p className="mt-8 text-xs font-bold text-[#8994a4]">{route.label}</p>
      <h3 className="mt-2 text-[22px] font-black leading-tight tracking-[-0.045em]">{route.title}</h3>
      <p className="mt-7 text-[25px] font-black tracking-[-0.05em]" style={{ color: route.accent }}>{route.price}</p>
      <p className="mt-1 text-xs font-bold text-[#8994a4]">{route.note}</p>
      <div className="mt-7 space-y-3 border-t border-[#edf0f3] pt-5 text-[13px] leading-6 text-[#667085]">{children}</div>
    </article>
  );
}

function ProductVisualCard({ product, tone }: { product: ProductVisual; tone: 'blue' | 'peach' }) {
  return (
    <div className={`group relative aspect-square overflow-hidden rounded-xl ${tone === 'blue' ? 'bg-[#f3f5f7]' : 'bg-[#f8ebe5]'}`}>
      <Image
        src={product.image}
        alt={`${product.title} 실제 상품 이미지`}
        fill
        sizes="(max-width: 640px) 80vw, 300px"
        className="object-contain p-7 transition duration-700 ease-out group-hover:scale-110"
      />
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-lg bg-white/90 px-3 py-2 text-[10px] font-black text-[#344054] shadow-sm backdrop-blur">
        <span className="max-w-[75%] truncate">{product.title}</span>
        <span className="text-[#2f6df6]">실제 상품</span>
      </div>
    </div>
  );
}

function HomepageProductPreview({ product }: { product: ProductVisual }) {
  return (
    <div className="relative flex min-h-[190px] items-end justify-center overflow-hidden rounded-2xl bg-[#f8ebe5] pb-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/60 to-transparent" />
      <div className="relative h-[170px] w-[170px] animate-[float_3.2s_ease-in-out_infinite] sm:h-[190px] sm:w-[190px]">
        <Image
          src={product.image}
          alt={`${product.title} 실제 상품 이미지`}
          fill
          sizes="190px"
          className="object-contain p-3 drop-shadow-[0_18px_18px_rgba(111,65,46,.16)]"
        />
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1.5 text-[10px] font-black text-[#a85135] shadow-sm backdrop-blur">운영 상품 데이터</span>
      <span className="absolute bottom-3 right-3 rounded-full bg-[#111827] px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm">디자인 화면 연결</span>
    </div>
  );
}

function InfoStep({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-[#e2e7ed] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.035)]">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#eaf1ff] text-[11px] font-black text-[#2f6df6]">{num}</span>
      <div><h3 className="text-[16px] font-black">{title}</h3><p className="mt-1.5 text-[13px] leading-6 text-[#667085]">{body}</p></div>
    </div>
  );
}

function PartnerInboxMock() {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white p-4 text-[#132222] shadow-2xl sm:p-5">
      <div className="flex items-start justify-between border-b border-[#e8eeee] pb-4"><div><p className="text-[10px] font-black tracking-[0.14em] text-[#16a085]">NEW WORK ORDER</p><h3 className="mt-1.5 text-[18px] font-black">오버핏 라운드 티셔츠</h3></div><span className="rounded-full bg-[#e4f7f1] px-2.5 py-1 text-[10px] font-black text-[#16856e]">제작 대기</span></div>
      <div className="grid grid-cols-2 gap-3 border-b border-[#e8eeee] py-4 text-xs"><div><p className="text-[#91a09e]">총 수량</p><p className="mt-1 font-black">20장</p></div><div><p className="text-[#91a09e]">인쇄</p><p className="mt-1 font-black">앞면 DTF 전사</p></div><div><p className="text-[#91a09e]">도안</p><p className="mt-1 font-black">앞·뒤·좌·우 4면</p></div><div><p className="text-[#91a09e]">파일</p><p className="mt-1 font-black">원본 1개 첨부</p></div></div>
      <div className="mt-4 flex gap-2"><button type="button" className="flex-1 rounded-xl bg-[#132222] px-3 py-3 text-xs font-black text-white">작업지시 열기</button><button type="button" className="rounded-xl border border-[#dfe8e5] px-3 py-3 text-xs font-black text-[#52615f]">파일 받기</button></div>
    </div>
  );
}

function DarkFeature({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"><p className="text-[16px] font-black text-[#65e0bc]">{title}</p><p className="mt-2 text-[13px] leading-6 text-white/55">{body}</p></div>;
}

function Faq({ q, a }: { q: string; a: string }) {
  return <details className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-black"><span>{q}</span><span className="text-xl font-normal text-[#8490a0] transition group-open:rotate-45">+</span></summary><p className="max-w-3xl pt-3 text-[13px] leading-6 text-[#667085]">{a}</p></details>;
}
