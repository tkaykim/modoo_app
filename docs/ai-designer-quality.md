# AI 디자이너 품질 파이프라인 (2026-09-05)

정본: `C:\Users\tkay\.claude\projects\C--Users-tkay-Desktop\memory\project_modoo_ai_designer.md` · 이 문서는 레포 안 실행·환경 노트만 담는다.

## 원칙

1. 실착 미리보기는 캔버스 결정적 합성(`lib/aiDesigner/placement.ts`)이 정본이다. AI 재합성(`composeSideDraft`)은 `AI_DESIGNER_DRAFT_MODE=ai`일 때만 켜진다(기본 `local`).
2. 글자는 AI가 그리지 않는다. 엠블럼·마스코트는 프롬프트에서 no-text를 강제하고, 영문 레터링만 따옴표 문구로 넘긴다. 한글 문구는 거부하고 디자이너가 서체로 넣는다(`lib/aiDesigner/prompt.ts`).
3. AI 결과는 항상 "AI 초안"으로 표시되고 디자이너 확정 시안을 거친 뒤 제작된다(`saved_designs.retouch_requested`, canvas_state `data.aiGenerated`).

## 흐름

```
고객 요청 → prompt.ts(구조화) → providers/*(후보 n장) → 스토리지 + quality.ts(상대 검사) → 원장 ai_designer_generations
  → 고객 선택 → (변형 1회) → finalize-logo: removeFlatBackground → vectorize(Recraft/mock) → quality → 최종 PNG(+SVG)
  → 위저드 이미지 목록("AI 초안") → 배치 → order: 배치 폭 mm 기준 quality → canvas_state data.artworkQuality / aiGenerated / originalSvgUrl
  → 관리자 주문 상세·공장 패널 AiDraftSummary 배지
```

## 환경 변수

| 변수 | 값 | 설명 |
|---|---|---|
| `AI_DESIGNER_IMAGE_PROVIDER` | `gemini` `openai` `recraft` `ideogram` `mock` `none` | 기본 제공자. `mock`은 개발 환경 또는 `AI_DESIGNER_ALLOW_MOCK=1`에서만 |
| `AI_DESIGNER_EMBLEM_PROVIDER` / `AI_DESIGNER_WORDMARK_PROVIDER` | 위와 같음 | 용도별 제공자(선택). 권장: 엠블럼=recraft, 워드마크=ideogram |
| `AI_DESIGNER_VECTORIZE_PROVIDER` | `recraft` `mock` `none` | 미설정=자동(Recraft 키 있으면 recraft, 기본 제공자가 mock이면 mock) |
| `AI_DESIGNER_DRAFT_MODE` | `local`(기본) `ai` | 실착 초안 AI 재합성 여부 |
| `AI_DESIGNER_CANDIDATES` | 1~6 (기본 4) | 후보 수 |
| `AI_DESIGNER_MAX_ROUNDS_PER_SESSION` | 기본 3 | 세션당 생성 라운드 캡(429) |
| `AI_DESIGNER_MAX_ROUNDS_PER_IP_DAY` | 기본 30 | IP당 하루 라운드 캡 |
| `AI_DESIGNER_IP_SALT` | 임의 문자열 | IP 해시 솔트 |
| `AI_DESIGNER_PILOT_ENABLED` / `AI_DESIGNER_PILOT_TOKEN` | `1` / 토큰 | `/ai-designer/pilot?token=…` 파일럿 화면·API 게이트 |
| 키 | `GEMINI_API_KEY` `OPENAI_API_KEY` `RECRAFT_API_KEY` `IDEOGRAM_API_KEY` | 있는 키만 제공자로 활성 |
| 모델 | `AI_DESIGNER_GEMINI_MODEL` `AI_DESIGNER_OPENAI_MODEL` `AI_DESIGNER_OPENAI_QUALITY` `AI_DESIGNER_RECRAFT_MODEL` `AI_DESIGNER_IDEOGRAM_MODEL`(v4/v3) `AI_DESIGNER_IDEOGRAM_SPEED` | 기본값은 각 어댑터 파일 상단 |

로컬 `.env.local`(개발): `AI_DESIGNER_IMAGE_PROVIDER=mock`, `AI_DESIGNER_VECTORIZE_PROVIDER=mock`, `AI_DESIGNER_PILOT_ENABLED=1`, `AI_DESIGNER_PILOT_TOKEN=local-pilot`.

## 키를 받은 뒤 켜는 순서

1. Vercel env에 키와 `AI_DESIGNER_IMAGE_PROVIDER`(및 용도별 제공자)를 REST로 등록하고 `env pull`로 길이 검증(빈 값 함정 주의).
2. `/ai-designer/pilot?token=…`에서 프롬프트 30건을 실제 제공자로 돌려 디자이너 평가 → 요약표 "통과" 확인(사용 가능 ≥70%, 폐기 ≤10%, 보정 ≤10분).
3. 각 어댑터는 문서 기준으로 작성돼 실호출 검증이 안 됐다. 첫 호출에서 400이 나면 요청 필드를 어댑터 파일 상단 주석의 API 형식과 대조한다.
4. 제공자 대시보드에 월 예산 알림을 걸고, 캡(`AI_DESIGNER_MAX_ROUNDS_*`)을 확인한다.

## 테스트

```bash
npm run test:ai-designer
```

`lib/aiDesigner/quality.test.ts`(색 수·그라데이션·가는 선·배경 제거·mock 결정성) + `prompt.test.ts`(no-text·한글 거부·분류).

mock 결함 주입 키워드(요청문에 포함): `gradient`/`그라데이션`, `thin`/`얇은`, `rainbow`/`무지개`.
