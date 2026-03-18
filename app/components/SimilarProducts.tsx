'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase-client'

interface SimilarProduct {
  id: string
  title: string
  base_price: number
  thumbnail_image_link: string[] | null
}

interface SimilarProductsProps {
  productId: string
  manufacturerName?: string | null
}

export default function SimilarProducts({ productId, manufacturerName }: SimilarProductsProps) {
  const [products, setProducts] = useState<SimilarProduct[]>([])

  useEffect(() => {
    const fetchSimilar = async () => {
      const supabase = createClient()

      // Get manufacturer_id of current product
      const { data: current } = await supabase
        .from('products')
        .select('manufacturer_id')
        .eq('id', productId)
        .single()

      if (!current?.manufacturer_id) return

      const { data } = await supabase
        .from('products')
        .select('id, title, base_price, thumbnail_image_link')
        .eq('manufacturer_id', current.manufacturer_id)
        .eq('is_active', true)
        .neq('id', productId)
        .order('created_at', { ascending: false })
        .limit(5)

      if (data && data.length > 0) {
        setProducts(data)
      }
    }

    fetchSimilar()
  }, [productId])

  if (products.length === 0) return null

  return (
    <section className="mt-6">
      <h3 className="text-sm font-bold mb-2">
        {manufacturerName ? `${manufacturerName}의 다른 상품` : '비슷한 상품'}
      </h3>
      <div className="flex gap-2.5 overflow-x-auto pb-2">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/editor/${p.id}`}
            className="shrink-0 w-28 group"
          >
            <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
              {p.thumbnail_image_link?.[0] ? (
                <Image
                  src={p.thumbnail_image_link[0]}
                  alt={p.title}
                  width={200}
                  height={200}
                  unoptimized
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                  이미지 없음
                </div>
              )}
            </div>
            <p className="text-xs font-medium text-gray-800 mt-1 line-clamp-2 leading-tight">{p.title}</p>
            <p className="text-xs font-bold text-gray-900">{p.base_price.toLocaleString('ko-KR')}원</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
