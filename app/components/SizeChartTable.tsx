'use client'

import { useState } from 'react'
import { X, Ruler } from 'lucide-react'

export interface SizingData {
  unit: string
  headers: string[]
  rows: Record<string, (number | string)[]>
  order?: string[]
}

interface SizeChartTableProps {
  sizingData: SizingData
  sizingChartImage?: string | null
  trigger?: React.ReactNode
}

export default function SizeChartTable({ sizingData, sizingChartImage, trigger }: SizeChartTableProps) {
  const [open, setOpen] = useState(false)
  const [imageExpanded, setImageExpanded] = useState(false)

  const sizeKeys = sizingData.order?.filter(k => k in sizingData.rows) ?? Object.keys(sizingData.rows)

  if (sizeKeys.length === 0) return null

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-xs text-[#0052CC] hover:opacity-80 font-medium transition-colors"
        >
          <Ruler className="w-3.5 h-3.5" />
          사이즈표
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">사이즈 가이드</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Measurement guide image */}
              {sizingChartImage && (
                <div className="px-5 pt-4">
                  <button
                    type="button"
                    onClick={() => setImageExpanded(!imageExpanded)}
                    className="w-full text-left"
                  >
                    <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                      <Ruler className="w-3 h-3" />
                      측정 방법 안내
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {imageExpanded ? '접기' : '펼치기'}
                      </span>
                    </p>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${imageExpanded ? 'max-h-[400px]' : 'max-h-[140px]'}`}>
                    <img
                      src={sizingChartImage}
                      alt="측정 방법 안내"
                      className="w-full object-contain rounded-lg border border-gray-100 cursor-pointer"
                      onClick={() => setImageExpanded(!imageExpanded)}
                    />
                  </div>
                </div>
              )}

              {/* All sizes table — always visible */}
              <div className="px-5 pt-3 pb-5">
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 pr-3 text-xs font-medium text-gray-500 sticky left-0 bg-white min-w-[52px]">
                          ({sizingData.unit})
                        </th>
                        {sizingData.headers.map(h => (
                          <th key={h} className="text-center py-3 px-2 text-xs font-medium text-gray-500 whitespace-nowrap min-w-[56px]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sizeKeys.map((size, rowIdx) => (
                        <tr
                          key={size}
                          className={rowIdx % 2 === 0 ? 'bg-gray-50/50' : ''}
                        >
                          <td className="py-3 pr-3 font-semibold text-gray-900 sticky left-0 bg-inherit">
                            {size}
                          </td>
                          {sizingData.rows[size].map((val, colIdx) => (
                            <td key={colIdx} className="text-center py-3 px-2 text-gray-700 tabular-nums">
                              {val ?? '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Unit note */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                단위: {sizingData.unit} · 측정 방법에 따라 1~3{sizingData.unit} 오차가 있을 수 있습니다
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
