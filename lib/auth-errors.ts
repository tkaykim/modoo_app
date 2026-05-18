/**
 * Supabase Auth 에러를 사용자 친화적인 한국어 메시지로 변환.
 * Supabase는 보안상(이메일 enumeration 방지) 비밀번호 오류와 계정 없음을 같은
 * "Invalid login credentials"로 반환하므로, UI에서는 두 경우를 모두 안내한다.
 */

export type AuthErrorKind =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limit'
  | 'weak_password'
  | 'already_registered'
  | 'invalid_email'
  | 'network'
  | 'unknown';

export interface TranslatedAuthError {
  kind: AuthErrorKind;
  message: string;
}

export function translateAuthError(raw: string | undefined | null): TranslatedAuthError {
  const msg = (raw ?? '').toLowerCase();

  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid_credentials') ||
    msg.includes('invalid email or password')
  ) {
    return {
      kind: 'invalid_credentials',
      message:
        '이메일 또는 비밀번호가 일치하지 않습니다. 비밀번호를 다시 확인하시거나, 아직 가입하지 않으셨다면 회원가입을 진행해주세요.',
    };
  }

  if (msg.includes('email not confirmed')) {
    return {
      kind: 'email_not_confirmed',
      message:
        '아직 이메일 인증이 완료되지 않은 계정입니다. 가입 시 받으신 인증 메일의 링크를 클릭해주세요.',
    };
  }

  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return {
      kind: 'rate_limit',
      message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
    };
  }

  if (msg.includes('user already registered') || msg.includes('already exists')) {
    return {
      kind: 'already_registered',
      message: '이미 가입된 이메일입니다. 로그인 탭으로 이동해 로그인해주세요.',
    };
  }

  if (msg.includes('password should be at least') || msg.includes('weak password')) {
    return {
      kind: 'weak_password',
      message: '비밀번호는 6자 이상으로 설정해주세요.',
    };
  }

  if (msg.includes('invalid email') || msg.includes('email address') && msg.includes('invalid')) {
    return {
      kind: 'invalid_email',
      message: '이메일 형식이 올바르지 않습니다. 다시 확인해주세요.',
    };
  }

  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout')
  ) {
    return {
      kind: 'network',
      message: '네트워크 연결에 문제가 있습니다. 인터넷 상태를 확인하고 다시 시도해주세요.',
    };
  }

  return {
    kind: 'unknown',
    message: raw?.trim()
      ? `로그인 중 오류가 발생했습니다: ${raw}`
      : '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  };
}
