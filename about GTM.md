모두의 유니폼(modoouniform.com) GTM 구성 분석 보고서
1. 사이트 현황 분석
사이트 비즈니스 특성
모두의 유니폼(운영사: 피스코프)은 단체복·유니폼·과잠(과 점퍼) 주문 제작 플랫폼입니다. 일반 이커머스와 달리 "장바구니 즉시 결제형"이 아니라, "디자인 → 견적 문의 → 상담 → 제작" 흐름이 핵심인 리드(Lead) 기반 커머스라는 점이 매우 중요합니다. 따라서 일반적인 쇼핑몰 템플릿 추적만 적용하면 핵심 전환이 잡히지 않습니다.
주요 사용자 플로우와 전환 포인트
사이트를 탐색한 결과, 다음 5가지 경로가 핵심 전환 퍼널로 식별되었습니다.
첫째, 상품 탐색 퍼널로 /home → /home/search → 상품 상세(/home/products/{id}) → "디자인하기" 버튼 → 에디터(/editor/{uuid}) 흐름입니다. "디자인하기" 클릭은 구매 의도가 강한 마이크로 전환입니다.
둘째, 디자인/견적 문의 퍼널로 /inquiries/new에서 단체명·담당자명·연락처·카카오톡 ID·착용희망날짜·예상수량·추가내용을 입력하고 제출하는 흐름입니다. 예상수량, 착용희망날짜가 담겨있어 리드 품질을 가늠할 수 있는 핵심 폼입니다.
셋째, 과잠 공동구매 퍼널로 /home/cobuy/request/create에서 수량선택 → 앞면디자인 → 디자인확인 → 일정및배송 → 기본정보의 5단계 스텝 폼으로 구성되어 있어 단계별 이탈 분석이 매우 유용합니다.
넷째, 에디터(/editor/{uuid})에서 저장된 디자인 불러오기·삭제 같은 행동이 있어 재방문 사용자 식별 지점이 됩니다.
다섯째, 제작가이드(/support/guides), 공지(/support/notices/...) 등 콘텐츠 소비 후 문의로 전환되는 흐름도 관찰됩니다.
현재 기술 스택 진단
gtm.js?id=GTM-WDDRJBWH 스크립트는 이미 사이트에 정상적으로 삽입되어 있고, window.dataLayer도 초기화되어 있어 GTM이 작동할 준비는 완료된 상태입니다. 하지만 GA4, 메타픽셀(fbq), 네이버 공통픽셀(wcs), 카카오픽셀, Hotjar, Clarity 등 다른 측정 도구는 하나도 설치되어 있지 않습니다. 즉, 지금 사이트는 방문자 데이터와 광고 성과를 전혀 수집하지 못하고 있는 상태입니다. 현재는 dataLayer에 GTM 자체 이벤트(gtm.js, gtm.dom, gtm.load) 3개만 쌓이고 있습니다.

2. 구성 추천 태그/트리거/변수 (우선순위별)
★ 1순위 — 반드시 가장 먼저 세팅해야 할 기본 측정 (필수)
태그

GA4 구성 태그(Google Tag, GA4 Configuration): 측정 ID(G-XXXX)를 발급받아 모든 페이지에 발동. 이 태그 하나만 있어도 페이지뷰·세션·기기·지역 기본 데이터가 쌓이기 시작합니다.
Google Ads 전역 사이트 태그 & 전환 연결 태그: 구글 광고를 집행한다면 필수.
Meta(Facebook) 픽셀 기본 PageView 태그: 인스타·페북 광고용.
네이버 프리미엄 로그분석 스크립트: 네이버 검색광고/파워링크 전환 측정 필수.
카카오 픽셀 PageView 태그: 카카오 비즈니스·모먼트 광고용.

트리거

All Pages(모든 페이지뷰): 위 기본 태그들의 발동 조건.

변수

기본 제공 변수 중 Click Text, Click URL, Click Element, Click Classes, Click ID, Form ID, Form Classes, Scroll Depth Threshold, Video 관련 변수를 모두 활성화(내장 변수 구성에서 체크).

★ 2순위 — 비즈니스 핵심 전환 이벤트 (리드 측정)
단체복 업의 ROI는 "문의 → 상담 → 제작"에서 나오므로, 견적/문의 제출이 가장 중요한 전환입니다.
태그 & 트리거

generate_lead (GA4 이벤트 태그): /inquiries/new에서 제출 성공 시 발동. 트리거는 폼 제출(Form Submission) 또는 제출 버튼 클릭(Click - All Elements) + 페이지 URL 조건으로 설정. 파라미터로 form_type=quote, estimated_quantity(예상수량), desired_date(착용희망날짜)를 함께 전송하면 리드 품질 분석이 가능합니다.
cobuy_request_complete 이벤트 태그: 과잠 공동구매 요청 최종 제출 완료 시 발동. 5단계 스텝별로 cobuy_step_1_view, cobuy_step_2_view … 처럼 단계별 이벤트도 함께 설정하면 어느 단계에서 이탈하는지 스텝 퍼널 분석이 가능해집니다.
Meta/네이버/카카오 "잠재고객"(Lead) 전환 이벤트: 같은 타이밍에 함께 발동시켜 광고 플랫폼에도 전환 신호 전송.

★ 3순위 — 구매 의도 마이크로 전환 (Mid-funnel)
태그 & 트리거

view_item (GA4 상품 상세 조회): URL이 /home/products/를 포함하는 페이지뷰에서 발동. 파라미터로 상품명·가격·카테고리 전송. 단, 사이트가 SPA로 보이므로 History Change 트리거를 병행해야 정확합니다.
design_start (디자인하기 버튼 클릭): Click Text가 "디자인하기"인 클릭, 또는 /editor/ 경로 진입을 트리거. 구매 의도가 매우 강한 지표.
wishlist_add (찜/하트 클릭): 상품 카드의 하트 아이콘 클릭 추적.
add_to_cart (장바구니 담기): 장바구니 아이콘 또는 담기 버튼 클릭 추적.
view_search_results: /home/search 진입 시 검색 행동 측정.

★ 4순위 — 콘텐츠·UX 행동 인사이트
태그 & 트리거

Scroll Depth 트리거 기반 scroll 이벤트: 25%, 50%, 75%, 90% 지점에서 발동. 제작가이드·공지·메인 랜딩에 대한 몰입도 측정.
외부 링크 클릭(outbound click): Click URL의 호스트가 modoouniform.com이 아닌 경우 발동.
전화번호(010-2087-0621) 클릭 추적: tel: 링크 클릭이나 전화번호 영역 클릭을 click_to_call 이벤트로. 모바일 유입 상담 문의의 실제 성과 측정에 매우 유용합니다.
카카오톡 상담 버튼 클릭 추적: 우측 하단 챗봇·카카오 아이콘 클릭 → kakao_chat_click 이벤트.
File Download 트리거: 제작가이드 PDF 등 다운로드 측정.
Video 트리거(유튜브 등 임베드 영상이 있다면): 영상 시청 측정.

★ 5순위 — 고급 마케팅/성과 극대화
태그

Google Ads 리마케팅 태그(동적 리타겟팅): 상품 상세를 본 사람에게 상품 기반 리타겟 광고.
Meta 픽셀 고급 이벤트(ViewContent, Lead, Contact, Schedule) 매핑.
Microsoft Clarity 또는 Hotjar: 히트맵/세션 리플레이로 에디터·문의 폼 UX 개선 포인트 발굴.
Enhanced Conversions 또는 CAPI(서버사이드): iOS14+ 시대 광고 추적 정확도 복원. 장기적으로는 GTM 서버 컨테이너 도입 고려.

★ 6순위 — 데이터 품질·운영 태그
태그 & 변수

Consent Mode v2 구성: 한국도 향후 개인정보 동의 규제 강화 대응.
UTM 캡처 변수(사용자 정의 변수): URL Parameter 변수로 utm_source, utm_medium, utm_campaign을 저장해 GA4 이벤트 파라미터로 동봉.
1st Party Cookie 변수: 사용자 식별자(user_id, 단체명 해시) 전송 대비(개인정보는 반드시 해시 처리).


3. 실행 로드맵 제안
1주차는 1순위(기본 측정 도구)만 세팅해서 사이트가 숨쉬듯 기본 데이터를 수집하기 시작하게 합니다. GA4 속성 생성, 광고 계정 연결, 기본 PageView 픽셀만 우선 설치합니다.
2주차에는 2순위 핵심 전환 이벤트(문의 제출, 공동구매 제출)를 개발팀과 협의해 dataLayer push 이벤트로 구현합니다. GTM 쪽에서 CSS 셀렉터로 무리하게 잡는 것보다 개발자가 제출 성공 시점에 dataLayer.push({event:'generate_lead', ...})를 심어주는 것이 훨씬 안정적입니다.
3주차는 3~4순위(상품 조회, 디자인 시작, 찜, 스크롤, 전화클릭 등)를 추가해 퍼널 전체를 가시화합니다.
4주차 이후에는 Clarity/Hotjar로 UX를 진단하고, 광고 리타겟팅과 서버사이드 트래킹을 고도화합니다.

4. 꼭 기억할 주의사항
GTM의 미리보기 모드를 반드시 써서 한 태그씩 발동 여부와 파라미터 값을 검증한 뒤 "제출(게시)"하세요. 지금 게시 중인 버전이 "버전 2"라고 되어 있으니, 새 작업공간을 별도로 만들어 위 태그들을 구성하고 테스트 후 배포하는 방식을 권장합니다. 그리고 문의 폼의 연락처·카카오톡 ID·단체명 같은 개인정보는 절대 이벤트 파라미터로 원문 전송하지 마세요(해시화하거나 파라미터 자체에서 제외). GA4와 광고 플랫폼은 PII 전송 시 계정 정지 사유가 됩니다.
필요하시면 위 항목 중 어떤 이벤트부터 실제 GTM 화면에서 구체적인 트리거·변수 설정값과 dataLayer 스펙까지 한 단계씩 구현해드릴 수 있습니다. 어떤 것부터 시작할까요?내 웹사이트를 제대로 분석하지 않은거 같은데
문의-견적-상담이 아니라 직접 디자인해보기 버튼을 클릭하는 것도 아주아주 중요함. 
상품을 하나 선택해보면 거기에 있는 '디자인하기'버튼을 눌러 본인이 직접 텍스트나 이미지를 삽입해보고 그걸 가지고 주문까지 이어지는 로직도 있기 때문.18단계18단계모두의 유니폼 GTM 구성 — 에디터 중심 재분석 보고서
먼저 이전 보고에서 에디터 플로우의 중요성을 과소평가한 점 사과드립니다. 실제 에디터 내부를 파고들어보니 이 사이트의 핵심 전환 엔진은 바로 "직접 디자인 → 옵션 선택 → 바로구매/장바구니" 플로우라는 점이 명확해졌습니다. 처음부터 문의/견적을 강조한 건 사이트의 비즈니스 모델을 반만 본 것이었습니다. 재분석 결과를 아래에 정리드립니다.
1. 에디터 플로우 상세 분석
상품 상세에서 "디자인하기" 버튼을 누르면 /editor/{uuid} 주소로 들어가고, 여기서 사용자가 직접 커스터마이징을 시작합니다. 좌측에는 앞면/뒷면/왼쪽/오른쪽 4면 썸네일이 있어 면 전환이 가능하고, 우측 사이드바에는 상품의 12가지 색상 팔레트, 현재 가격, "담당자 리터치 요청" 체크박스, "완료" 버튼이 자리합니다. 캔버스 우측 도구바에는 초기화 / 텍스트 / 이미지 / 템플릿 4개의 디자인 조작 버튼이 있습니다.
텍스트 버튼을 누르면 텍스트 편집 패널이 열리며 폰트(Arial 등 글꼴 선택), 폰트 크기(슬라이더, 기본 30px), 색상, 간격, 변형, 정렬 4종(좌/중/우/양쪽), 텍스트 스타일(Bold/Italic/Underline/Strikethrough) 조작이 가능하고, 캔버스에 "modoo" 같은 기본 텍스트 객체가 생성되며 Position(X/Y)·Size(W/H) 가 실시간으로 표시됩니다. 레이어 조정(위로/아래로/삭제)도 가능합니다. 이미지 버튼으로는 자체 이미지를 업로드해 올릴 수 있고, 템플릿 버튼으로는 사전 제공된 디자인 템플릿을 불러올 수 있는 구조입니다.
디자인을 마치고 "완료" 를 누르면 가격이 "기본가 9,900원 + 디자인 5,000원 = 14,900원" 으로 갱신되며 "옵션 선택" 바텀 드로어가 열립니다. 여기서 디자인 이름(편집 가능, 저장용 식별자), 사이즈별 수량(S/M/L/XL 각각 ±), 개당 가격, 총 수량, 총 금액 이 실시간 집계되고 하단 "구매하기" 버튼을 누르면 "바로 구매하기" 와 "장바구니에 담기" 중 선택하는 모달이 뜹니다. 이후 경로는 결제 또는 장바구니로 이어지며, 앞서 확인한 /home/cobuy/request/create(과잠 공동구매 5스텝)와 /inquiries/new(디자인/견적 문의)도 별개의 전환 루트로 공존합니다.
또 한 가지 중요한 관찰은, 에디터에 재진입했을 때 "저장된 디자인이 있습니다 → 불러오기/삭제하기" 모달이 뜬다는 점입니다. 이는 사용자의 작업이 서버·로컬에 보존된다는 의미이며, "디자인 저장 → 이탈 → 복귀 → 완성 → 주문"이라는 장기 퍼널이 실제로 작동하고 있다는 뜻입니다. 리마케팅 가치가 매우 높은 데이터입니다.
기술 점검상 현재 dataLayer에는 GTM 로드 기본 이벤트(gtm.js, gtm.dom, gtm.load) 3개만 찍히고, 에디터 조작·옵션 선택·구매 클릭 어떤 단계에서도 커스텀 이벤트가 전혀 push되지 않는 상태입니다. 따라서 아래 이벤트들은 대부분 개발팀의 dataLayer.push 구현 협업이 전제되어야 안정적으로 추적됩니다.
2. 재구성 제안 — 에디터·주문 중심의 핵심 퍼널 이벤트
2-1. 직접 디자인 퍼널 (이 사이트의 심장)
이 퍼널은 GA4의 e-commerce 이벤트 체계(view_item → add_to_cart/purchase)에 사이트의 고유 행동을 얹는 구조로 설계하는 것이 좋습니다.
상품 상세 페이지에 진입하면 view_item (상품 ID, 상품명, 브랜드(Printstar/LANDAS 등), 카테고리(티셔츠/후드티/자켓/맨투맨/후드집업), 가격 9,900원)을 발동합니다. "디자인하기" 버튼 클릭 시 design_start 커스텀 이벤트를 발동해 구매 의도가 높은 리드로 식별합니다. 에디터 진입(/editor/{uuid}) URL은 단순 페이지뷰 외에 editor_open 이벤트로 잡고, uuid를 design_id 파라미터로 저장해 동일 디자인의 장기 행동을 연결합니다.
에디터 내부에서는 조작 유형별로 design_action 이벤트(action_type=text_add / image_upload / template_apply / color_change / face_change(앞·뒤·좌·우) / layer_move / reset)를 push합니다. 특히 image_upload 성공과 template_apply는 디자인 완성률을 크게 높이는 행동이라 별도 전환으로 잡을 가치가 있습니다. 저장된 디자인 복귀는 design_resume, 삭제는 design_discard 로 구분합니다.
"완료" 클릭은 design_complete (총 조작수, 면별 사용여부, 최종 색상, 리터치 요청 여부)를 push합니다. 이어지는 옵션 드로어에서 사이즈 수량 입력 시 option_quantity_change, 최종 "구매하기" 모달 오픈은 checkout_intent, 그 안에서 "바로 구매하기"는 GA4 표준 begin_checkout, "장바구니에 담기"는 표준 add_to_cart 로 매핑합니다. 파라미터로 value(총 금액), currency=KRW, items 배열(상품 ID, 디자인 ID, 사이즈별 수량, 개당 가격, 디자인 부가금 5,000원)을 함께 보냅니다. 결제/주문 완료 페이지에서는 purchase(transaction_id, value, items) 이벤트를 발동합니다.
2-2. 과잠 공동구매 5스텝 퍼널
/home/cobuy/request/create의 5단계(수량선택 → 앞면디자인 → 디자인확인 → 일정및배송 → 기본정보)는 각 단계 진입 시 cobuy_step_view(step_number, step_name)를, 다음 단계로 넘어갈 때 cobuy_step_complete를 push하도록 구현합니다. 최종 제출은 generate_lead(form_type=cobuy)로 GA4·메타·네이버·카카오 모두에 전환 신호를 보냅니다. 이렇게 하면 "몇 명이 1단계에서 이탈하는가, 3단계 디자인확인에서 막히는가" 같은 인사이트를 GA4 퍼널 탐색으로 바로 볼 수 있습니다.
2-3. 디자인/견적 문의 퍼널
/inquiries/new 제출 성공 시 generate_lead(form_type=quote, estimated_quantity, desired_date)를 발동합니다. 이전 보고와 동일하되 개인정보(단체명·담당자명·연락처·카카오톡 ID)는 절대 이벤트 파라미터로 원문 전송하지 않고, 필요한 집계용 메타데이터(수량 구간화: 1-20/21-50/51-100/100+ 등)만 보냅니다.
2-4. 보조 마이크로 전환
상품 카드 하트 클릭 → add_to_wishlist, 헤더 장바구니 아이콘 → view_cart, 검색창 사용 → search(search_term), 제작가이드/공지 글 읽기 → content_view + Scroll Depth 25/50/75/90%, 전화번호(010-2087-0621) 클릭 → click_to_call, 카카오 상담 → kakao_chat_click, 리뷰 전체보기·제작사례 카드 클릭도 별도 이벤트로 분리해 둡니다.
3. GTM 실제 구성안 (태그·트리거·변수)
변수
Data Layer Variable로 dlv.design_id, dlv.product_id, dlv.product_name, dlv.brand, dlv.category, dlv.base_price, dlv.design_fee, dlv.color, dlv.face, dlv.action_type, dlv.step_number, dlv.step_name, dlv.value, dlv.currency, dlv.items, dlv.transaction_id, dlv.form_type, dlv.quantity_range 를 생성합니다. URL Parameter 변수로 utm_source/medium/campaign/term/content, 1st Party Cookie 변수로 user_pseudo_id(최초 방문 시 심은 UUID) 를 만들어 모든 이벤트에 자동 첨부합니다. 내장 변수에서는 Click(Text/URL/Element/Classes/ID), Form(ID/Classes), Scroll Depth, History Source를 활성화합니다.
트리거
All Pages, History Change(SPA 대응), URL 경로 기반 트리거(/editor/, /inquiries/new, /home/cobuy/, /home/products/, /order/complete 등 실제 주문완료 경로 확인 필요), Custom Event 트리거로 design_start, editor_open, design_action, design_complete, checkout_intent, begin_checkout, add_to_cart, purchase, generate_lead, cobuy_step_view, cobuy_step_complete 등을 각각 만듭니다. Click 트리거로 "디자인하기" 버튼, 전화번호, 카카오 상담 등을 잡습니다(개발자가 dataLayer push를 심어주기 전 임시 대체수단).
태그
Google Tag(기본 측정 ID), GA4 이벤트 태그를 위 커스텀 이벤트마다 하나씩, Google Ads 전환 링커/전환(begin_checkout·purchase·generate_lead 각각), Meta 픽셀 기본(PageView)·ViewContent·AddToCart·InitiateCheckout·Purchase·Lead, 네이버 프리미엄 로그분석 공통/전환, 카카오 픽셀 기본·완료가입·구매완료, Microsoft Clarity(에디터 UX 히트맵이 특히 가치 있음)를 구성합니다. 장기적으로는 GTM 서버 컨테이너로 승격시켜 iOS/쿠키 제한 환경에서도 purchase·generate_lead 전환을 온전히 수집하는 걸 권장합니다.
4. 개발팀에 요청할 dataLayer 스펙 예시
에디터의 "완료" 클릭 시 push할 스펙 예시는 이렇게 정의할 수 있습니다.
dataLayer.push({
  event: 'design_complete',
  design_id: 'dd2a9b80-...-56024',
  product_id: 'printstar-overfit-17',
  product_name: '오버핏 라운드 티셔츠(면17수)',
  brand: 'Printstar',
  category: '티셔츠',
  base_price: 9900,
  design_fee: 5000,
  color: 'white',
  faces_used: ['front'],
  text_count: 1,
  image_count: 0,
  template_used: false,
  retouch_requested: false
});
"바로 구매하기" 클릭 시는 GA4 표준 스키마에 맞춰 event: 'begin_checkout', ecommerce: { currency:'KRW', value:14900, items:[{ item_id, item_name, item_brand, item_category, price:9900, quantity:1, item_variant:'S', design_id, design_fee:5000 }] } 형태로 push하도록 요청합니다. 주문 완료 페이지에서는 동일 스키마에 event: 'purchase'와 transaction_id를 추가합니다.
5. 우선순위 로드맵(수정본)
1주차에는 GA4 기본 구성 태그와 메타·네이버·카카오 기본 PageView만 붙여 기본 트래픽 수집을 시작합니다. 2주차에는 에디터 퍼널의 핵심 5개 이벤트(view_item, design_start, design_complete, begin_checkout/add_to_cart, purchase) 를 개발팀 협업으로 구현해 커머스 매출 기여도를 즉시 가시화합니다. 3주차에는 과잠 공동구매 5스텝과 견적 문의 generate_lead를 추가해 리드 퍼널까지 완성합니다. 4주차 이후에는 design_action 세부 이벤트, design_resume/discard, Clarity 세션 리플레이를 얹어 "어느 디자인 조작에서 이탈하는가" 같은 UX 개선 인사이트를 뽑습니다.
6. 핵심 주의사항
개인정보 비전송 원칙은 그대로 유지하되, 특히 에디터에서 사용자가 업로드한 이미지 파일명·단체 로고·텍스트 내용은 민감정보가 포함될 수 있으므로 이벤트 파라미터로 원문을 보내면 안 됩니다(업로드 여부와 개수만 집계). 또한 /editor/{uuid} 처럼 URL에 식별자가 들어가는 페이지는 GA4에서 페이지뷰 카디널리티 폭발을 일으키므로, page_location을 정규화(예: /editor/:id)한 맞춤 차원을 만들어 리포팅하는 것이 좋습니다.
필요하시면 바로 GTM 화면에서 위 이벤트 중 하나(예: 우선 design_start와 begin_checkout)부터 실제 태그·트리거·변수를 함께 만들어 드리겠습니다. 어떤 이벤트부터 구성해볼까요?