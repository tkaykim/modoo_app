// 템플릿 기능 미공개로 임시 숨김 — 다시 풀 때 이 redirect 제거하고
// 이전 그룹 상세 페이지 코드를 복원하세요 (git history 참고).
import { redirect } from 'next/navigation';

export default function GroupDetailPage() {
  redirect('/home');
}
