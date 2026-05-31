'use client'
import React, { useState, useRef } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { ProductLayer, ProductSide, ColorOption } from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';

interface LayerColorSelectorProps {
  side: ProductSide;
}

const BODY_KEYWORDS = ['몸통', 'body', '바디'];

const LayerColorSelector: React.FC<LayerColorSelectorProps> = ({ side }) => {
  const { layerColors, setLayerColor } = useCanvasStore();

  const isMultiLayer = side.layers && side.layers.length > 0;
  const isSingleLayerWithColors = !isMultiLayer && side.colorOptions && side.colorOptions.length > 0;

  if (!isMultiLayer && !isSingleLayerWithColors) return null;

  const handleColorChange = (layerId: string, color: string) => {
    setLayerColor(side.id, layerId, color);
  };

  if (isMultiLayer) {
    const sortedLayers = [...side.layers!].sort((a, b) => a.zIndex - b.zIndex);

    // Find body layer by name, fallback to first layer
    const bodyLayer = sortedLayers.find(l =>
      BODY_KEYWORDS.some(kw => l.name.toLowerCase().includes(kw))
    ) || sortedLayers[0];
    const bodyColor = layerColors[side.id]?.[bodyLayer.id] || bodyLayer.colorOptions[0]?.hex || '#FFFFFF';

    return (
      <div className="w-full">
        <p className="text-xs font-semibold text-gray-500 mb-2">{side.name}</p>
        <div className="space-y-1.5">
          {sortedLayers.map((layer) => (
            <LayerAccordionItem
              key={layer.id}
              layer={layer}
              sideId={side.id}
              currentColor={layerColors[side.id]?.[layer.id] || layer.colorOptions[0]?.hex || '#FFFFFF'}
              onColorChange={(color) => handleColorChange(layer.id, color)}
              bodyColor={layer.id !== bodyLayer.id ? bodyColor : undefined}
            />
          ))}
        </div>
      </div>
    );
  }

  // Single-layer mode
  const currentColor = layerColors[side.id]?.[side.id] || side.colorOptions![0]?.hex || '#FFFFFF';

  return (
    <div className="w-full">
      <p className="text-xs font-semibold text-gray-500 mb-2">{side.name}</p>
      <div className="flex gap-2 flex-wrap">
        {side.colorOptions!.map((colorOption) => (
          <ColorSwatchButton
            key={colorOption.colorCode}
            colorOption={colorOption}
            selected={currentColor === colorOption.hex}
            onClick={() => handleColorChange(side.id, colorOption.hex)}
          />
        ))}
      </div>
    </div>
  );
};

function LayerAccordionItem({ layer, sideId, currentColor, onColorChange, bodyColor }: {
  layer: ProductLayer;
  sideId: string;
  currentColor: string;
  onColorChange: (color: string) => void;
  bodyColor?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const isSameAsBody = bodyColor !== undefined && currentColor === bodyColor;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full border border-gray-300 shrink-0"
            style={{ backgroundColor: currentColor }}
          />
          <span className="text-xs font-medium text-gray-700">{layer.name}</span>
          {isSameAsBody && (
            <span className="text-[10px] text-gray-400">몸통과 동일</span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-3 pb-2.5 bg-gray-50/50 space-y-2">
          {/* "Same as body" option */}
          {bodyColor !== undefined && (
            <button
              onClick={() => onColorChange(bodyColor)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition ${
                isSameAsBody
                  ? 'bg-blue-50 border border-blue-200 text-blue-700 font-medium'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div
                className="w-4 h-4 rounded-full border border-gray-300 shrink-0"
                style={{ backgroundColor: bodyColor }}
              />
              몸통과 동일
            </button>
          )}
          {/* Color swatches + custom picker */}
          <div className="flex gap-2 flex-wrap items-center">
            {layer.colorOptions.map((colorOption) => (
              <ColorSwatchButton
                key={colorOption.colorCode}
                colorOption={colorOption}
                selected={currentColor === colorOption.hex}
                onClick={() => onColorChange(colorOption.hex)}
              />
            ))}
            {/* Custom color picker */}
            <button
              onClick={() => colorInputRef.current?.click()}
              className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 hover:border-gray-400 flex items-center justify-center transition-all hover:scale-105"
              aria-label="커스텀 색상 선택"
            >
              <Plus className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={currentColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="sr-only"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ColorSwatchButton({ colorOption, selected, onClick }: {
  colorOption: ColorOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-full border-2 transition-all ${
        selected ? 'border-[#0052CC] scale-110 shadow-md' : 'border-gray-300 hover:border-gray-400 hover:scale-105'
      }`}
      style={{ backgroundColor: colorOption.hex }}
      aria-label={`${colorOption.colorCode} (${colorOption.hex})`}
    >
      {selected && (
        <svg className="w-full h-full p-1.5" fill="none" stroke={getContrastColor(colorOption.hex)} strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export default LayerColorSelector;
