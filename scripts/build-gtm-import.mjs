#!/usr/bin/env node
/**
 * GTM 컨테이너 임포트 JSON 생성기.
 *
 * 출력: ../gtm-modoo-app-import.json
 *
 * 산출물에는 다음이 포함된다:
 *   - 빌트인 변수(자주 쓰는 클릭/폼/스크롤/히스토리) 활성화
 *   - lib/gtm-events.ts 에서 푸시되는 모든 매개변수 키에 대한 Data Layer Variable
 *   - 각 커스텀 이벤트마다 Custom Event 트리거 1개
 *   - 각 커스텀 이벤트를 GA4 이벤트(G-5PCV010T7K)로 보내는 GA4 Event 태그 1개
 *
 * Google Tag(GA4 Configuration) 는 의도적으로 포함하지 않는다.
 *   이유: 현재 layout.tsx 가 NEXT_PUBLIC_GA_ID 로 gtag.js 를 직접 로드 중이라,
 *   여기서 Google Tag 를 게시하면 page_view 가 이중 집계된다.
 *   본 컨테이너 게시 직후 Vercel 의 NEXT_PUBLIC_GA_ID 환경변수를 제거 + 재배포해서
 *   gtag.js 직접 로드를 끄고, 모든 측정을 GTM 단일 경로로 일원화하는 것이 권장 흐름이다.
 *   page_view 는 spa_page_view 트리거가 GA4 page_view 이벤트로 모두 커버한다.
 *
 * 광고 픽셀(Meta/네이버/카카오) 도 포함하지 않는다.
 *   이유: 각 픽셀 ID 가 별도로 필요. 이번 임포트는 GA4 한정.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const MEASUREMENT_ID = 'G-5PCV010T7K';
const CONTAINER_PUBLIC_ID = 'GTM-WDDRJBWH';

// ─── 빌더 헬퍼 ───────────────────────────────────────────────────────────────

let _varSeq = 100;
let _trgSeq = 200;
let _tagSeq = 300;

const variables = [];
const triggers = [];
const tags = [];

const varRefByName = {}; // name -> {{name}}

function dlv(key) {
  const id = String(_varSeq++);
  const name = `DLV - ${key}`;
  variables.push({
    accountId: '0',
    containerId: '0',
    variableId: id,
    name,
    type: 'v',
    parameter: [
      { type: 'TEMPLATE', key: 'name', value: key },
      { type: 'INTEGER', key: 'dataLayerVersion', value: '2' },
      { type: 'BOOLEAN', key: 'setDefaultValue', value: 'false' },
    ],
    fingerprint: '0',
    formatValue: {},
  });
  varRefByName[name] = `{{${name}}}`;
  return `{{${name}}}`;
}

function customEventTrigger(eventName) {
  const id = String(_trgSeq++);
  triggers.push({
    accountId: '0',
    containerId: '0',
    triggerId: id,
    name: `CE - ${eventName}`,
    type: 'CUSTOM_EVENT',
    customEventFilter: [
      {
        type: 'EQUALS',
        parameter: [
          { type: 'TEMPLATE', key: 'arg0', value: '{{_event}}' },
          { type: 'TEMPLATE', key: 'arg1', value: eventName },
        ],
      },
    ],
    fingerprint: '0',
  });
  return id;
}

/**
 * GA4 이벤트 태그 1개를 생성한다.
 *
 * @param {Object} opts
 * @param {string} opts.tagName        태그 이름
 * @param {string} opts.ga4EventName   GA4 로 보낼 event_name
 * @param {string} opts.triggerId      발화 트리거 ID
 * @param {Array<[string, string]>} [opts.params]  [paramName, valueRef][]
 * @param {boolean} [opts.sendEcommerce]  전자상거래 데이터 전송 (DL 자동 추출)
 * @param {Array<[string, string]>} [opts.userProps]  user property 매핑
 */
function ga4EventTag({
  tagName,
  ga4EventName,
  triggerId,
  params = [],
  sendEcommerce = false,
  userProps = [],
}) {
  const id = String(_tagSeq++);

  const parameter = [
    { type: 'TEMPLATE', key: 'measurementIdOverride', value: MEASUREMENT_ID },
    { type: 'TEMPLATE', key: 'eventName', value: ga4EventName },
  ];

  if (params.length > 0) {
    parameter.push({
      type: 'LIST',
      key: 'eventParameters',
      list: params.map(([name, value]) => ({
        type: 'MAP',
        map: [
          { type: 'TEMPLATE', key: 'name', value: name },
          { type: 'TEMPLATE', key: 'value', value },
        ],
      })),
    });
  }

  if (userProps.length > 0) {
    parameter.push({
      type: 'LIST',
      key: 'userProperties',
      list: userProps.map(([name, value]) => ({
        type: 'MAP',
        map: [
          { type: 'TEMPLATE', key: 'name', value: name },
          { type: 'TEMPLATE', key: 'value', value },
        ],
      })),
    });
  }

  if (sendEcommerce) {
    parameter.push({
      type: 'BOOLEAN',
      key: 'sendEcommerceData',
      value: 'true',
    });
    parameter.push({
      type: 'TEMPLATE',
      key: 'getEcommerceDataFrom',
      value: 'dataLayer',
    });
  }

  tags.push({
    accountId: '0',
    containerId: '0',
    tagId: id,
    name: tagName,
    type: 'gaawe',
    parameter,
    firingTriggerId: [triggerId],
    tagFiringOption: 'ONCE_PER_EVENT',
    monitoringMetadata: { type: 'MAP' },
    fingerprint: '0',
  });
  return id;
}

// ─── DLV 정의 ────────────────────────────────────────────────────────────────

const V_PRODUCT_ID = dlv('product_id');
const V_PRODUCT_NAME = dlv('product_name');
const V_BRAND = dlv('brand');
const V_CATEGORY = dlv('category');
const V_BASE_PRICE = dlv('base_price');
const V_DESIGN_FEE = dlv('design_fee');
const V_DESIGN_ID = dlv('design_id');
const V_COLOR = dlv('color');
const V_ACTION_TYPE = dlv('action_type');
const V_SIDE_ID = dlv('side_id');
const V_FACE = dlv('face');
const V_FACES_USED = dlv('faces_used');
const V_TEXT_COUNT = dlv('text_count');
const V_IMAGE_COUNT = dlv('image_count');
const V_TEMPLATE_USED = dlv('template_used');
const V_RETOUCH_REQUESTED = dlv('retouch_requested');
const V_STEP_NUMBER = dlv('step_number');
const V_STEP_NAME = dlv('step_name');
const V_CHOICE = dlv('choice');
const V_FORM_TYPE = dlv('form_type');
const V_QUANTITY_RANGE = dlv('quantity_range');
const V_DESIRED_DATE = dlv('desired_date');
const V_PRODUCT_COUNT = dlv('product_count');
const V_VALUE = dlv('value');
const V_CURRENCY = dlv('currency');
const V_SEARCH_TERM = dlv('search_term');
const V_RESULTS_COUNT = dlv('results_count');
const V_CONTENT_ID = dlv('content_id');
const V_CONTENT_TYPE = dlv('content_type');
const V_CONTENT_CATEGORY = dlv('content_category');
const V_SOURCE = dlv('source');
const V_PHONE = dlv('phone');
const V_WISHLIST_ACTION = dlv('wishlist_action');
const V_SIZE = dlv('size');
const V_QUANTITY = dlv('quantity');
const V_TOTAL_QUANTITY = dlv('total_quantity');
const V_USER_PSEUDO_ID = dlv('user_pseudo_id');
const V_UTM_SOURCE = dlv('utm_source');
const V_UTM_MEDIUM = dlv('utm_medium');
const V_UTM_CAMPAIGN = dlv('utm_campaign');
const V_UTM_TERM = dlv('utm_term');
const V_UTM_CONTENT = dlv('utm_content');
const V_PAGE_LOCATION = dlv('page_location');
const V_PAGE_PATH = dlv('page_path');
const V_PAGE_PATH_NORMALIZED = dlv('page_path_normalized');
const V_PAGE_TITLE = dlv('page_title');
const V_REASON = dlv('reason');
const V_TRANSACTION_ID = dlv('ecommerce.transaction_id');

// ─── 트리거 + GA4 이벤트 태그 ─────────────────────────────────────────────────

// 1. 인프라
{
  const t = customEventTrigger('spa_page_view');
  ga4EventTag({
    tagName: 'GA4 - page_view (SPA)',
    ga4EventName: 'page_view',
    triggerId: t,
    params: [
      ['page_location', V_PAGE_LOCATION],
      ['page_path', V_PAGE_PATH],
      ['page_path_normalized', V_PAGE_PATH_NORMALIZED],
      ['page_title', V_PAGE_TITLE],
    ],
  });
}

{
  const t = customEventTrigger('set_user_properties');
  ga4EventTag({
    tagName: 'GA4 - set_user_properties',
    ga4EventName: 'set_user_properties',
    triggerId: t,
    userProps: [
      ['user_pseudo_id', V_USER_PSEUDO_ID],
      ['utm_source', V_UTM_SOURCE],
      ['utm_medium', V_UTM_MEDIUM],
      ['utm_campaign', V_UTM_CAMPAIGN],
      ['utm_term', V_UTM_TERM],
      ['utm_content', V_UTM_CONTENT],
    ],
  });
}

// 2. 상품/탐색 (이커머스)
{
  const t = customEventTrigger('view_item');
  ga4EventTag({
    tagName: 'GA4 - view_item',
    ga4EventName: 'view_item',
    triggerId: t,
    sendEcommerce: true,
  });
}

{
  const t = customEventTrigger('view_item_list');
  ga4EventTag({
    tagName: 'GA4 - view_item_list',
    ga4EventName: 'view_item_list',
    triggerId: t,
    sendEcommerce: true,
  });
}

{
  const t = customEventTrigger('select_item');
  ga4EventTag({
    tagName: 'GA4 - select_item',
    ga4EventName: 'select_item',
    triggerId: t,
    sendEcommerce: true,
  });
}

{
  const t = customEventTrigger('add_to_wishlist');
  ga4EventTag({
    tagName: 'GA4 - add_to_wishlist',
    ga4EventName: 'add_to_wishlist',
    triggerId: t,
    params: [['wishlist_action', V_WISHLIST_ACTION]],
    sendEcommerce: true,
  });
}

// 3. 에디터 퍼널
{
  const t = customEventTrigger('design_start');
  ga4EventTag({
    tagName: 'GA4 - design_start',
    ga4EventName: 'design_start',
    triggerId: t,
    params: [
      ['product_id', V_PRODUCT_ID],
      ['product_name', V_PRODUCT_NAME],
      ['brand', V_BRAND],
      ['category', V_CATEGORY],
    ],
  });
}

{
  const t = customEventTrigger('editor_open');
  ga4EventTag({
    tagName: 'GA4 - editor_open',
    ga4EventName: 'editor_open',
    triggerId: t,
    params: [
      ['product_id', V_PRODUCT_ID],
      ['design_id', V_DESIGN_ID],
    ],
  });
}

{
  const t = customEventTrigger('design_action');
  ga4EventTag({
    tagName: 'GA4 - design_action',
    ga4EventName: 'design_action',
    triggerId: t,
    params: [
      ['action_type', V_ACTION_TYPE],
      ['product_id', V_PRODUCT_ID],
      ['design_id', V_DESIGN_ID],
      ['side_id', V_SIDE_ID],
      ['face', V_FACE],
      ['color', V_COLOR],
    ],
  });
}

{
  const t = customEventTrigger('design_resume');
  ga4EventTag({
    tagName: 'GA4 - design_resume',
    ga4EventName: 'design_resume',
    triggerId: t,
    params: [['product_id', V_PRODUCT_ID]],
  });
}

{
  const t = customEventTrigger('design_discard');
  ga4EventTag({
    tagName: 'GA4 - design_discard',
    ga4EventName: 'design_discard',
    triggerId: t,
    params: [['product_id', V_PRODUCT_ID]],
  });
}

{
  const t = customEventTrigger('design_complete');
  ga4EventTag({
    tagName: 'GA4 - design_complete',
    ga4EventName: 'design_complete',
    triggerId: t,
    params: [
      ['product_id', V_PRODUCT_ID],
      ['design_id', V_DESIGN_ID],
      ['faces_used', V_FACES_USED],
      ['text_count', V_TEXT_COUNT],
      ['image_count', V_IMAGE_COUNT],
      ['template_used', V_TEMPLATE_USED],
      ['retouch_requested', V_RETOUCH_REQUESTED],
      ['color', V_COLOR],
      ['base_price', V_BASE_PRICE],
      ['design_fee', V_DESIGN_FEE],
    ],
  });
}

{
  const t = customEventTrigger('option_quantity_change');
  ga4EventTag({
    tagName: 'GA4 - option_quantity_change',
    ga4EventName: 'option_quantity_change',
    triggerId: t,
    params: [
      ['product_id', V_PRODUCT_ID],
      ['size', V_SIZE],
      ['quantity', V_QUANTITY],
      ['total_quantity', V_TOTAL_QUANTITY],
    ],
  });
}

{
  const t = customEventTrigger('checkout_intent');
  ga4EventTag({
    tagName: 'GA4 - checkout_intent',
    ga4EventName: 'checkout_intent',
    triggerId: t,
    params: [
      ['product_id', V_PRODUCT_ID],
      ['design_id', V_DESIGN_ID],
      ['total_quantity', V_TOTAL_QUANTITY],
      ['value', V_VALUE],
    ],
  });
}

// 4. 장바구니/결제 (이커머스)
{
  const t = customEventTrigger('add_to_cart');
  ga4EventTag({
    tagName: 'GA4 - add_to_cart',
    ga4EventName: 'add_to_cart',
    triggerId: t,
    params: [['design_id', V_DESIGN_ID]],
    sendEcommerce: true,
  });
}

{
  const t = customEventTrigger('view_cart');
  ga4EventTag({
    tagName: 'GA4 - view_cart',
    ga4EventName: 'view_cart',
    triggerId: t,
    sendEcommerce: true,
  });
}

{
  const t = customEventTrigger('begin_checkout');
  ga4EventTag({
    tagName: 'GA4 - begin_checkout',
    ga4EventName: 'begin_checkout',
    triggerId: t,
    params: [['design_id', V_DESIGN_ID]],
    sendEcommerce: true,
  });
}

{
  const t = customEventTrigger('purchase');
  ga4EventTag({
    tagName: 'GA4 - purchase',
    ga4EventName: 'purchase',
    triggerId: t,
    params: [['transaction_id', V_TRANSACTION_ID]],
    sendEcommerce: true,
  });
}

// 5. 리드
{
  const t = customEventTrigger('generate_lead');
  ga4EventTag({
    tagName: 'GA4 - generate_lead',
    ga4EventName: 'generate_lead',
    triggerId: t,
    params: [
      ['form_type', V_FORM_TYPE],
      ['quantity_range', V_QUANTITY_RANGE],
      ['desired_date', V_DESIRED_DATE],
      ['product_count', V_PRODUCT_COUNT],
      ['value', V_VALUE],
      ['currency', V_CURRENCY],
    ],
  });
}

{
  const t = customEventTrigger('generate_lead_fail');
  ga4EventTag({
    tagName: 'GA4 - generate_lead_fail',
    ga4EventName: 'generate_lead_fail',
    triggerId: t,
    params: [
      ['form_type', V_FORM_TYPE],
      ['reason', V_REASON],
    ],
  });
}

// 6. 공동구매
{
  const t = customEventTrigger('cobuy_step_view');
  ga4EventTag({
    tagName: 'GA4 - cobuy_step_view',
    ga4EventName: 'cobuy_step_view',
    triggerId: t,
    params: [
      ['step_number', V_STEP_NUMBER],
      ['step_name', V_STEP_NAME],
    ],
  });
}

{
  const t = customEventTrigger('cobuy_step_complete');
  ga4EventTag({
    tagName: 'GA4 - cobuy_step_complete',
    ga4EventName: 'cobuy_step_complete',
    triggerId: t,
    params: [
      ['step_number', V_STEP_NUMBER],
      ['step_name', V_STEP_NAME],
    ],
  });
}

{
  const t = customEventTrigger('cobuy_design_choice');
  ga4EventTag({
    tagName: 'GA4 - cobuy_design_choice',
    ga4EventName: 'cobuy_design_choice',
    triggerId: t,
    params: [['choice', V_CHOICE]],
  });
}

// 7. 검색/콘텐츠/커뮤니케이션
{
  const t = customEventTrigger('search');
  ga4EventTag({
    tagName: 'GA4 - search',
    ga4EventName: 'search',
    triggerId: t,
    params: [
      ['search_term', V_SEARCH_TERM],
      ['results_count', V_RESULTS_COUNT],
    ],
  });
}

{
  const t = customEventTrigger('content_view');
  ga4EventTag({
    tagName: 'GA4 - content_view',
    ga4EventName: 'content_view',
    triggerId: t,
    params: [
      ['content_id', V_CONTENT_ID],
      ['content_type', V_CONTENT_TYPE],
      ['content_category', V_CONTENT_CATEGORY],
    ],
  });
}

{
  const t = customEventTrigger('click_to_call');
  ga4EventTag({
    tagName: 'GA4 - click_to_call',
    ga4EventName: 'click_to_call',
    triggerId: t,
    params: [['phone', V_PHONE]],
  });
}

{
  const t = customEventTrigger('kakao_chat_click');
  ga4EventTag({
    tagName: 'GA4 - kakao_chat_click',
    ga4EventName: 'kakao_chat_click',
    triggerId: t,
  });
}

{
  const t = customEventTrigger('chatbot_open');
  ga4EventTag({
    tagName: 'GA4 - chatbot_open',
    ga4EventName: 'chatbot_open',
    triggerId: t,
    params: [['source', V_SOURCE]],
  });
}

// ─── 빌트인 변수 ─────────────────────────────────────────────────────────────

const builtInTypes = [
  'PAGE_URL',
  'PAGE_HOSTNAME',
  'PAGE_PATH',
  'REFERRER',
  'EVENT',
  'CLICK_ELEMENT',
  'CLICK_CLASSES',
  'CLICK_ID',
  'CLICK_TARGET',
  'CLICK_URL',
  'CLICK_TEXT',
  'FORM_ELEMENT',
  'FORM_CLASSES',
  'FORM_ID',
  'FORM_TARGET',
  'FORM_URL',
  'FORM_TEXT',
  'HISTORY_SOURCE',
  'NEW_HISTORY_FRAGMENT',
  'NEW_HISTORY_STATE',
  'OLD_HISTORY_FRAGMENT',
  'OLD_HISTORY_STATE',
  'SCROLL_DEPTH_THRESHOLD',
  'SCROLL_DEPTH_UNITS',
];

const builtInVariable = builtInTypes.map((type) => ({
  accountId: '0',
  containerId: '0',
  type,
  name: type,
}));

// ─── 컨테이너 조립 ───────────────────────────────────────────────────────────

const container = {
  exportFormatVersion: 2,
  exportTime: new Date().toISOString(),
  containerVersion: {
    path: 'accounts/0/containers/0/versions/0',
    accountId: '0',
    containerId: '0',
    containerVersionId: '0',
    container: {
      path: 'accounts/0/containers/0',
      accountId: '0',
      containerId: '0',
      name: 'modoo_app',
      publicId: CONTAINER_PUBLIC_ID,
      usageContext: ['WEB'],
      fingerprint: '0',
      tagManagerUrl: `https://tagmanager.google.com/#/container/accounts/0/containers/0/workspaces/0`,
      features: {
        supportUserPermissions: true,
        supportEnvironments: true,
        supportWorkspaces: true,
        supportGtagConfigs: true,
        supportBuiltInVariables: true,
        supportClients: false,
        supportFolders: true,
        supportTags: true,
        supportTemplates: true,
        supportTriggers: true,
        supportVariables: true,
        supportVersions: true,
        supportZones: true,
        supportTransformations: true,
      },
      tagIds: [CONTAINER_PUBLIC_ID],
    },
    tag: tags,
    trigger: triggers,
    variable: variables,
    builtInVariable,
    fingerprint: '0',
    tagManagerUrl: `https://tagmanager.google.com/#/versions/accounts/0/containers/0/versions/0`,
  },
};

// ─── 출력 ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '..', 'gtm-modoo-app-import.json');
writeFileSync(outPath, JSON.stringify(container, null, 2), 'utf8');

console.log(
  `[ok] 작성 완료: ${outPath}\n` +
    `  - 변수: ${variables.length} 개\n` +
    `  - 빌트인 변수: ${builtInVariable.length} 개\n` +
    `  - 트리거: ${triggers.length} 개\n` +
    `  - 태그: ${tags.length} 개\n` +
    `  - 측정 ID: ${MEASUREMENT_ID}\n` +
    `  - 컨테이너: ${CONTAINER_PUBLIC_ID}`,
);
