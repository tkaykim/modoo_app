'use client'

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { trackPurchaseFail } from "@/lib/gtm-events";

function FailPageContent() {
  const searchParams = useSearchParams();
  const reasonCode = searchParams.get("code") ?? undefined;
  const reasonMessage = searchParams.get("message") ?? undefined;

  // 결제 도중 sessionStorage 가 날아가 주문 정보를 못 찾은 경우
  // (탭 폐기·다른 탭에서 결제창 열림 등). 원인이 고객 잘못이 아니므로 따로 안내한다.
  const isMissingOrderInfo = (reasonMessage ?? '').includes('주문 정보를 찾을 수 없');

  // 결제 실패 추적 — 마운트 시 1회. searchParams가 바뀌어도 dedupe.
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    try {
      trackPurchaseFail({ reason_code: reasonCode, reason_message: reasonMessage });
    } catch {
      // 트래킹 실패는 무시
    }
  }, [reasonCode, reasonMessage]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex flex-col items-center text-center">
        <img
          width="100"
          src="https://static.toss.im/lotties/error-spot-no-loop-space-apng.png"
          alt="에러 이미지"
          className="mb-4"
        />
        <h2 className="text-2xl font-bold mb-4">결제가 완료되지 않았어요</h2>

        {/* 카드 인증까지 마친 고객이 보는 화면이다. "돈이 빠져나갔나" 부터
            불안해하므로 결제가 실행되지 않았다는 사실을 가장 먼저 알린다.
            토스 승인(confirm)은 주문 정보 검증을 통과한 뒤에 호출되므로,
            이 화면에 왔다는 건 승인이 일어나지 않았다는 뜻이다. */}
        <p className="mb-8 text-gray-700 leading-relaxed">
          결제가 실행되지 않았으니 <b>대금은 청구되지 않습니다.</b>
          <br />
          장바구니는 그대로 있으니 다시 시도해주세요.
        </p>

        {isMissingOrderInfo && (
          <div className="w-full mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
            <p className="text-sm text-amber-900 leading-relaxed">
              주문 정보가 결제 도중 사라졌습니다.
              <br />
              결제창을 여는 동안 브라우저가 페이지를 정리했을 때 생깁니다.
              <br />
              장바구니에서 다시 결제하시면 됩니다.
              <br />
              반복된다면 브라우저 설정에서 사이트 데이터를 삭제하거나 다른 브라우저로 시도해주세요.
            </p>
          </div>
        )}

        <details className="w-full mb-8 text-left">
          <summary className="cursor-pointer text-sm text-gray-400">문의용 오류 정보</summary>
          <div className="mt-2 space-y-1 text-sm text-gray-500">
            <div>에러메시지: <span id="message">{searchParams.get('message') ?? '-'}</span></div>
            <div>에러코드: <span id="code">{searchParams.get('code') ?? '-'}</span></div>
          </div>
        </details>

        <div className="w-full space-y-2">
          <Link href="/cart" className="block bg-black text-white w-full py-4 rounded-lg font-medium">
            장바구니로 돌아가기
          </Link>
          <Link href="/home" className="block bg-gray-100 text-gray-700 w-full py-4 rounded-lg">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function FailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FailPageContent />
    </Suspense>
  );
}
