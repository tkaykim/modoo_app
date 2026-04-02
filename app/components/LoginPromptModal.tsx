'use client';

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

const LOGIN_RETURN_TO_KEY = 'login:returnTo';

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  returnTo?: string;
}

export default function LoginPromptModal({
  isOpen,
  onClose,
  title = "로그인이 필요합니다",
  message = "이 기능을 사용하려면 로그인이 필요합니다.",
  returnTo,
}: LoginPromptModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMounted = useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);

  if (!isOpen || !isMounted) return null;

  const handleLoginClick = () => {
    onClose();

    try {
      const returnUrl = returnTo || `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;
      sessionStorage.setItem(LOGIN_RETURN_TO_KEY, returnUrl);
    } catch {
      // ignore
    }

    router.push('/login');
  };

  return createPortal(
    <div
      className="fixed inset-0 w-full h-full bg-black/50 z-9999 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white mx-4 max-w-sm w-full rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
          <p className="text-gray-600 mb-6 whitespace-pre-line">
            {message}
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleLoginClick}
              className="w-full px-5 py-3 bg-[#3B55A5] text-white rounded-lg font-semibold hover:bg-[#2D4280] transition"
            >
              로그인하기
            </button>
            <button
              onClick={onClose}
              className="w-full px-5 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
