'use client'

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import Image from 'next/image';

interface DescriptionImageSectionProps {
  title?: string;
  imageUrls?: string[] | null;
  collapsedHeight?: number;
  /** true면 접기/더보기 없이 이미지 전체를 항상 표시 */
  disableCollapse?: boolean;
}

export default function DescriptionImageSection({
  title = '주문상세',
  imageUrls,
  collapsedHeight = 700,
  disableCollapse = false,
}: DescriptionImageSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disableCollapse) {
      setNeedsCollapse(false);
      return;
    }
    if (!contentRef.current) return;
    const checkHeight = () => {
      setNeedsCollapse(contentRef.current!.scrollHeight > collapsedHeight);
    };
    checkHeight();
    // Recheck after images load
    const images = contentRef.current.querySelectorAll('img');
    images.forEach((img) => img.addEventListener('load', checkHeight));
    return () => {
      images.forEach((img) => img.removeEventListener('load', checkHeight));
    };
  }, [collapsedHeight, imageUrls, disableCollapse]);

  if (!imageUrls || imageUrls.length === 0) return null;

  const isCollapsed = !disableCollapse && needsCollapse && !expanded;

  return (
    <section className="mt-4 w-full">
      <div className="relative">
        <div
          ref={contentRef}
          className={isCollapsed ? 'overflow-hidden' : ''}
          style={isCollapsed ? { maxHeight: collapsedHeight } : undefined}
        >
          {imageUrls.map((url, idx) => (
            <Image
              key={idx}
              src={url}
              alt={`${title} ${idx + 1}`}
              width={1200}
              height={1200}
              unoptimized
              sizes="100vw"
              className="w-full lg:w-[80%] h-auto rounded-lg border border-gray-100 mx-auto"
              style={{ height: 'auto' }}
            />
          ))}
        </div>

        {isCollapsed && (
          <div className="absolute bottom-0 left-0 right-0">
            <div className="h-20 bg-linear-to-t from-white to-transparent" />
            <div className="bg-white flex justify-center pb-2">
              <button
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1 px-6 py-2 border border-gray-300 rounded-full text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                상품 정보 더보기 <ChevronDown className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
