'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to the new request-based CoBuy flow
export default function CreateCoBuyRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/home/cobuy/request/create');
  }, [router]);

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#0052CC] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">이동 중...</p>
      </div>
    </div>
  );
}
