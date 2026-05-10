'use client';

import Link from 'next/link';
import { TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_LABELS } from '@/lib/templateCategories';

interface Props {
  active?: string | null; // null = "전체"
}

export default function CategoryChips({ active }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <Link
        href="/templates"
        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${
          !active
            ? 'bg-black text-white border-black'
            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
        }`}
      >
        전체
      </Link>
      {TEMPLATE_CATEGORIES.map((cat) => {
        const selected = active === cat;
        return (
          <Link
            key={cat}
            href={`/templates/${cat}`}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${
              selected
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
            }`}
          >
            {TEMPLATE_CATEGORY_LABELS[cat]}
          </Link>
        );
      })}
    </div>
  );
}
