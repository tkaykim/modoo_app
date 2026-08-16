'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** 방문자 유형. 케이스별로 보여줄 내용과 제안이 갈린다. */
type Track = 'produce' | 'mall_only' | 'new_shop' | 'outsource' | 'supplier';

const CASES: {
  key: Track;
  q: string;
  who: string;
  headline: string;
  body: string;
  offer: string;
  price: string;
  points: string[];
}[] = [
  {
    key: 'produce',
    q: '직접 찍습니다',
    who: '전사기·자수기 등 설비를 갖춘 공장·인쇄소',
    headline: '설비는 있는데 주문받는 데서 시간이 다 샙니다',
    body: '시안 왕복과 수기 견적에 붙는 사람 시간이 그 주문의 마진보다 큽니다. 저희는 그 앞단을 통째로 웹으로 옮겼습니다.',
    offer: '시스템을 무상으로 드립니다',
    price: '월 이용료 없음',
    points: [
      '주문 접수·작업지시 시스템 무상 제공',
      '저희가 보내는 발주도 같은 화면으로 받으십니다',
      '계정 없이 링크만으로 여는 작업 화면',
      '도안과 원본 파일이 자동으로 전달됩니다',
    ],
  },
  {
    key: 'mall_only',
    q: '쇼핑몰은 있는데 커스텀 주문만 못 받습니다',
    who: '카페24·고도몰·아임웹으로 몰을 운영 중인 곳',
    headline: '쓰시던 몰에 모듈로 붙여드립니다',
    body: '결제와 배송은 지금 채널이 그대로 하고, 주문 접수 단계만 연결합니다. 3영업일이면 실제로 붙은 화면을 보실 수 있습니다.',
    offer: '3영업일 안에 붙여드립니다',
    price: '월 59,000원부터 · 세팅비 0원',
    points: [
      '상품 상세에 버튼 한 줄이면 연결됩니다',
      '편집기를 몰 안에 넣는 방식도 가능합니다',
      '쓰시던 인쇄 단가를 그대로 씁니다',
      '약정 없음 · 첫 달 비용 없음',
    ],
  },
  {
    key: 'new_shop',
    q: '쇼핑몰이 없거나, 갈아타고 싶습니다',
    who: '몰을 새로 열거나 기존 몰이 답답하신 곳',
    headline: '몰부터 같이 만들어 드립니다',
    body: '커스텀 주문이 되는 쇼핑몰을 처음부터 만들어 드립니다. 이미 몰이 있으시면 상품·회원·주문 이전까지 상담해 드립니다.',
    offer: '신규 제작 · 기존 몰 이전 상담',
    price: '범위에 따라 협의',
    points: [
      '주문 편집기가 처음부터 들어간 몰을 만듭니다',
      '기존 몰의 상품·이미지·회원 이전을 상담해 드립니다',
      '도메인과 결제 연동까지 함께 잡아드립니다',
      '먼저 붙이고 나중에 옮기셔도 됩니다',
    ],
  },
  {
    key: 'outsource',
    q: '영업만 하고 생산은 맡깁니다',
    who: '단체복·굿즈를 받아서 파는 판매업체',
    headline: '입점만 하셔도 되고, 도구만 쓰셔도 됩니다',
    body: '몰을 따로 운영하실 필요가 없습니다. 저희 플랫폼에 입점만 하시거나, 주문 도구는 무료로 쓰시고 제작만 맡기셔도 됩니다.',
    offer: '입점 · 생산 위탁',
    price: '월 이용료 없음',
    points: [
      '입점만 하시면 몰 운영 없이 판매하실 수 있습니다',
      '고객이 직접 디자인하고 견적이 자동으로 나옵니다',
      '주문이 들어오면 저희 공장으로 바로 넘어갑니다',
      '브랜드를 그대로 유지한 전용몰도 가능합니다',
    ],
  },
  {
    key: 'supplier',
    q: '장비나 소재를 공급합니다',
    who: 'DTF·전사·자수 장비 및 소모품 공급사',
    headline: '장비 파실 때 같이 얹으실 수 있습니다',
    body: '장비를 산 사장님들이 주문을 어떻게 받을지 막막해하십니다. 그 자리를 저희 시스템이 채웁니다.',
    offer: '공급사 제휴 논의',
    price: '조건 협의',
    points: [
      '장비 판매 시 번들로 제안하실 수 있습니다',
      '고객사 문의를 저희가 받아 처리합니다',
      '공급사 전용 조건을 따로 논의합니다',
    ],
  },
];

const PLATFORMS = [
  { v: 'cafe24', t: '카페24' },
  { v: 'godo', t: '고도몰' },
  { v: 'imweb', t: '아임웹' },
  { v: 'smartstore', t: '스마트스토어' },
  { v: 'custom', t: '자체 제작' },
  { v: 'none', t: '없음' },
];

const ORDERS = [
  { v: 'lt10', t: '10건 미만' },
  { v: '10_50', t: '10~50건' },
  { v: '50_200', t: '50~200건' },
  { v: 'gt200', t: '200건 이상' },
];

export default function BizLanding() {
  const [openCase, setOpenCase] = useState<Track | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [more, setMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const [f, setF] = useState({
    contactName: '', phone: '', company: '', shopUrl: '',
    platform: '', monthlyOrders: '', painNote: '',
    agreePrivacy: false, agreeMarketing: false,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF(p => ({ ...p, [k]: v }));

  const pick = useCallback((k: Track) => {
    setTrack(k);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, []);

  const [utm, setUtm] = useState<{ s?: string; m?: string; c?: string }>({});
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setUtm({ s: p.get('utm_source') ?? undefined, m: p.get('utm_medium') ?? undefined, c: p.get('utm_campaign') ?? undefined });
  }, []);

  const submit = async () => {
    setErr(null);
    if (!f.contactName.trim()) return setErr('성함을 입력해 주세요.');
    if ((f.phone.match(/\d/g) || []).length < 9) return setErr('연락처를 정확히 입력해 주세요.');
    if (!f.agreePrivacy) return setErr('개인정보 수집·이용에 동의해 주세요.');
    setSending(true);
    try {
      const res = await fetch('/api/biz/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f, track: track ?? 'unknown',
          utmSource: utm.s, utmMedium: utm.m, utmCampaign: utm.c,
          source: utm.m === 'qr' ? 'booth' : 'web',
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || '접수에 실패했습니다.');
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '접수에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const current = CASES.find(c => c.key === track);

  return (
    <div className="min-h-[100dvh] bg-[#f6f7fb] text-[#17191f]">
      <main className="mx-auto w-full max-w-md overflow-hidden pb-10">

        {/* 히어로 */}
        <section className="relative overflow-hidden bg-[#07101f] px-5 pb-10 pt-12 text-white">
          <div className="pointer-events-none absolute -right-20 -top-10 h-56 w-56 rounded-full bg-[#0052cc]/25" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-[#8fb8ff]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4d8dff]" />
              단체복·굿즈 제작업체 전용
            </div>
            <h1 className="mt-4 text-[36px] font-black leading-[1.1]">
              주문서 한 장에<br />사흘 쓰고 계십니까
            </h1>
            <p className="mt-4 text-[14px] leading-relaxed text-[#aab6cc]">
              로고 받고, 시안 만들고, 크기 물어보고, 견적 두드리고, 다시 보내고.
              <br />저희도 그렇게 했습니다. 그래서 그 과정을 전부 웹으로 옮겼습니다.
            </p>
            <div className="mt-6 rounded-[18px] bg-white p-4 text-[#17191f] shadow-[0_18px_50px_rgba(0,0,0,.35)]">
              <p className="text-[11px] font-black text-[#0052cc]">지금 하는 일</p>
              <p className="mt-1 text-[15px] font-bold leading-snug">
                고객이 직접 그리면<br />견적이 자동으로 나옵니다
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[#667085]">
                주문이 들어오면 인쇄용 파일과 작업지시서가 저절로 만들어져 공장으로 넘어갑니다.
              </p>
            </div>
          </div>
        </section>

        {/* 케이스 분기 */}
        <section className="rounded-t-[30px] -mt-4 relative z-10 bg-[#f6f7fb] px-5 pb-8 pt-8">
          <p className="text-[11px] font-black text-[#0052cc]">먼저 하나만 알려주십시오</p>
          <h2 className="mt-1 text-[25px] font-black leading-tight">
            어느 쪽이십니까
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">
            답에 따라 제안이 완전히 달라집니다. 눌러서 확인해 보십시오.
          </p>

          <div className="mt-5 flex flex-col gap-2.5">
            {CASES.map(c => {
              const open = openCase === c.key;
              return (
                <div key={c.key} className="overflow-hidden rounded-[20px] bg-white shadow-[0_6px_20px_rgba(23,25,31,.06)]">
                  <button
                    type="button"
                    onClick={() => setOpenCase(open ? null : c.key)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                  >
                    <span>
                      <span className="block text-[15.5px] font-black leading-snug">{c.q}</span>
                      <span className="mt-0.5 block text-[12px] text-[#667085]">{c.who}</span>
                    </span>
                    <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[15px] font-black transition ${open ? 'bg-[#0052cc] text-white' : 'bg-[#eef2f8] text-[#8b93a3]'}`}>
                      {open ? '−' : '+'}
                    </span>
                  </button>

                  {open && (
                    <div className="border-t border-[#eef0f5] px-4 pb-4 pt-4">
                      <p className="text-[16px] font-black leading-snug">{c.headline}</p>
                      <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">{c.body}</p>
                      <ul className="mt-3 flex flex-col gap-1.5">
                        {c.points.map(p => (
                          <li key={p} className="flex gap-2 text-[13px] leading-relaxed">
                            <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-[#0052cc]" />
                            <span className="text-[#3d4455]">{p}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 flex items-center justify-between rounded-[14px] bg-[#eaf2ff] px-4 py-3">
                        <span className="text-[13px] font-black text-[#0052cc]">{c.offer}</span>
                        <span className="text-[12.5px] font-bold text-[#17191f]">{c.price}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => pick(c.key)}
                        className="mt-3 w-full rounded-[15px] bg-[#0052cc] px-4 py-3.5 text-[14.5px] font-black text-white active:bg-[#003f9e]"
                      >
                        이 방식으로 상담받기
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 실제 화면 */}
        <section className="bg-white px-5 py-9">
          <p className="text-[11px] font-black text-[#0052cc]">실제 화면</p>
          <h2 className="mt-1 text-[25px] font-black leading-tight">
            옷에 찍힐 크기가<br />밀리미터로 나옵니다
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">
            제품마다 실측해서 보정값을 넣었습니다. 도안을 키우면 값이 따라 올라갑니다.
          </p>
          <figure className="mt-4">
            <img src="/biz/editor.jpg" alt="웹 디자인 편집기 화면" className="w-full rounded-[16px] border border-[#e8eaf0]" loading="lazy" />
            <figcaption className="mt-2 text-[12px] leading-relaxed text-[#8b93a3]">
              기본가 7,900원 + 디자인 8,000원이 자동으로 합산되어 있습니다.
            </figcaption>
          </figure>

          <h3 className="mt-8 text-[19px] font-black leading-tight">공장은 링크만 열면 됩니다</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">
            계정을 만들지 않아도 됩니다. 네 면의 도안과 인쇄 방식, 크기, 원본 파일이 한 화면에 있습니다.
          </p>
          <figure className="mt-4">
            <img src="/biz/workorder.jpg" alt="공장 작업지시 화면" className="w-full rounded-[16px] border border-[#e8eaf0]" loading="lazy" />
            <figcaption className="mt-2 text-[12px] leading-relaxed text-[#8b93a3]">
              방식은 DTF 전사, 크기는 71.9 × 8.2cm로 찍혀 있습니다.
            </figcaption>
          </figure>

          <div className="mt-7 rounded-[18px] bg-[#f6f7fb] p-4">
            <p className="text-[13.5px] font-black">일러스트레이터 AI 파일도 그대로 올라갑니다</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#667085]">
              PSD도 됩니다. 자동으로 변환해 화면에 올리고 원본은 따로 보관해서, 생산 단계에서 원본을 그대로 내려받습니다.
              올린 이미지의 배경은 알아서 지워집니다.
            </p>
          </div>
        </section>

        {/* 함께 하는 방식 */}
        <section className="bg-[#f6f7fb] px-5 py-9">
          <p className="text-[11px] font-black text-[#0052cc]">고르시면 됩니다</p>
          <h2 className="mt-1 text-[25px] font-black leading-tight">
            함께 하는 방식은<br />네 가지입니다
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">
            지금 상황에서 가장 부담 적은 쪽으로 시작하시고, 나중에 옮기셔도 됩니다.
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            {[
              ['쓰던 몰에 모듈로 붙이기', '카페24·고도몰·아임웹에 주문 편집기를 연결합니다. 가장 빠르고 부담이 적습니다.', '월 59,000원부터'],
              ['쇼핑몰을 새로 만들기', '커스텀 주문이 처음부터 되는 몰을 만들어 드립니다. 기존 몰이 있으시면 이전도 상담해 드립니다.', '범위 협의'],
              ['입점만 하기', '몰을 운영하지 않으셔도 됩니다. 저희 플랫폼에 상품만 올리고 판매하십시오.', '월 이용료 없음'],
              ['생산 파트너로 참여', '설비를 갖추셨다면 시스템을 무상으로 드리고 저희 발주를 연결합니다.', '월 이용료 없음'],
            ].map(([t, d, p]) => (
              <div key={t} className="rounded-[18px] bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14.5px] font-black leading-snug">{t}</p>
                  <span className="flex-none rounded-full bg-[#eaf2ff] px-2.5 py-1 text-[11.5px] font-bold text-[#0052cc]">{p}</span>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#667085]">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 자주 묻는 조건 */}
        <section className="bg-white px-5 py-9">
          <p className="text-[11px] font-black text-[#0052cc]">자주 묻는 조건</p>
          <h2 className="mt-1 text-[25px] font-black leading-tight">이런 경우도 방법이 있습니다</h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {[
              ['스마트스토어를 쓰고 있습니다', '네이버는 외부 편집기 삽입을 막아두고 있어, 고객이 저희 쪽에서 디자인하고 코드를 받아 옵션에 넣는 방식으로 연결해 드립니다.'],
              ['나염이나 자수가 주력입니다', '편집기 자동 계산은 지금 전사(DTF) 기준입니다. 나염·자수는 단가표로 잡아 드리고, 요청이 모이는 순서대로 자동 계산에 넣고 있습니다.'],
              ['디자인 인력이 없습니다', '고객이 직접 올리는 구조라 대부분 해결되지만, 손이 필요한 건은 저희 쪽 작업으로 상담해 드립니다.'],
            ].map(([t, d]) => (
              <li key={t} className="rounded-[16px] bg-[#f6f7fb] px-4 py-3.5">
                <p className="text-[13.5px] font-black leading-snug">{t}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[#667085]">{d}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-[16px] bg-[#eaf2ff] px-4 py-3.5 text-[12.5px] leading-relaxed text-[#17191f]">
            <b className="font-black">여기 없는 요청도 남겨주십시오.</b> 같은 요청이 모이면 우선순위로 만들고 있습니다.
            지금 안 되는 것도 수요가 확인되면 만듭니다.
          </p>
        </section>

        {/* 폼 */}
        <section ref={formRef} className="scroll-mt-4 bg-white px-5 py-9">
          {done ? (
            <div className="rounded-[22px] bg-[#f6f7fb] px-5 py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#0052cc] text-[26px] text-white">✓</div>
              <p className="mt-4 text-[19px] font-black">접수되었습니다</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">
                영업일 기준 하루 안에 연락드리겠습니다.<br />
                쇼핑몰 주소를 남기셨다면 3영업일 안에 실제로 붙인 화면을 보내드립니다.
              </p>
              <a href="tel:01020870621" className="mt-5 inline-block rounded-[15px] bg-[#17191f] px-5 py-3 text-[13.5px] font-black text-white">
                급하시면 바로 통화 010-2087-0621
              </a>
            </div>
          ) : (
            <>
              <p className="text-[11px] font-black text-[#0052cc]">30초 도입 문의</p>
              <h2 className="mt-1 text-[25px] font-black leading-tight">
                두 칸만 채우시면 됩니다
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">
                나머지는 통화하면서 여쭤보겠습니다. 비용이 발생하지 않습니다.
              </p>

              <div className="mt-5 rounded-[18px] bg-[#f6f7fb] p-4">
                <p className="text-[11.5px] font-black text-[#667085]">선택하신 방식</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CASES.map(c => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setTrack(c.key)}
                      className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold transition ${
                        track === c.key ? 'bg-[#0052cc] text-white' : 'bg-white text-[#667085]'
                      }`}
                    >
                      {c.q}
                    </button>
                  ))}
                </div>
                {current && (
                  <p className="mt-2.5 text-[12px] leading-relaxed text-[#0052cc]">
                    → {current.offer} · {current.price}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-2.5">
                <input
                  value={f.contactName} onChange={e => set('contactName', e.target.value)}
                  placeholder="성함" autoComplete="name"
                  className="w-full rounded-[15px] border border-[#e2e5ec] bg-white px-4 py-3.5 text-[15px] outline-none focus:border-[#0052cc]"
                />
                <input
                  value={f.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="연락처" inputMode="tel" autoComplete="tel"
                  className="w-full rounded-[15px] border border-[#e2e5ec] bg-white px-4 py-3.5 text-[15px] outline-none focus:border-[#0052cc]"
                />
              </div>

              <button
                type="button" onClick={() => setMore(v => !v)}
                className="mt-3 text-[12.5px] font-bold text-[#0052cc] underline underline-offset-2"
              >
                {more ? '추가 정보 접기' : '더 빨리 준비하도록 정보 더 주기 (선택)'}
              </button>

              {more && (
                <div className="mt-3 flex flex-col gap-2.5 rounded-[18px] bg-[#f6f7fb] p-4">
                  <input value={f.company} onChange={e => set('company', e.target.value)} placeholder="회사명"
                    className="w-full rounded-[13px] border border-[#e2e5ec] bg-white px-3.5 py-3 text-[14px] outline-none focus:border-[#0052cc]" />
                  <input value={f.shopUrl} onChange={e => set('shopUrl', e.target.value)} placeholder="쇼핑몰 주소 (주시면 붙여서 보내드립니다)"
                    className="w-full rounded-[13px] border border-[#e2e5ec] bg-white px-3.5 py-3 text-[14px] outline-none focus:border-[#0052cc]" />
                  <div>
                    <p className="mb-1.5 text-[11.5px] font-black text-[#667085]">쇼핑몰 종류</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PLATFORMS.map(p => (
                        <button key={p.v} type="button" onClick={() => set('platform', f.platform === p.v ? '' : p.v)}
                          className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold ${f.platform === p.v ? 'bg-[#0052cc] text-white' : 'bg-white text-[#667085]'}`}>
                          {p.t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11.5px] font-black text-[#667085]">월 커스텀 주문</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ORDERS.map(o => (
                        <button key={o.v} type="button" onClick={() => set('monthlyOrders', f.monthlyOrders === o.v ? '' : o.v)}
                          className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold ${f.monthlyOrders === o.v ? 'bg-[#0052cc] text-white' : 'bg-white text-[#667085]'}`}>
                          {o.t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea value={f.painNote} onChange={e => set('painNote', e.target.value)} rows={2}
                    placeholder="가장 불편한 점 (한 줄이면 충분합니다)"
                    className="w-full resize-none rounded-[13px] border border-[#e2e5ec] bg-white px-3.5 py-3 text-[14px] outline-none focus:border-[#0052cc]" />
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2">
                <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-relaxed text-[#3d4455]">
                  <input type="checkbox" checked={f.agreePrivacy} onChange={e => set('agreePrivacy', e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-none accent-[#0052cc]" />
                  <span>
                    <b className="font-black">[필수]</b> 상담 연락을 위한 개인정보 수집·이용에 동의합니다.
                    <span className="mt-0.5 block text-[11.5px] text-[#8b93a3]">
                      수집 항목 성함·연락처(선택 항목 포함) · 목적 상담 응대 · 보유 1년 · 거부 시 상담 진행이 어렵습니다.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-relaxed text-[#3d4455]">
                  <input type="checkbox" checked={f.agreeMarketing} onChange={e => set('agreeMarketing', e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-none accent-[#0052cc]" />
                  <span><b className="font-black">[선택]</b> 신제품·기능 안내를 문자와 메일로 받겠습니다.</span>
                </label>
              </div>

              {err && <p className="mt-3 rounded-[13px] bg-[#fff5f3] px-4 py-3 text-[13px] font-bold text-[#8e3a2e]">{err}</p>}

              <button
                type="button" onClick={submit} disabled={sending}
                className="mt-4 w-full rounded-[16px] bg-[#0052cc] px-4 py-4 text-[15.5px] font-black text-white active:bg-[#003f9e] disabled:opacity-60"
              >
                {sending ? '접수 중…' : '상담 요청하기'}
              </button>
              <p className="mt-2.5 text-center text-[12px] text-[#8b93a3]">
                또는 바로 통화 <a href="tel:01020870621" className="font-bold text-[#0052cc]">010-2087-0621</a>
              </p>
            </>
          )}
        </section>

        <footer className="px-5 pb-2 pt-6 text-[11.5px] leading-relaxed text-[#8b93a3]">
          모두굿즈 (피스코프) · 대표 김현준<br />
          modoo.contact@gmail.com · modoouniform.com<br />
          K-PRINT 2026 킨텍스 제2전시장 부스 M304 · 8월 19일~22일
        </footer>
      </main>
    </div>
  );
}
