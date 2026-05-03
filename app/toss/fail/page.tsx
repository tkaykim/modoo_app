'use client'

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { trackPurchaseFail } from "@/lib/gtm-events";

function FailPageContent() {
  const searchParams = useSearchParams();
  const reasonCode = searchParams.get("code") ?? undefined;
  const reasonMessage = searchParams.get("message") ?? undefined;

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
        <h2 className="text-2xl font-bold mb-12">결제를 실패했어요</h2>

        <div className="w-full space-y-4 mb-12">
          <div className="flex justify-between items-center">
            <div className="text-left">
              <b>에러메시지</b>
            </div>
            <div className="text-right" id="message">{`${searchParams.get("message")}`}</div>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-left">
              <b>에러코드</b>
            </div>
            <div className="text-right" id="code">{`${searchParams.get("code")}`}</div>
          </div>
        </div>
      <Link href="/home" className="bg-gray-300 w-full py-4 rounded-sm">Back to Home</Link>
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
