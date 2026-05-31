// 비로그인 고객의 문의 열람/답글 인증 키 매칭.
// 게시판 설계상 "전화번호로 조회"가 기본이므로, 입력값이 (1) 저장된 비밀번호와 일치하거나
// (2) 전화번호(숫자만)와 일치하면 통과시킨다. 둘 다 허용해 회원이 설정한 비번을 잊어도
// 전화번호로 본인 확인이 되게 한다.
export function inquiryKeyMatches(
  input: string | null | undefined,
  stored: { password?: string | null; phone?: string | null },
): boolean {
  const t = (input ?? '').trim();
  if (!t) return false;
  if (stored.password && t === stored.password) return true;
  const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '');
  const di = digits(t);
  // 전화번호는 최소 8자리 이상일 때만 비교(빈/짧은 값 오매칭 방지)
  return !!stored.phone && di.length >= 8 && di === digits(stored.phone);
}
