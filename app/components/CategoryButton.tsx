'use client';

import Image from "next/image";
import { useRouter } from "next/navigation";

type CategoryButtonProps = {
  name: string;
  icon?: string;
  onClick?: () => void;
  href?: string;
  isActive?: boolean;
};

export default function CategoryButton({ name, icon, onClick, href, isActive = false }: CategoryButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex flex-col items-center gap-1.5 lg:gap-2 min-w-fit transition-all ${
        isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'
      }`}
    >
      <div className={`size-16 sm:size-18 lg:size-16 rounded-xl lg:rounded-xl flex items-center justify-center transition-colors border border-black/40 hover:bg-gray-100 ${
        isActive ? 'ring-2 ring-brand box-content' : ''
      }`}>
        {icon ? (
          <Image
            src={icon}
            alt={name}
            width={56}
            height={56}
            className="object-contain w-12 h-12 sm:w-13 sm:h-13 lg:w-14 lg:h-14"
          />
        ) : (
          <span className="text-3xl sm:text-4xl lg:text-4xl">📦</span>
        )}
      </div>
      <p className={`text-xs sm:text-sm lg:text-sm font-medium ${
        isActive ? 'text-brand' : 'text-gray-700'
      }`}>
        {name}
      </p>
    </button>
  );
}
