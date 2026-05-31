'use client';

import { QuickReply } from '@/lib/chatbot/types';
import {
  Palette,
  MessageCircle,
  Headset,
  HelpCircle,
  RotateCcw,
  Shirt,
  type LucideIcon,
} from 'lucide-react';

interface QuickRepliesProps {
  replies: QuickReply[];
  onReplyClick: (reply: QuickReply) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  palette: Palette,
  'message-circle': MessageCircle,
  headset: Headset,
  'help-circle': HelpCircle,
  'rotate-ccw': RotateCcw,
  shirt: Shirt,
};

export default function QuickReplies({ replies, onReplyClick }: QuickRepliesProps) {
  if (!replies || replies.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {replies.map((reply, index) => {
        const Icon = reply.icon ? ICON_MAP[reply.icon] : null;
        return (
          <button
            key={index}
            onClick={() => onReplyClick(reply)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white border-2 border-[#0052CC] text-[#0052CC] rounded-lg shadow-sm hover:bg-blue-50 hover:shadow-md active:scale-95 transition-all whitespace-nowrap"
          >
            {Icon && <Icon className="w-4 h-4" />}
            {reply.label}
          </button>
        );
      })}
    </div>
  );
}
