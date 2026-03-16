'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/app/components/Header';
import { createClient } from '@/lib/supabase-client';
import { useAuthStore } from '@/store/useAuthStore';
import { FaStar } from 'react-icons/fa';
import { userInfo } from 'os';

type ProductSummary = {
  id: string;
  title: string;
  thumbnail_image_link: string[] | null;
};

type UploadedReviewImage = {
  url: string;
  path: string;
};

export default function CreateMyReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();

  const productId = searchParams.get('productId') || '';
  const orderId = searchParams.get('orderId') || '';

  const [product, setProduct] = useState<ProductSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [existingReviewId, setExistingReviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedReviewImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const uploadedImagesRef = useRef<UploadedReviewImage[]>([]);
  const didCreateReviewRef = useRef(false);

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  useEffect(() => {
    const fetchProductAndCheckExisting = async () => {
      setError(null);
      setIsLoading(true);

      if (!productId) {
        setIsLoading(false);
        return;
      }

      const supabase = createClient();
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      const userId = supabaseUser?.id || user?.id;

      const [{ data: productData, error: productError }, { data: existingData, error: existingError }] = await Promise.all([
        supabase
          .from('products')
          .select('id, title, thumbnail_image_link')
          .eq('id', productId)
          .single(),
        userId
          ? supabase
            .from('reviews')
            .select('id')
            .eq('product_id', productId)
            .eq('user_id', userId)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (productError) {
        console.error('Failed to fetch product for review:', productError);
        setError('상품 정보를 불러오는데 실패했습니다.');
        setIsLoading(false);
        return;
      }

      setProduct(productData as ProductSummary);

      if (existingError) {
        console.error('Failed to check existing review:', existingError);
      } else {
        setExistingReviewId(existingData?.id ?? null);
      }

      setIsLoading(false);
    };

    fetchProductAndCheckExisting();
  }, [productId, user?.id]);

  useEffect(() => {
    return () => {
      if (didCreateReviewRef.current) return;
      const toDelete = uploadedImagesRef.current.map((img) => img.path);
      if (toDelete.length === 0) return;

      void fetch('/api/reviews/images/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: toDelete }),
      });
    };
  }, []);

  const uploadSelectedFiles = async (files: FileList | null) => {
    setError(null);
    if (!files || files.length === 0) return;

    const remaining = 3 - uploadedImagesRef.current.length;
    if (remaining <= 0) {
      setError('사진은 최대 3장까지 업로드할 수 있습니다.');
      return;
    }

    const selection = Array.from(files).slice(0, remaining);
    setUploadingImages(true);

    try {
      const formData = new FormData();
      selection.forEach((file) => formData.append('files', file));

      const res = await fetch('/api/reviews/images/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || '사진 업로드에 실패했습니다.');
        return;
      }

      const body = (await res.json()) as { images?: UploadedReviewImage[] };
      if (!Array.isArray(body.images)) {
        setError('사진 업로드에 실패했습니다.');
        return;
      }

      setUploadedImages((prev) => [...prev, ...body.images!].slice(0, 3));
    } finally {
      setUploadingImages(false);
    }
  };

  const removeUploadedImage = async (index: number) => {
    setError(null);
    const target = uploadedImagesRef.current[index];
    if (!target) return;

    setUploadedImages((prev) => prev.filter((_, i) => i !== index));

    const res = await fetch('/api/reviews/images/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [target.path] }),
    });

    if (!res.ok) {
      setUploadedImages((prev) => {
        const next = prev.slice();
        next.splice(index, 0, target);
        return next.slice(0, 3);
      });
      const body = await res.json().catch(() => null);
      setError(body?.error || '사진 삭제에 실패했습니다.');
    }
  };

  const handleCancel = async () => {
    const toDelete = uploadedImagesRef.current.map((img) => img.path);
    if (toDelete.length > 0) {
      await fetch('/api/reviews/images/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: toDelete }),
      });
      setUploadedImages([]);
    }

    router.back();
  };

  const handleSubmit = async () => {
    setError(null);

    if (!productId) {
      setError('상품이 선택되지 않았습니다.');
      return;
    }
    if (!title.trim()) {
      setError('리뷰 제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      setError('리뷰 내용을 입력해주세요.');
      return;
    }
    if (rating < 1 || rating > 5) {
      setError('평점을 선택해주세요.');
      return;
    }

    if (uploadingImages) {
      setError('사진 업로드가 완료된 후 등록해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      const userId = supabaseUser?.id || user?.id;

      if (!userId) {
        router.push('/login');
        return;
      }

      const { error: insertError } = await supabase
        .from('reviews')
        .insert({
          product_id: productId,
          author_name: user?.name,
          user_id: userId,
          rating,
          title: title.trim(),
          content: content.trim(),
          is_verified_purchase: Boolean(orderId),
          review_image_urls: uploadedImagesRef.current.map((img) => img.url),
        });

      if (insertError) {
        console.error('Failed to create review:', insertError);
        setError('리뷰 작성에 실패했습니다.');
        return;
      }

      didCreateReviewRef.current = true;
      router.replace('/reviews/my');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header back />

      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-xl font-bold text-gray-900 mb-4">리뷰 작성</h1>

        {!isAuthenticated ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">로그인이 필요합니다</p>
            <p className="text-sm text-gray-400 mb-6">
              리뷰를 작성하려면 로그인해주세요
            </p>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              로그인하기
            </button>
          </div>
        ) : !productId ? (
          <div className="text-center py-20">
            <p className="text-gray-600 mb-6">리뷰를 작성할 상품을 선택해주세요.</p>
            <button
              onClick={() => router.push('/home/my-page/orders')}
              className="px-6 py-3 bg-[#3B55A5] text-white rounded-lg font-medium hover:bg-[#2D4280] transition-colors"
            >
              주문 내역에서 선택
            </button>
          </div>
        ) : isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="text-gray-500 mt-4">상품 정보를 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 mb-4">
            {error}
          </div>
        ) : null}

        {existingReviewId && (
          <div className="bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg p-3 mb-4">
            이미 이 상품에 대한 리뷰를 작성했습니다.{' '}
            <button
              onClick={() => router.push('/reviews/my')}
              className="underline font-medium"
            >
              내 리뷰 보기
            </button>
          </div>
        )}

        {product && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex items-center gap-3">
            <div className="w-14 h-14 rounded-md border border-gray-200 bg-gray-100 overflow-hidden">
              {product.thumbnail_image_link?.[0] ? (
                <img
                  src={product.thumbnail_image_link[0]}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                  없음
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm text-gray-500">선택한 상품</div>
              <div className="font-medium text-gray-900">{product.title}</div>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">평점</label>
            <div className="flex items-center gap-2">
              <div className="flex text-orange-400">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className="p-1"
                    aria-label={`${value}점`}
                  >
                    <FaStar className={value <= rating ? 'text-orange-400' : 'text-gray-300'} size={20} />
                  </button>
                ))}
              </div>
              <span className="text-sm text-gray-600">{rating} / 5</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B55A5]"
              placeholder="리뷰 제목"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm min-h-[140px] focus:outline-none focus:ring-2 focus:ring-[#3B55A5]"
              placeholder="리뷰 내용을 입력해주세요."
              maxLength={2000}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">사진 (최대 3장)</label>
              <span className="text-xs text-gray-500">{uploadedImages.length}/3</span>
            </div>

            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploadingImages || uploadedImages.length >= 3}
              onChange={(e) => {
                void uploadSelectedFiles(e.target.files);
                e.currentTarget.value = '';
              }}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 disabled:opacity-50"
            />

            {uploadedImages.length > 0 ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {uploadedImages.map((img, idx) => (
                  <div key={img.path} className="relative rounded-md overflow-hidden border border-gray-200 bg-gray-50">
                    <img src={img.url} alt={`리뷰 사진 ${idx + 1}`} className="w-full h-24 object-cover" />
                    <button
                      type="button"
                      onClick={() => void removeUploadedImage(idx)}
                      className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded"
                      aria-label="사진 삭제"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {uploadingImages ? (
              <div className="text-xs text-gray-500 mt-2">사진 업로드 중...</div>
            ) : null}
          </div>

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={submitting || uploadingImages}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-800 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || uploadingImages || Boolean(existingReviewId)}
              className="flex-1 px-4 py-3 rounded-lg bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {existingReviewId ? '이미 작성한 리뷰가 있습니다' : submitting ? '등록 중...' : '리뷰 등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
