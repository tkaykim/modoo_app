'use client'

import React from 'react';
import { XCircle, Clock, Users } from 'lucide-react';
import { formatKstDateOnly } from '@/lib/kst';

interface CoBuyClosedScreenProps {
  reason: 'expired' | 'closed' | 'full' | 'cancelled';
  title?: string;
  endDate?: string;
  maxParticipants?: number;
  currentCount?: number;
}

const CoBuyClosedScreen: React.FC<CoBuyClosedScreenProps> = ({
  reason,
  title,
  endDate,
  maxParticipants,
  currentCount
}) => {
  const getReasonContent = () => {
    switch (reason) {
      case 'expired':
        return {
          icon: <Clock className="w-16 h-16 text-gray-400" />,
          title: '공동구매가 마감되었습니다',
          message: endDate
            ? `이 공동구매는 ${formatKstDateOnly(endDate)}에 종료되었습니다.`
            : '공동구매 기간이 종료되었습니다.'
        };
      case 'closed':
        return {
          icon: <XCircle className="w-16 h-16 text-gray-400" />,
          title: '공동구매가 종료되었습니다',
          message: '주최자가 공동구매를 종료했습니다.'
        };
      case 'full':
        return {
          icon: <Users className="w-16 h-16 text-gray-400" />,
          title: '정원이 마감되었습니다',
          message: maxParticipants && currentCount
            ? `최대 인원(${maxParticipants}명)에 도달하여 더 이상 참여할 수 없습니다.`
            : '참여 가능한 인원이 모두 찼습니다.'
        };
      case 'cancelled':
        return {
          icon: <XCircle className="w-16 h-16 text-red-400" />,
          title: '공동구매가 취소되었습니다',
          message: '이 공동구매는 취소되었습니다.'
        };
      default:
        return {
          icon: <XCircle className="w-16 h-16 text-gray-400" />,
          title: '공동구매를 이용할 수 없습니다',
          message: '현재 이 공동구매에 참여할 수 없습니다.'
        };
    }
  };

  const content = getReasonContent();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="flex justify-center mb-6">
          {content.icon}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {content.title}
        </h1>

        {title && (
          <p className="text-lg text-gray-600 mb-4">
            &ldquo;{title}&rdquo;
          </p>
        )}

        <p className="text-gray-600 mb-8">
          {content.message}
        </p>

        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-500">
            문의사항이 있으시면 주최자에게 연락해주세요.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CoBuyClosedScreen;
