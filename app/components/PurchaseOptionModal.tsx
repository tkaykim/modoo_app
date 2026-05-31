'use client'

import { X } from 'lucide-react'

interface PurchaseOptionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectCoBuy: () => void
  onSelectCart: () => void
  isDisabled?: boolean
}

export default function PurchaseOptionModal({
  isOpen,
  onClose,
  onSelectCoBuy,
  onSelectCart,
  isDisabled = false,
}: PurchaseOptionModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!isDisabled ? onClose : undefined}
      />

      <div className="relative bg-white rounded-lg w-full max-w-sm shadow-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-900">구매 방법 선택</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isDisabled}
            className="p-1 hover:bg-gray-100 rounded-full transition disabled:opacity-50"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          어떻게 진행할까요?
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={onSelectCoBuy}
              disabled={isDisabled}
              className="w-full py-3 bg-[#0052CC] text-white rounded-lg font-medium hover:bg-[#003D99] transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              공동구매하기
            </button>
            <p className="text-xs text-gray-400 text-center">
              링크 하나로 공동 구매 간편하게 개설하기
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={onSelectCart}
              disabled={isDisabled}
              className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              장바구니에 담기
            </button>
            <p className="text-xs text-gray-400 text-center">
              수량 선택하고 장바구니에 담기
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

