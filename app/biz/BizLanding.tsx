'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/** 방문자 유형. 케이스별로 보여줄 내용과 제안이 갈린다. */
type Track = 'produce' | 'mall_only' | 'new_shop' | 'outsource';

const CASES: {
  key: Track; q: string; chip: string; who: string; headline: string; body: string;
  offer: string; price: string; points: string[];
}[] = [
  {
    key: 'produce',
    q: '전사기, 자수기 등 설비를 갖추고 있는 공장이에요!',
    chip: '설비를 갖추고 있는 생산공장',
    who: '전사기·자수기 등 설비를 갖춘 공장·인쇄소',
    headline: '설비는 있는데 주문받는 데서 시간이 다 샙니다',
    body: '시안 왕복과 수기 견적에 하루가 다 갑니다. 저희는 그 앞단을 통째로 웹으로 옮겼습니다.',
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
    q: '쇼핑몰은 있는데, 일일이 게시판으로 문의 받고, 카톡으로 문의 받아요',
    chip: '쇼핑몰은 있는데 커스텀 주문 도입하고 싶어요',
    who: '카페24·고도몰·아임웹으로 몰을 운영 중인 곳',
    headline: '쓰시던 몰에 모듈로 붙여드립니다',
    body: '결제와 배송은 지금 채널이 그대로 하고, 주문 접수 단계만 연결합니다. 어떻게 붙는지는 상담에서 화면으로 보여드립니다.',
    offer: '쓰시던 몰에 그대로 연결',
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
    q: '쇼핑몰이 없거나, 새로 만들고 싶어요',
    chip: '쇼핑몰이 없거나 새로 만들고 싶어요',
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
    q: '영업만 하고 생산은 외주를 주고 있어요',
    chip: '영업만 하고 주문은 외주 맡기고 있어요',
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
];

const WAYS = [
  { t: '쓰던 몰에 모듈로 붙이기', d: '카페24·고도몰·아임웹에 주문 편집기를 연결합니다. 가장 빠르고 부담이 적습니다.', p: '월 59,000원부터' },
  { t: '쇼핑몰을 새로 만들기', d: '커스텀 주문이 처음부터 되는 몰을 만들어 드립니다. 기존 몰이 있으시면 이전도 상담해 드립니다.', p: '범위 협의' },
  { t: '생산 파트너로 참여', d: '설비를 갖추셨다면 시스템을 무상으로 드리고 저희 발주를 연결합니다.', p: '월 이용료 없음' },
];

const PLATFORMS = [
  { v: 'cafe24', t: '카페24' }, { v: 'godo', t: '고도몰' }, { v: 'imweb', t: '아임웹' },
  { v: 'smartstore', t: '스마트스토어' }, { v: 'custom', t: '자체 제작' }, { v: 'none', t: '없음' },
];
const ORDERS = [
  { v: 'lt10', t: '10건 미만' }, { v: '10_50', t: '10~50건' },
  { v: '50_200', t: '50~200건' }, { v: 'gt200', t: '200건 이상' },
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    } finally { setSending(false); }
  };

  const current = CASES.find(c => c.key === track);

  return (
    <div className="biz-page min-h-[100dvh] bg-[#f6f7fb] text-[#17191f]">
      <main className="mx-auto w-full max-w-md overflow-hidden pb-10">

        {/* ── 히어로 ── */}
        <section className="relative overflow-hidden bg-[#07101f] px-5 pb-0 pt-12 text-white">
          <div className="pointer-events-none absolute -right-20 -top-12 h-60 w-60 rounded-full bg-[#0052cc]/25" />
          <div className="pointer-events-none absolute -left-16 top-40 h-40 w-40 rounded-full bg-[#0052cc]/12" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-[#8fb8ff]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4d8dff]" />
              단체복·굿즈 제작업체 전용
            </div>
            <h1 className="mt-4 text-[36px] font-black leading-[1.1]">
              번거로운 주문과정을<br />자동화 해드립니다
            </h1>
            <p className="mt-4 text-[14px] leading-relaxed text-[#aab6cc]">
              로고 받고, 크기 물어보고, 시안 만들고
              <br />견적 제안하고, 다시 수정하고..
              <br />저희도 그렇게 해왔습니다.
              <br />그래서 그 과정을 전부 자동화 했습니다.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[['3분', '시연이면 이해됩니다'], ['4면', '앞·뒤·좌·우 동시'], ['0원', '세팅비']].map(([n, l], i) => (
                <RevealBlock key={n} delay={i * 110}>
                  <div className="rounded-[16px] bg-white/10 px-3 py-3 text-center backdrop-blur">
                    <p className="text-[21px] font-black leading-none text-white">{n}</p>
                    <p className="mt-1.5 text-[10.5px] leading-tight text-[#9fb0ca]">{l}</p>
                  </div>
                </RevealBlock>
              ))}
            </div>

            {/* 캐릭터 + 말풍선 */}
            <div className="relative mt-6 h-[236px]">
              <Bubble className="absolute left-0 top-2 z-20 max-w-[224px]" tail="left">
                복잡한 주문 과정을 싹 정리해서<br />완벽한 작업지시서로 전달드립니다.
              </Bubble>
              <img
                src="/biz/character.png" alt=""
                className="biz-float pointer-events-none absolute -right-8 bottom-[-96px] w-[240px] max-w-none select-none"
              />
            </div>
          </div>
        </section>

        {/* ── 문제: 카톡 왕복 ── */}
        <section className="relative z-10 -mt-4 rounded-t-[30px] bg-[#f6f7fb] px-5 pb-9 pt-8">
          <RevealBlock>
            <p className="text-[11px] font-black text-[#0052cc]">매일매일 반복되는 소통..</p>
            <h2 className="mt-1 text-[25px] font-black leading-tight">누가 처리해줄 수 없을까?</h2>
          </RevealBlock>

          <div className="mt-5 flex flex-col gap-2.5">
            {[
              { side: 'them', t: '로고 보내드렸어요~' },
              { side: 'me', t: '해상도가 좀 낮은데 원본 있으실까요?' },
              { side: 'them', t: '앞에 크게 넣어주세요' },
              { side: 'me', t: '몇 센치로 할까요?' },
              { side: 'them', t: '적당히 크게요' },
              { side: 'me', t: '(시안 만들어 보냄)' },
              { side: 'them', t: '조금만 작게…' },
            ].map((m, i) => (
              <RevealBlock key={i} delay={i * 90}>
                <div className={m.side === 'me' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={`max-w-[76%] rounded-[16px] px-3.5 py-2.5 text-[13.5px] leading-snug ${
                    m.side === 'me' ? 'bg-[#0052cc] font-bold text-white' : 'bg-white font-bold text-[#17191f] shadow-[0_4px_14px_rgba(23,25,31,.06)]'
                  }`}>{m.t}</div>
                </div>
              </RevealBlock>
            ))}
          </div>

          <RevealBlock delay={120}>
            <p className="mt-6 rounded-[18px] bg-[#17191f] px-5 py-4 text-[15px] font-black leading-snug text-white">
              주문 한 건 처리하는 데<br />하루 종일 걸리지 않으세요?
              <span className="mt-2 block text-[13px] font-bold leading-relaxed text-[#9fb0ca]">
                로고 이미지, 사이즈, 벡터화, 견적상담, 배송안내 등등
              </span>
              <span className="mt-3 block text-[19px] font-black leading-snug text-[#6fa5ff]">
                이 모든걸 자동화 합니다!
              </span>
            </p>
          </RevealBlock>
        </section>

        {/* ── 실제 화면 (확대) ── */}
        <section className="bg-[#f6f7fb] px-5 py-9">
          <RevealBlock>
            <p className="text-[11px] font-black text-[#0052cc]">실제 화면</p>
            <h2 className="mt-1 text-[25px] font-black leading-tight">
              옷에 찍힐 크기가<br />밀리미터로 나옵니다
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">
              제품마다 실측해서 보정값을 넣었습니다. 도안을 키우면 값이 따라 올라갑니다.
            </p>
          </RevealBlock>

          <ZoomShot
            shot="/biz/editor.jpg" zoom="/biz/zoom-price.jpg"
            alt="웹 디자인 편집기 화면"
            caption="기본가와 디자인비가 자동으로 합산됩니다"
            badge="자동 견적"
          />

          <RevealBlock>
            <h3 className="mt-9 text-[20px] font-black leading-tight">공장은 링크만 열면 됩니다</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">
              계정을 만들지 않아도 됩니다. 네 면의 도안과 인쇄 방식, 크기, 원본 파일이 한 화면에 있습니다.
            </p>
          </RevealBlock>

          <ZoomShot
            shot="/biz/workorder.jpg" zoom="/biz/zoom-spec.jpg"
            alt="공장 작업지시 화면"
            caption="인쇄 방식과 크기가 그대로 찍혀 나갑니다"
            badge="작업지시"
          />

          <RevealBlock>
            <div className="mt-7 rounded-[18px] bg-white p-4 shadow-[0_6px_20px_rgba(23,25,31,.05)]">
              <p className="text-[13.5px] font-black">일러스트레이터 AI 파일도 그대로 올라갑니다</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#667085]">
                PSD도 됩니다. 자동으로 변환해 화면에 올리고 원본은 따로 보관해서, 생산 단계에서 원본을 그대로 내려받습니다.
                올린 이미지의 배경은 알아서 지워집니다.
              </p>
            </div>
          </RevealBlock>

          {/* CS 답변 초안 자동 생성 — 승인 전에는 절대 나가지 않는다는 점을 함께 명시 */}
          <RevealBlock>
            <h3 className="mt-9 text-[20px] font-black leading-tight">문의 답변까지 초안을 만들어 둡니다</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">
              취급하시는 인쇄 방식과 크기별 단가를 한 번 세팅해 두시면, 그에 맞춰 AI가 답변 초안을 자동으로 만들어 둡니다.
              담당자님은 발행 승인 버튼만 누르시면 됩니다.
            </p>
          </RevealBlock>

          <div className="mt-5 rounded-[18px] border border-[#e4e7ee] bg-white p-4">
            <RevealBlock>
              <div className="flex justify-start">
                <div className="max-w-[82%] rounded-[14px] bg-[#f1f3f8] px-3.5 py-2.5 text-[12.5px] font-bold leading-snug">
                  후드티 30장에 앞뒤로 프린트하면 얼마인가요?
                </div>
              </div>
            </RevealBlock>

            <RevealBlock delay={150}>
              <div className="mt-3 rounded-[14px] border border-[#cddffa] bg-[#f2f6fc] p-3.5">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-[#0052cc] px-2 py-0.5 text-[10px] font-black text-white">AI 초안</span>
                  <span className="text-[11px] font-bold text-[#667085]">승인 대기</span>
                </div>
                <p className="mt-2 text-[12.5px] font-bold leading-relaxed">
                  후드티 30장, 앞·뒤 전사(DTF) 기준으로 계산해 두었습니다.
                  도안 크기에 따라 단가가 달라져서, 시안 확정 후 확정 견적을 보내드리겠습니다.
                </p>
              </div>
            </RevealBlock>

            <RevealBlock delay={280}>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 rounded-[12px] bg-[#0052cc] py-2.5 text-center text-[13px] font-black text-white">발행 승인</div>
                <div className="rounded-[12px] border border-[#e2e5ec] px-4 py-2.5 text-[13px] font-bold text-[#667085]">수정</div>
              </div>
            </RevealBlock>
          </div>

          <RevealBlock delay={120}>
            <p className="mt-3 text-[11.5px] font-bold leading-relaxed text-[#8b94a3]">
              AI는 초안까지만 만듭니다. 최종 발송 명령 전에는 고객에게 나가지 않습니다.
            </p>
          </RevealBlock>
        </section>

        {/* ── 케이스 분기 ── */}
        <section className="bg-white px-5 py-9">
          <RevealBlock>
            <p className="text-[11px] font-black text-[#0052cc]">케이스별로 안내드립니다</p>
            <h2 className="mt-1 text-[25px] font-black leading-tight">어떤 상황이신가요?</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">
              답에 따라 제안이 완전히 달라집니다. 눌러서 확인해 보십시오.
            </p>
          </RevealBlock>

          <div className="mt-5 flex flex-col gap-2.5">
            {CASES.map((c, idx) => {
              const open = openCase === c.key;
              return (
                <RevealBlock key={c.key} delay={idx * 70}>
                  <div className="overflow-hidden rounded-[20px] bg-[#f6f7fb] shadow-[0_6px_20px_rgba(23,25,31,.05)]">
                    <button type="button" onClick={() => setOpenCase(open ? null : c.key)} aria-expanded={open}
                      className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left">
                      <span>
                        <span className="block text-[15.5px] font-black leading-snug">{c.q}</span>
                        <span className="mt-0.5 block text-[12px] text-[#667085]">{c.who}</span>
                      </span>
                      <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[15px] font-black transition-all duration-300 ${open ? 'rotate-180 bg-[#0052cc] text-white' : 'bg-white text-[#8b93a3]'}`}>
                        {open ? '−' : '+'}
                      </span>
                    </button>
                    <div className={`biz-collapse ${open ? 'is-open' : ''}`}>
                      <div className="overflow-hidden">
                        <div className="border-t border-[#e6e9ef] px-4 pb-4 pt-4">
                          <p className="text-[16px] font-black leading-snug">{c.headline}</p>
                          <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">{c.body}</p>
                          <ul className="mt-3 flex flex-col gap-1.5">
                            {c.points.map(p => (
                              <li key={p} className="flex gap-2 text-[13px] leading-relaxed text-[#3d4455]">
                                <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-[#0052cc]" />
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-4 flex items-center justify-between rounded-[14px] bg-[#eaf2ff] px-4 py-3">
                            <span className="text-[13px] font-black text-[#0052cc]">{c.offer}</span>
                            <span className="text-[12.5px] font-bold">{c.price}</span>
                          </div>
                          <button type="button" onClick={() => pick(c.key)}
                            className="mt-3 w-full rounded-[15px] bg-[#0052cc] px-4 py-3.5 text-[14.5px] font-black text-white transition active:scale-[.98] active:bg-[#003f9e]">
                            이 방식으로 상담받기
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </RevealBlock>
              );
            })}
          </div>
        </section>

        {/* ── 함께 하는 방식 ── */}
        <section className="bg-white px-5 py-9">
          <RevealBlock>
            <p className="text-[11px] font-black text-[#0052cc]">고르시면 됩니다</p>
            <h2 className="mt-1 text-[25px] font-black leading-tight">함께 하는 방식은<br />세 가지입니다</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">
              지금 상황에서 가장 부담 적은 쪽으로 시작하시고, 나중에 옮기셔도 됩니다.
            </p>
          </RevealBlock>

          <div className="relative mt-5 pl-8">
            <div className="biz-flow absolute bottom-5 left-[11px] top-5 w-px bg-[#cfe0ff]" />
            {WAYS.map((w, i) => (
              <RevealBlock key={w.t} delay={i * 100}>
                <div className="relative pb-4">
                  <span className="absolute -left-8 top-3.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#0052cc] text-[11px] font-black text-white">
                    {i + 1}
                  </span>
                  <div className="rounded-[18px] bg-[#f6f7fb] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[14.5px] font-black leading-snug">{w.t}</p>
                      <span className="flex-none rounded-full bg-[#eaf2ff] px-2.5 py-1 text-[11.5px] font-bold text-[#0052cc]">{w.p}</span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#667085]">{w.d}</p>
                  </div>
                </div>
              </RevealBlock>
            ))}
          </div>
        </section>

        {/* ── 자주 묻는 조건 ── */}
        <section className="relative overflow-hidden bg-[#07101f] px-5 py-9 text-white">
          <div className="pointer-events-none absolute -right-16 bottom-8 h-44 w-44 rounded-full bg-[#0052cc]/20" />
          <RevealBlock className="relative z-10">
            <p className="text-[11px] font-black text-[#8fb8ff]">자주 묻는 조건</p>
            <h2 className="mt-1 text-[25px] font-black leading-tight">이런 경우에도<br />방법이 있습니다</h2>
          </RevealBlock>
          <div className="relative z-10 mt-5 flex flex-col gap-2.5">
            {[
              ['스마트스토어를 쓰고 있습니다', '네이버가 외부 편집기 삽입을 막아두고 있어, 고객이 저희 쪽에서 디자인하고 코드를 받아 옵션에 넣는 방식으로 연결해 드립니다.'],
              ['나염이나 자수가 주력입니다', '편집기 자동 계산은 지금 전사(DTF) 기준입니다. 나염·자수는 단가표로 잡아 드리고, 요청이 모이는 순서대로 자동 계산에 넣고 있습니다.'],
              ['디자인 인력이 없습니다', '고객이 직접 올리는 구조라 대부분 해결되지만, 손이 필요한 건은 저희 쪽 작업으로 상담해 드립니다.'],
            ].map(([t, d], i) => (
              <RevealBlock key={t} delay={i * 100}>
                <div className="rounded-[16px] bg-white/[.07] px-4 py-3.5 backdrop-blur">
                  <p className="text-[13.5px] font-black leading-snug">{t}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#a9b6cc]">{d}</p>
                </div>
              </RevealBlock>
            ))}
          </div>
          <RevealBlock delay={120} className="relative z-10">
            <p className="mt-4 rounded-[16px] bg-[#0052cc] px-4 py-3.5 text-[12.5px] font-bold leading-relaxed">
              여기 없는 요청도 남겨주십시오. 같은 요청이 모이면 우선순위로 만듭니다.
              지금 안 되는 것도 수요가 확인되면 만듭니다.
            </p>
          </RevealBlock>
        </section>

        {/* ── 폼 ── */}
        <section ref={formRef} className="scroll-mt-4 bg-white px-5 py-9">
          {done ? (
            <div className="rounded-[22px] bg-[#f6f7fb] px-5 py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#0052cc] text-[26px] text-white">✓</div>
              <p className="mt-4 text-[19px] font-black">접수되었습니다</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">
                남겨주신 연락처로 도입 상담 연락을 드리겠습니다.<br />
                가격 정책과 도입 절차를 함께 안내드립니다.
              </p>
              <a href="tel:01020870621" className="mt-5 inline-block rounded-[15px] bg-[#17191f] px-5 py-3 text-[13.5px] font-black text-white">
                급하시면 바로 통화 010-2087-0621
              </a>
            </div>
          ) : (
            <>
              <RevealBlock>
                <div className="relative">
                  <Bubble className="max-w-[250px]" tail="left" tone="light">
                    두 칸만 채우시면 됩니다.<br />나머지는 통화하면서 여쭤볼게요.
                  </Bubble>
                </div>
                <p className="mt-5 text-[11px] font-black text-[#0052cc]">30초 도입 문의</p>
                <h2 className="mt-1 text-[25px] font-black leading-tight">연락처를 남겨주시면<br />도입 상담 연락을 드립니다</h2>
              </RevealBlock>

              <div className="mt-5 rounded-[18px] bg-[#f6f7fb] p-4">
                <p className="text-[11.5px] font-black text-[#667085]">어떤 업체이신가요?</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CASES.map(c => (
                    <button key={c.key} type="button" onClick={() => setTrack(c.key)}
                      className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold transition ${track === c.key ? 'bg-[#0052cc] text-white' : 'bg-white text-[#667085]'}`}>
                      {c.chip}
                    </button>
                  ))}
                </div>
                {current && <p className="mt-2.5 text-[12px] font-bold leading-relaxed text-[#0052cc]">→ {current.offer} · {current.price}</p>}
              </div>

              <div className="mt-4 flex flex-col gap-2.5">
                <input value={f.contactName} onChange={e => set('contactName', e.target.value)} placeholder="성함" autoComplete="name"
                  className="biz-input w-full rounded-[15px] border border-[#e2e5ec] bg-white px-4 py-3.5 text-[15px] outline-none" />
                <input value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="연락처" inputMode="tel" autoComplete="tel"
                  className="biz-input w-full rounded-[15px] border border-[#e2e5ec] bg-white px-4 py-3.5 text-[15px] outline-none" />
              </div>

              <button type="button" onClick={() => setMore(v => !v)}
                className="mt-3 text-[12.5px] font-bold text-[#0052cc] underline underline-offset-2">
                {more ? '추가 정보 접기' : '더 빨리 준비하도록 정보 더 주기 (선택)'}
              </button>

              <div className={`biz-collapse ${more ? 'is-open' : ''}`}>
                <div className="overflow-hidden">
                  <div className="mt-3 flex flex-col gap-2.5 rounded-[18px] bg-[#f6f7fb] p-4">
                    <input value={f.company} onChange={e => set('company', e.target.value)} placeholder="회사명"
                      className="biz-input w-full rounded-[13px] border border-[#e2e5ec] bg-white px-3.5 py-3 text-[14px] outline-none" />
                    <input value={f.shopUrl} onChange={e => set('shopUrl', e.target.value)} placeholder="쇼핑몰 주소 (주시면 붙여서 보내드립니다)"
                      className="biz-input w-full rounded-[13px] border border-[#e2e5ec] bg-white px-3.5 py-3 text-[14px] outline-none" />
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
                      className="biz-input w-full resize-none rounded-[13px] border border-[#e2e5ec] bg-white px-3.5 py-3 text-[14px] outline-none" />
                  </div>
                </div>
              </div>

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

              <button type="button" onClick={submit} disabled={sending}
                className="mt-4 w-full rounded-[16px] bg-[#0052cc] px-4 py-4 text-[15.5px] font-black text-white transition active:scale-[.99] active:bg-[#003f9e] disabled:opacity-60">
                {sending ? '접수 중…' : '상담 요청하기'}
              </button>
              <p className="mt-2.5 text-center text-[12px] text-[#8b93a3]">
                또는 바로 통화 <a href="tel:01020870621" className="font-bold text-[#0052cc]">010-2087-0621</a>
              </p>
            </>
          )}
        </section>

        <footer className="px-5 pb-2 pt-6 text-[11.5px] leading-relaxed text-[#8b93a3]">
          모두의 유니폼 (피스코프) · 대표 김현준<br />
          modoo.contact@gmail.com · modoouniform.com<br />
          K-PRINT 2026 킨텍스 제2전시장 부스 M304 · 8월 19일~22일
        </footer>
      </main>

      <style jsx global>{`
        .biz-page { letter-spacing: 0; word-break: keep-all; overflow-wrap: break-word; }
        .biz-reveal { opacity: 0; transform: translateY(22px);
          transition: opacity 620ms ease, transform 620ms ease; will-change: opacity, transform; }
        .biz-reveal.is-visible { opacity: 1; transform: translateY(0); }
        .biz-float { animation: biz-float 3.8s ease-in-out infinite; }
        @keyframes biz-float {
          0%, 100% { transform: translate3d(0,0,0) rotate(-1deg); }
          50% { transform: translate3d(0,-7px,0) rotate(1deg); }
        }
        .biz-flow { transform-origin: top; animation: biz-draw 1.2s ease-out both;
          animation-timeline: view(); animation-range: entry 10% cover 55%; }
        @keyframes biz-draw { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        .biz-collapse { display: grid; grid-template-rows: 0fr;
          transition: grid-template-rows 340ms cubic-bezier(.4,0,.2,1); }
        .biz-collapse.is-open { grid-template-rows: 1fr; }
        .biz-zoom { opacity: 0; transform: scale(.82) translateY(14px);
          transition: opacity 700ms cubic-bezier(.2,.7,.3,1) 220ms, transform 700ms cubic-bezier(.2,.7,.3,1) 220ms; }
        .biz-zoom.is-visible { opacity: 1; transform: scale(1) translateY(0); }
        .biz-input:focus { border-color: #0052cc; box-shadow: 0 0 0 4px rgba(0,82,204,.1); }
        @media (prefers-reduced-motion: reduce) {
          .biz-reveal, .biz-reveal.is-visible, .biz-float, .biz-flow, .biz-zoom, .biz-zoom.is-visible {
            animation: none; opacity: 1; transform: none; transition: none;
          }
          .biz-collapse { transition: none; }
        }
      `}</style>
    </div>
  );
}

/* ── 스크롤 진입 시 나타나는 블록 ── */
function RevealBlock({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVisible(true); return; }
    const ob = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); ob.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });
    ob.observe(node);
    return () => ob.disconnect();
  }, []);
  return (
    <div ref={ref} className={`biz-reveal ${visible ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ── 말풍선 ── */
function Bubble({ children, className = '', tail = 'left', tone = 'white' }: {
  children: ReactNode; className?: string; tail?: 'left' | 'right'; tone?: 'white' | 'light';
}) {
  const bg = tone === 'light' ? 'bg-[#eaf2ff]' : 'bg-white';
  return (
    <div className={`relative rounded-[18px] ${bg} px-4 py-3 text-[#17191f] shadow-[0_12px_28px_rgba(0,0,0,.16)] ${className}`}>
      <p className="text-[12.5px] font-black leading-snug">{children}</p>
      <span className={`absolute -bottom-2 ${tail === 'left' ? 'left-8' : 'right-8'} h-4 w-4 rotate-45 ${bg}`} />
    </div>
  );
}

/* ── 화면 + 확대 인셋 ── */
function ZoomShot({ shot, zoom, alt, caption, badge }: {
  shot: string; zoom: string; alt: string; caption: string; badge: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVisible(true); return; }
    const ob = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); ob.disconnect(); }
    }, { threshold: 0.25 });
    ob.observe(node);
    return () => ob.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative mt-5">
      <div className={`biz-reveal ${visible ? 'is-visible' : ''} overflow-hidden rounded-[18px] border border-[#e4e7ee] bg-white`}>
        <img src={shot} alt={alt} className="w-full" loading="lazy" />
      </div>
      <div className={`biz-zoom ${visible ? 'is-visible' : ''} relative -mt-8 ml-4 mr-1 origin-bottom-left`}>
        <div className="overflow-hidden rounded-[16px] border-2 border-[#0052cc] bg-white shadow-[0_18px_40px_rgba(0,82,204,.22)]">
          <div className="flex items-center gap-1.5 bg-[#0052cc] px-3 py-1.5">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/25 text-[9px] font-black text-white">＋</span>
            <span className="text-[11px] font-black text-white">{badge} 확대</span>
          </div>
          <img src={zoom} alt="" className="w-full" loading="lazy" />
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-[#8b93a3]">{caption}</p>
    </div>
  );
}
