'use client'
import React from 'react'
import { X } from 'lucide-react'
import { ProductSide, ProductColor } from '@/types/types'
import { useCanvasStore } from '@/store/useCanvasStore'
import LayerColorSelector from './LayerColorSelector'

interface ColorSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  side: ProductSide
  productColors: ProductColor[]
}

export default function ColorSelectorModal({
  isOpen,
  onClose,
  side,
  productColors,
}: ColorSelectorModalProps) {
  const { productColor, setProductColor } = useCanvasStore()

  if (!isOpen) return null

  const hasLayers = side.layers && side.layers.length > 0
  const hasColorOptions = side.colorOptions && side.colorOptions.length > 0
  const hasLegacyColors = productColors.length > 0

  if (!hasLayers && !hasColorOptions && !hasLegacyColors) return null

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end justify-center z-[200]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl w-full max-w-lg max-h-[70vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="text-sm font-semibold">색상 선택</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Color Content */}
        <div className="p-4">
          {(hasLayers || hasColorOptions) ? (
            <LayerColorSelector side={side} />
          ) : hasLegacyColors ? (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-3">색상을 선택해주세요</p>
              <div className="flex flex-wrap gap-3">
                {productColors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setProductColor(color.manufacturer_colors.hex)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        productColor === color.manufacturer_colors.hex
                          ? 'border-black scale-110'
                          : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color.manufacturer_colors.hex }}
                    />
                    <span className="text-[10px] text-gray-600">{color.manufacturer_colors.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
