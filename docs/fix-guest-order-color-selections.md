# 게스트 주문 시 color_selections 누락 버그 수정

## 문제 현상

관리자 페이지에서 주문을 열었을 때, 고객이 선택한 제품 색상과 다른 색상의 목업이 표시되는 현상이 발생.

## 원인 분석

### 배경

- 제품 목업은 **흰색 기본 이미지 1장**만 존재하며, 고객이 색상을 선택하면 Fabric.js `BlendColor(multiply)` 필터로 런타임에 색상을 적용합니다.
- 주문 생성 시 선택된 색상은 `order_items.color_selections` 컬럼에 `{ "productColor": "#hex" }` 형태로 저장됩니다.
- 관리자 앱은 이 `color_selections.productColor` 값을 읽어서 목업에 색상을 적용합니다.

### 버그 발생 경로

비로그인 사용자의 주문 흐름에서 `color_selections`가 빈 객체 `{}`로 저장됩니다.

**로그인 사용자 (정상):**

```
에디터 → addToCartDB() → saveDesign() → saved_designs.color_selections = { productColor: "#hex" }
→ toss/confirm API → savedDesign에서 color_selections 조회 → order_items에 정상 저장
```

**비로그인 사용자 (버그):**

```
에디터 → addToCart() → localStorage 저장 (colorSelections 미전달)
→ checkout 페이지 → product_color만 전달 (colorSelections 미매핑)  
→ toss/confirm API → savedDesign = null, item.colorSelections = undefined
→ order_items.color_selections = {} (빈 객체)
```

비로그인 사용자의 경우 `saved_designs` 테이블에 디자인이 저장되지 않고, 체크아웃 페이지에서 `colorSelections` 필드를 매핑하지 않아서, `toss/confirm` API에서 색상 정보를 구성할 수 없습니다.

단, `item.product_color`에는 올바른 hex 값이 항상 전달됩니다 (variants에도 `color_hex`로 존재).

### DB 실제 데이터 증거

| order_id | user_id | color_selections | variants[0].color_hex |
|---|---|---|---|
| ORD-20260319-5G7YU5 | null (비로그인) | `{}` | `#1C1C1C` |
| ORD-20260319-JWTMDQ | null (비로그인) | `{}` | `#FFFFFF` |

## 수정 내용

### 1. `app/api/toss/confirm/route.ts` (311행)

`color_selections` 폴백 체인에 `item.product_color`를 마지막 안전장치로 추가합니다.

**변경 전:**
```javascript
color_selections: savedDesign?.color_selections || item.colorSelections || {},
```

**변경 후:**
```javascript
color_selections: savedDesign?.color_selections || item.colorSelections || { productColor: item.product_color },
```

- `savedDesign?.color_selections` — 로그인 사용자의 정상 경로 (DB에서 조회)
- `item.colorSelections` — 클라이언트가 직접 전달한 경우
- `{ productColor: item.product_color }` — 위 둘 다 없을 때, cart_items의 product_color hex 값으로 구성

`item.product_color`는 체크아웃 페이지에서 항상 전달되므로 (`product_color: item.productColor`), 이 폴백으로 비로그인 주문에서도 `color_selections.productColor`가 반드시 채워집니다.

### 2. DB 스키마 코멘트 업데이트

`order_items.color_selections`와 `saved_designs.color_selections`의 DB 코멘트가 실제 데이터 구조와 다릅니다.

**현재 코멘트 (잘못됨):**
```
{ "front": { "body": "#ff0000", "sleeves": "#0000ff" }, "back": { "body": "#ff0000" } }
```

**실제 저장되는 구조:**
```
{ "productColor": "#7EB6E6" }
```

코멘트를 실제 구조에 맞게 수정합니다.

### 3. 기존 데이터 보정

`color_selections`가 빈 객체인 기존 주문 2건을 `item_options.variants[0].color_hex` 값으로 보정합니다.

```sql
UPDATE order_items 
SET color_selections = jsonb_build_object('productColor', item_options->'variants'->0->>'color_hex')
WHERE color_selections = '{}'::jsonb 
  AND item_options->'variants'->0->>'color_hex' IS NOT NULL;
```

## 영향 범위

- 수정 대상 파일: `app/api/toss/confirm/route.ts` (1줄)
- 수정 대상 DB: `order_items` (2건), `saved_designs` 코멘트, `order_items` 코멘트
- 기존 로그인 사용자 주문에는 영향 없음 (이미 정상 저장됨)
- 향후 비로그인 주문에서 `color_selections.productColor`가 정상 저장됨
