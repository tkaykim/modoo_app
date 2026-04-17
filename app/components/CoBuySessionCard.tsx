'use client';

import Link from "next/link";
import Image from "next/image";
import { Users, Calendar } from "lucide-react";
import { formatKstMonthDayLong } from '@/lib/kst';

interface CoBuySessionCardProps {
  session: {
    share_token: string;
    title: string;
    end_date: string;
    current_participant_count: number;
    saved_design_screenshot?: {
      preview_url: string | null;
      title: string;
    } | null;
  };
}

export default function CoBuySessionCard({ session }: CoBuySessionCardProps) {
  const previewUrl = session.saved_design_screenshot?.preview_url;
  const designTitle = session.saved_design_screenshot?.title || session.title;

  const endDate = new Date(session.end_date);
  const formattedEndDate = formatKstMonthDayLong(session.end_date);

  const now = new Date();
  const isExpired = now > endDate;
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Link
      href={`/cobuy/${session.share_token}`}
      className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100"
    >
      {/* Preview Image */}
      <div className="aspect-square bg-gray-100 relative">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={designTitle}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-sm">미리보기 없음</span>
          </div>
        )}
        {/* Status Badge */}
        {isExpired ? (
          <div className="absolute top-2 right-2 px-2 py-1 bg-gray-500 text-white text-xs rounded-full">
            마감됨
          </div>
        ) : daysLeft <= 3 ? (
          <div className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full">
            {daysLeft}일 남음
          </div>
        ) : null}
      </div>

      {/* Session Details */}
      <div className="p-3">
        {/* Design Title */}
        <p className="text-sm lg:text-base font-medium text-gray-900 line-clamp-2 mb-2">
          {designTitle}
        </p>

        {/* Stats Row */}
        <div className="flex items-center gap-3 text-xs lg:text-sm text-gray-500">
          {/* Participants */}
          <div className="flex items-center gap-1">
            <Users size={14} className="text-gray-400" />
            <span>{session.current_participant_count}명 참여</span>
          </div>

          {/* End Date */}
          <div className="flex items-center gap-1">
            <Calendar size={14} className="text-gray-400" />
            <span>{formattedEndDate} 마감</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
