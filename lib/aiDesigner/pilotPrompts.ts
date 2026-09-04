/**
 * AI 디자이너 품질 파일럿 — 대표 프롬프트 30건(학과 엠블럼 10 · 동아리 마스코트 10 · 영문 워드마크 10).
 * 파일럿 화면(/ai-designer/pilot)이 모델별로 후보를 만들고 디자이너가 3등급 평가한다.
 * 통과 기준(2026-09-04 기획): 그대로+약간 보정 ≥ 70%, 폐기 ≤ 10%, 보정 시간 ≤ 10분/건.
 */
import type { ArtworkPurpose, ColorCount } from './prompt.ts';

export interface PilotPrompt {
  id: string;
  purpose: ArtworkPurpose;
  request: string;
  text?: string;
  colorCount: ColorCount;
}

export const PILOT_PROMPTS: PilotPrompt[] = [
  // 학과 엠블럼
  { id: 'E01', purpose: 'emblem', request: '기계공학과 엠블럼, 톱니바퀴 두 개와 방패, 네이비와 골드', colorCount: 3 },
  { id: 'E02', purpose: 'emblem', request: '경영학과 엠블럼, 월계수 잎이 감싼 별 하나', colorCount: 2 },
  { id: 'E03', purpose: 'emblem', request: '간호학과 엠블럼, 십자가와 하트, 둥근 배지 형태', colorCount: 3 },
  { id: 'E04', purpose: 'emblem', request: '컴퓨터공학과 엠블럼, 육각형 안의 회로 패턴', colorCount: 3 },
  { id: 'E05', purpose: 'emblem', request: '체육교육과 엠블럼, 횃불과 월계관, 방패형', colorCount: 3 },
  { id: 'E06', purpose: 'emblem', request: '건축학과 엠블럼, 기둥 세 개와 삼각 지붕', colorCount: 2 },
  { id: 'E07', purpose: 'emblem', request: '화학과 엠블럼, 플라스크와 원자 궤도', colorCount: 3 },
  { id: 'E08', purpose: 'emblem', request: '법학과 엠블럼, 저울과 방패, 클래식한 대학 느낌', colorCount: 3 },
  { id: 'E09', purpose: 'emblem', request: '항공우주공학과 엠블럼, 로켓과 별, 원형 배지', colorCount: 4 },
  { id: 'E10', purpose: 'emblem', request: '해양학과 엠블럼, 파도와 닻, 방패형', colorCount: 3 },
  // 동아리 마스코트
  { id: 'M01', purpose: 'mascot', request: '안경 쓴 북극곰이 농구공을 든 마스코트', colorCount: 4 },
  { id: 'M02', purpose: 'mascot', request: '정면을 노려보는 호랑이 머리 마스코트', colorCount: 4 },
  { id: 'M03', purpose: 'mascot', request: '날개를 활짝 편 독수리 마스코트', colorCount: 3 },
  { id: 'M04', purpose: 'mascot', request: '늑대 옆얼굴 마스코트, 날카로운 눈', colorCount: 3 },
  { id: 'M05', purpose: 'mascot', request: '후드티를 입은 고양이 마스코트, 힙합 느낌', colorCount: 4 },
  { id: 'M06', purpose: 'mascot', request: '불을 뿜는 용 머리 마스코트', colorCount: 4 },
  { id: 'M07', purpose: 'mascot', request: '헬멧을 쓴 강아지 마스코트, 야구팀', colorCount: 3 },
  { id: 'M08', purpose: 'mascot', request: '책을 든 부엉이 마스코트, 독서 동아리', colorCount: 3 },
  { id: 'M09', purpose: 'mascot', request: '서핑보드를 탄 상어 마스코트', colorCount: 4 },
  { id: 'M10', purpose: 'mascot', request: '메가폰을 든 곰돌이 응원단 마스코트', colorCount: 3 },
  // 영문 워드마크
  { id: 'W01', purpose: 'wordmark', text: 'HANYANG 24', request: '아치형 배치, 굵은 블록체', colorCount: 2 },
  { id: 'W02', purpose: 'wordmark', text: 'YONSEI', request: '클래식 대학 레터링, 외곽선 두 겹', colorCount: 3 },
  { id: 'W03', purpose: 'wordmark', text: 'KOREA UNIV', request: '두 줄 배치, 위 작게 아래 크게', colorCount: 2 },
  { id: 'W04', purpose: 'wordmark', text: 'SNU 2026', request: '숫자 강조, 이탤릭 없이 정자체', colorCount: 2 },
  { id: 'W05', purpose: 'wordmark', text: 'DANCE CREW', request: '스트리트 느낌의 굵은 글자, 살짝 기울임', colorCount: 3 },
  { id: 'W06', purpose: 'wordmark', text: 'MECH ENG', request: '산업적인 느낌, 사각 프레임 안에', colorCount: 2 },
  { id: 'W07', purpose: 'wordmark', text: 'NURSING', request: '부드러운 둥근 블록체, 리본 배너 위', colorCount: 3 },
  { id: 'W08', purpose: 'wordmark', text: 'BASEBALL', request: '야구 유니폼 스타일 스크립트 없이 블록체, 밑줄 꼬리', colorCount: 2 },
  { id: 'W09', purpose: 'wordmark', text: 'GO TIGERS', request: '응원 문구, 위아래 아치', colorCount: 3 },
  { id: 'W10', purpose: 'wordmark', text: 'CLASS OF 26', request: '졸업 기념, 방패 없이 글자만', colorCount: 2 },
];

export function findPilotPrompt(id: string): PilotPrompt | undefined {
  return PILOT_PROMPTS.find((p) => p.id === id);
}
