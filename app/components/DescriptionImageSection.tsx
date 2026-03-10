import Image from 'next/image';

interface DescriptionImageSectionProps {
  title?: string;
  imageUrls?: string[] | null;
}

export default function DescriptionImageSection({
  title = '주문상세',
  imageUrls,
}: DescriptionImageSectionProps) {
  if (!imageUrls || imageUrls.length === 0) return null;

  return (
    <section className="mt-6 w-full">
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      {imageUrls.map((url, idx) => (
        <Image
          key={idx}
          src={url}
          alt={`${title} ${idx + 1}`}
          width={1200}
          height={1200}
          unoptimized
          sizes="100vw"
          className="w-[80%] h-auto rounded-lg border border-gray-100 mx-auto"
          style={{ height: 'auto' }}
        />
      ))}
    </section>
  );
}
