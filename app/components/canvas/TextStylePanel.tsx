import React, { useState, useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Check,
  ChevronDown,
  Italic,
  Underline,
  Strikethrough,
  Type,
  Palette,
  CircleDot,
  LetterText,
  Baseline,
  CaseSensitive,
  Upload,
  AlertTriangle,
  Waves,
  Pencil,
} from 'lucide-react';
import { useFontStore } from '@/store/useFontStore';
import { uploadFont, isValidFontFile } from '@/lib/fontUtils';
import { createClient } from '@/lib/supabase-client';
import {
  CurvedText,
  isCurvedText,
  convertToCurvedText,
} from '@/lib/curvedText';
import { SYSTEM_FONT_NAMES } from '@/lib/fontConfig';

interface TextStylePanelProps {
  selectedObject: fabric.IText | fabric.Text;
  onClose?: () => void;
  layout?: 'modal' | 'sidebar'; // Add layout mode
}

const TextStylePanel: React.FC<TextStylePanelProps> = ({ selectedObject, onClose, layout = 'modal' }) => {
  const [activeTab, setActiveTab] = useState<'font' | 'colors' | 'spacing' | 'warp'>('font');
  const [fontFamily, setFontFamily] = useState<string>('Arial');
  const [fontSize, setFontSize] = useState<number>(30);
  const [fillColor, setFillColor] = useState<string>('#333333');
  const [strokeColor, setStrokeColor] = useState<string>('#000000');
  const [strokeWidth, setStrokeWidth] = useState<number>(0);
  const [textAlign, setTextAlign] = useState<string>('left');
  const [fontWeight, setFontWeight] = useState<string>('normal');
  const [fontStyle, setFontStyle] = useState<string>('normal');
  const [underline, setUnderline] = useState<boolean>(false);
  const [linethrough, setLinethrough] = useState<boolean>(false);
  const [lineHeight, setLineHeight] = useState<number>(1.16);
  const [charSpacing, setCharSpacing] = useState<number>(0);
  const [textBackgroundColor, setTextBackgroundColor] = useState<string>('');
  const [opacity, setOpacity] = useState<number>(1);
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [isUploadingFont, setIsUploadingFont] = useState(false);
  const [showCopyrightNotice, setShowCopyrightNotice] = useState(false);
  const [uploadedFontName, setUploadedFontName] = useState<string>('');

  // Font upload modal state
  const [showFontUploadModal, setShowFontUploadModal] = useState(false);
  const [fontUploadAgreed, setFontUploadAgreed] = useState(false);
  const fontFileInputRef = useRef<HTMLInputElement | null>(null);

  // Curve state
  const [curveIntensity, setCurveIntensity] = useState<number>(0);

  // Text edit modal state
  const [showTextEditModal, setShowTextEditModal] = useState(false);
  const [editingText, setEditingText] = useState('');

  // Get custom fonts from store
  const { customFonts, addFont, loadAllFonts } = useFontStore();

  // System font families from shared config
  const systemFonts = SYSTEM_FONT_NAMES;

  // Initialize state from selected object
  useEffect(() => {
    if (selectedObject) {
      setFontFamily((selectedObject.fontFamily as string) || 'Arial');
      setFontSize((selectedObject.fontSize as number) || 30);
      setFillColor((selectedObject.fill as string) || '#333333');
      setStrokeColor((selectedObject.stroke as string) || '#000000');
      setStrokeWidth((selectedObject.strokeWidth as number) || 0);
      setTextAlign((selectedObject.textAlign as string) || 'left');
      setFontWeight((selectedObject.fontWeight as string) || 'normal');
      setFontStyle((selectedObject.fontStyle as string) || 'normal');
      setUnderline(selectedObject.underline || false);
      setLinethrough(selectedObject.linethrough || false);
      setLineHeight((selectedObject.lineHeight as number) || 1.16);
      setCharSpacing((selectedObject.charSpacing as number) || 0);
      setTextBackgroundColor((selectedObject.textBackgroundColor as string) || '');
      setOpacity((selectedObject.opacity as number) || 1);

      // Initialize curve state if object is a CurvedText
      // UI uses 0-100 (0=straight, 100=max curve), internal uses negative for upward curve
      if (isCurvedText(selectedObject)) {
        const internalValue = (selectedObject as CurvedText).curveIntensity || 0;
        setCurveIntensity(Math.abs(internalValue)); // Convert internal to UI value
      } else {
        setCurveIntensity(0);
      }
    }
  }, [selectedObject]);

  useEffect(() => {
    setIsFontDropdownOpen(false);
  }, [activeTab, selectedObject]);

  useEffect(() => {
    if (!isFontDropdownOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFontDropdownOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFontDropdownOpen]);

  // Update selected object properties
  const updateTextProperty = (property: string, value: any) => {
    if (selectedObject) {
      selectedObject.set(property as keyof fabric.IText, value);
      selectedObject.canvas?.renderAll();
    }
  };

  const handleFontFamilyChange = (value: string, fontUrl?: string) => {
    setFontFamily(value);

    // Find font URL from customFonts if not provided
    let url = fontUrl;
    if (!url) {
      const customFont = customFonts.find(f => f.fontFamily === value);
      if (customFont) {
        url = customFont.url;
      }
    }

    if (selectedObject && isCurvedText(selectedObject)) {
      // Use setFont for CurvedText to update bounds
      (selectedObject as CurvedText).setFont(value);
    } else if (selectedObject) {
      updateTextProperty('fontFamily', value);
      // Store fontUrl in data for SVG export path conversion
      if (url) {
        const existingData = (selectedObject as any).data || {};
        (selectedObject as any).data = { ...existingData, fontUrl: url };
      }
    }
  };

  const handleFontSizeChange = (value: number) => {
    setFontSize(value);
    if (selectedObject && isCurvedText(selectedObject)) {
      // Use setFontSize for CurvedText to update bounds
      (selectedObject as CurvedText).setFontSize(value);
    } else {
      updateTextProperty('fontSize', value);
    }
  };

  const handleFillColorChange = (value: string) => {
    setFillColor(value);
    if (selectedObject && isCurvedText(selectedObject)) {
      const curved = selectedObject as CurvedText;
      curved.fill = value;
      curved.dirty = true;
      curved.canvas?.requestRenderAll();
    } else {
      updateTextProperty('fill', value);
    }
  };

  const handleStrokeColorChange = (value: string) => {
    setStrokeColor(value);
    if (selectedObject && isCurvedText(selectedObject)) {
      const curved = selectedObject as CurvedText;
      curved.stroke = value;
      curved.dirty = true;
      curved.canvas?.requestRenderAll();
    } else {
      updateTextProperty('stroke', value);
    }
  };

  const handleStrokeWidthChange = (value: number) => {
    setStrokeWidth(value);
    if (selectedObject && isCurvedText(selectedObject)) {
      const curved = selectedObject as CurvedText;
      curved.strokeWidth = value;
      curved.dirty = true;
      curved.canvas?.requestRenderAll();
    } else {
      updateTextProperty('strokeWidth', value);
      updateTextProperty('paintFirst', 'stroke');
    }
  };

  const handleTextAlignChange = (value: string) => {
    setTextAlign(value);
    updateTextProperty('textAlign', value);
  };

  const toggleBold = () => {
    const newWeight = fontWeight === 'bold' ? 'normal' : 'bold';
    setFontWeight(newWeight);
    if (selectedObject && isCurvedText(selectedObject)) {
      const curved = selectedObject as CurvedText;
      curved.fontWeight = newWeight;
      curved.updateBounds();
    } else {
      updateTextProperty('fontWeight', newWeight);
    }
  };

  const toggleItalic = () => {
    const newStyle = fontStyle === 'italic' ? 'normal' : 'italic';
    setFontStyle(newStyle);
    if (selectedObject && isCurvedText(selectedObject)) {
      const curved = selectedObject as CurvedText;
      curved.fontStyle = newStyle;
      curved.updateBounds();
    } else {
      updateTextProperty('fontStyle', newStyle);
    }
  };

  const toggleUnderline = () => {
    const newUnderline = !underline;
    setUnderline(newUnderline);
    updateTextProperty('underline', newUnderline);
  };

  const toggleLinethrough = () => {
    const newLinethrough = !linethrough;
    setLinethrough(newLinethrough);
    updateTextProperty('linethrough', newLinethrough);
  };

  const handleLineHeightChange = (value: number) => {
    setLineHeight(value);
    updateTextProperty('lineHeight', value);
  };

  const handleCharSpacingChange = (value: number) => {
    setCharSpacing(value);
    if (selectedObject && isCurvedText(selectedObject)) {
      // Use setCharSpacing for CurvedText to update bounds
      (selectedObject as CurvedText).setCharSpacing(value);
    } else {
      updateTextProperty('charSpacing', value);
    }
  };

  const handleTextBackgroundColorChange = (value: string) => {
    setTextBackgroundColor(value);
    updateTextProperty('textBackgroundColor', value);
  };

  const handleOpacityChange = (value: number) => {
    setOpacity(value);
    if (selectedObject && isCurvedText(selectedObject)) {
      const curved = selectedObject as CurvedText;
      curved.opacity = value;
      curved.dirty = true;
      curved.canvas?.requestRenderAll();
    } else {
      updateTextProperty('opacity', value);
    }
  };

  // Handle font file upload
  const handleFontUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate font file
    if (!isValidFontFile(file)) {
      alert('유효하지 않은 폰트 파일입니다. 지원 형식: .ttf, .otf, .woff, .woff2');
      return;
    }

    setIsUploadingFont(true);

    try {
      const supabase = createClient();
      const result = await uploadFont(supabase, file);

      if (result.success && result.fontMetadata) {
        // Add font to store
        addFont(result.fontMetadata);

        // Load the font into the browser
        await loadAllFonts();

        // Apply the font to selected text (pass URL so it's stored on the fabric object)
        handleFontFamilyChange(result.fontMetadata.fontFamily, result.fontMetadata.url);

        // Show copyright notice modal
        setUploadedFontName(result.fontMetadata.fontFamily);
        setShowCopyrightNotice(true);
      } else {
        alert(`폰트 업로드 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Font upload error:', error);
      alert('폰트 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploadingFont(false);
      // Reset file input
      if (fontFileInputRef.current) {
        fontFileInputRef.current.value = '';
      }
    }
  };

  const handleFontUploadClick = () => {
    setFontUploadAgreed(false);
    setShowFontUploadModal(true);
  };

  const handleFontUploadConfirm = () => {
    if (!fontUploadAgreed) return;
    setShowFontUploadModal(false);
    fontFileInputRef.current?.click();
  };

  // Handle live curve intensity change
  // UI uses 0-100 (0=straight, 100=max curve), internal uses negative for upward curve
  const handleCurveIntensityChange = (intensity: number) => {
    setCurveIntensity(intensity);

    if (!selectedObject) return;

    // Convert UI value (0-100) to internal value (0 to -100)
    const internalIntensity = -intensity;

    if (isCurvedText(selectedObject)) {
      // Already a CurvedText, just update the curve
      (selectedObject as CurvedText).setCurve(internalIntensity);
    } else if (intensity > 0) {
      // Convert regular text to CurvedText instantly when intensity > 0
      try {
        convertToCurvedText(selectedObject, internalIntensity);
      } catch (error) {
        console.error('Error converting to curved text:', error);
      }
    }
  };

  // Open text edit modal - works for both regular text and CurvedText
  const handleOpenTextEdit = () => {
    if (!selectedObject) return;

    if (isCurvedText(selectedObject)) {
      setEditingText((selectedObject as CurvedText).text);
    } else {
      // Regular IText/Text object
      setEditingText(selectedObject.text || '');
    }
    setShowTextEditModal(true);
  };

  // Save edited text - works for both regular text and CurvedText
  const handleSaveText = () => {
    if (!selectedObject) {
      setShowTextEditModal(false);
      return;
    }

    if (isCurvedText(selectedObject)) {
      (selectedObject as CurvedText).setText(editingText);
    } else {
      // Regular IText/Text object
      selectedObject.set('text', editingText);
      selectedObject.canvas?.renderAll();
    }
    setShowTextEditModal(false);
  };

  // Cancel text editing
  const handleCancelTextEdit = () => {
    setShowTextEditModal(false);
    setEditingText('');
  };

  return (
    <>
    {/* Font Upload Agreement Modal */}
    {showFontUploadModal && (
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30 backdrop-blur-sm"
        onClick={() => setShowFontUploadModal(false)}
      >
        <div
          className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-bold mb-4">폰트 파일 안내</h2>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              커스텀 폰트 사용 시 <strong className="text-black">저작권 및 사용 범위에 대한 모든 책임은 사용자에게 있습니다.</strong>
            </p>
            <p>
              상업적 용도로 사용하기 전에 해당 폰트의 라이선스를 반드시 확인해 주세요.
            </p>
          </div>
          <label className="flex items-start gap-3 mt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={fontUploadAgreed}
              onChange={(e) => setFontUploadAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
            />
            <span className="text-sm text-gray-700">
              위 내용을 확인했습니다.
            </span>
          </label>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowFontUploadModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              취소
            </button>
            <button
              onClick={handleFontUploadConfirm}
              disabled={!fontUploadAgreed}
              className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Font Selection Modal */}
    {isFontDropdownOpen && (
      <div
        className="fixed inset-0 z-200 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        onClick={() => setIsFontDropdownOpen(false)}
      >
        <div
          className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden max-h-[70vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">글꼴 선택</h2>
            <button
              onClick={() => setIsFontDropdownOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              &times;
            </button>
          </div>

          {/* Font Upload Button */}
          <div className="p-3 border-b border-gray-200">
            <button
              type="button"
              onClick={handleFontUploadClick}
              disabled={isUploadingFont}
              className="w-full px-3 py-2 flex items-center gap-2 text-left bg-blue-50 hover:bg-blue-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="size-4 text-blue-600" />
              <span className="flex-1 text-sm font-medium text-blue-600">
                {isUploadingFont ? '업로드 중...' : '커스텀 폰트 업로드'}
              </span>
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* Custom Fonts */}
            {customFonts.length > 0 && (
              <div className="border-b border-gray-100">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                  커스텀 폰트
                </div>
                {customFonts.map((customFont) => {
                  const isSelected = customFont.fontFamily === fontFamily;
                  return (
                    <button
                      key={customFont.fontFamily}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        handleFontFamilyChange(customFont.fontFamily);
                        setIsFontDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-gray-50 ${
                        isSelected ? 'bg-gray-100' : ''
                      }`}
                    >
                      <span className="w-4 shrink-0">
                        {isSelected ? <Check className="size-4" /> : null}
                      </span>
                      <span className="flex-1 min-w-0 truncate" style={{ fontFamily: customFont.fontFamily }}>
                        {customFont.fontFamily}
                      </span>
                      <span className="shrink-0 text-sm text-gray-500" style={{ fontFamily: customFont.fontFamily }}>
                        Aa 가나다
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* System Fonts */}
            {systemFonts.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                  시스템 폰트
                </div>
                {systemFonts.map((font) => {
                  const isSelected = font === fontFamily;
                  return (
                    <button
                      key={font}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        handleFontFamilyChange(font);
                        setIsFontDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-gray-50 ${
                        isSelected ? 'bg-gray-100' : ''
                      }`}
                    >
                      <span className="w-4 shrink-0">
                        {isSelected ? <Check className="size-4" /> : null}
                      </span>
                      <span className="flex-1 min-w-0 truncate" style={{ fontFamily: font }}>
                        {font}
                      </span>
                      <span className="shrink-0 text-sm text-gray-500" style={{ fontFamily: font }}>
                        Aa 가나다
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Copyright Notice Modal */}
    {showCopyrightNotice && (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl shadow-xl max-w-sm mx-4 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-full">
                <AlertTriangle className="size-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">저작권 안내</h3>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              폰트 <span className="font-semibold">&quot;{uploadedFontName}&quot;</span>가 성공적으로 업로드되었습니다.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-gray-700 text-sm leading-relaxed">
                커스텀 폰트 사용 시 <span className="font-semibold text-amber-700">저작권 및 사용 범위에 대한 모든 책임은 사용자에게 있습니다.</span>
              </p>
              <p className="text-gray-600 text-xs mt-2">
                상업적 용도로 사용하기 전에 해당 폰트의 라이선스를 반드시 확인해 주세요.
              </p>
            </div>
            <button
              onClick={() => setShowCopyrightNotice(false)}
              className="w-full py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Text Edit Modal */}
    {showTextEditModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-full">
                <Pencil className="size-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">텍스트 편집</h3>
            </div>
            <textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              placeholder="텍스트를 입력하세요"
              className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCancelTextEdit}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
              >
                취소
              </button>
              <button
                onClick={handleSaveText}
                className="flex-1 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    <div className={layout === 'sidebar' ? '' : 'fixed inset-x-0 bottom-0 z-50 animate-slide-up'}>
      <div className={layout === 'sidebar' ? 'flex flex-col h-full' : 'border-t rounded-t-2xl bg-white border-gray-200 shadow-2xl h-[34vh] flex flex-col px-4'}>
        {/* Header with Tabs */}
        <div className="shrink-0 sticky top-0 border-b border-gray-100">
          {layout === 'modal' && (
            <div className='py-3 w-10 mx-auto'>
              <hr className='border-2 border-black/20 rounded-full'/>
            </div>
          )}

          {/* Tabs */}
          <div className="flex">
            <button
              onClick={() => setActiveTab('font')}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'font'
                  ? 'bg-black text-white rounded-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              폰트
            </button>
            <button
              onClick={() => setActiveTab('colors')}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'colors'
                  ? 'bg-black text-white rounded-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              색상
            </button>
            <button
              onClick={() => setActiveTab('spacing')}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'spacing'
                  ? 'bg-black text-white rounded-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              간격
            </button>
            <button
              onClick={() => setActiveTab('warp')}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'warp'
                  ? 'bg-black text-white rounded-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              변형
            </button>
            {/* Persistent Edit Button */}
            <button
              onClick={handleOpenTextEdit}
              className="ml-2 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center"
              title="텍스트 편집"
            >
              <Pencil className="size-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className={`flex-1 overflow-y-auto space-y-4 ${layout === 'sidebar' ? 'p-3' : 'p-4'}`}>
          {/* Font Tab */}
          {activeTab === 'font' && (
            <>
              {/* Font Family */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Type className="size-4" />
                  글꼴
                </label>
                <button
                  type="button"
                  onClick={() => setIsFontDropdownOpen(true)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent flex items-center justify-between gap-2"
                >
                  <span className="truncate" style={{ fontFamily }}>
                    {fontFamily}
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-gray-600" />
                </button>
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <CaseSensitive className="size-4" />
                  크기: {fontSize}px
                </label>
                <input
                  type="range"
                  min="8"
                  max="200"
                  value={fontSize}
                  onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Text Alignment */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">정렬</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTextAlignChange('left')}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      textAlign === 'left'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <AlignLeft className="size-5 mx-auto" />
                  </button>
                  <button
                    onClick={() => handleTextAlignChange('center')}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      textAlign === 'center'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <AlignCenter className="size-5 mx-auto" />
                  </button>
                  <button
                    onClick={() => handleTextAlignChange('right')}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      textAlign === 'right'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <AlignRight className="size-5 mx-auto" />
                  </button>
                  <button
                    onClick={() => handleTextAlignChange('justify')}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      textAlign === 'justify'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <AlignJustify className="size-5 mx-auto" />
                  </button>
                </div>
              </div>

              {/* Text Decorations */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">텍스트 스타일</label>
                <div className="flex gap-2">
                  <button
                    onClick={toggleBold}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      fontWeight === 'bold'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Bold className="size-5 mx-auto" />
                  </button>
                  <button
                    onClick={toggleItalic}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      fontStyle === 'italic'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Italic className="size-5 mx-auto" />
                  </button>
                  <button
                    onClick={toggleUnderline}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      underline
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Underline className="size-5 mx-auto" />
                  </button>
                  <button
                    onClick={toggleLinethrough}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      linethrough
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Strikethrough className="size-5 mx-auto" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Colors Tab */}
          {activeTab === 'colors' && (
            <>
              {/* Fill Color */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Palette className="size-4" />
                  글자 색상
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={fillColor}
                    onChange={(e) => handleFillColorChange(e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={fillColor}
                    onChange={(e) => handleFillColorChange(e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Stroke Color */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <CircleDot className="size-4" />
                  테두리 색상
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => handleStrokeColorChange(e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={strokeColor}
                    onChange={(e) => handleStrokeColorChange(e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Stroke Width */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  테두리 두께: {strokeWidth}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={strokeWidth}
                  onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Text Background Color */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  배경 색상
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={textBackgroundColor || '#ffffff'}
                    onChange={(e) => handleTextBackgroundColorChange(e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={textBackgroundColor}
                    onChange={(e) => handleTextBackgroundColorChange(e.target.value)}
                    placeholder="투명"
                    className="flex-1 p-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={() => handleTextBackgroundColorChange('')}
                    className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition"
                  >
                    제거
                  </button>
                </div>
              </div>

              {/* Opacity */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  투명도: {Math.round(opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={opacity}
                  onChange={(e) => handleOpacityChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </>
          )}

          {/* Spacing Tab */}
          {activeTab === 'spacing' && (
            <>
              {/* Line Height */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Baseline className="size-4" />
                  줄 간격: {lineHeight.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={lineHeight}
                  onChange={(e) => handleLineHeightChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Character Spacing */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <LetterText className="size-4" />
                  자간: {charSpacing}
                </label>
                <input
                  type="range"
                  min="-200"
                  max="800"
                  step="10"
                  value={charSpacing}
                  onChange={(e) => handleCharSpacingChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </>
          )}

          {/* Warp Tab */}
          {activeTab === 'warp' && (
            <>
              {/* Curve Intensity Slider */}
              <div className="space-y-4">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Waves className="size-4" />
                  곡선 변형
                </label>

                {/* Preset buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCurveIntensityChange(0)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition ${
                      curveIntensity === 0
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    직선
                  </button>
                  <button
                    onClick={() => handleCurveIntensityChange(30)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition ${
                      curveIntensity === 30
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    ⌒ 30%
                  </button>
                  <button
                    onClick={() => handleCurveIntensityChange(100)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition ${
                      curveIntensity === 100
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    ⌒ 100%
                  </button>
                </div>

                {/* Slider */}
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={curveIntensity}
                    onChange={(e) => handleCurveIntensityChange(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">강도: {curveIntensity}%</span>
                    <button
                      onClick={() => handleCurveIntensityChange(0)}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                    >
                      초기화
                    </button>
                  </div>
                </div>
              </div>

              {/* Info text */}
              <p className="text-xs text-gray-500 text-center pt-2">
                변형이 실시간으로 적용됩니다.
              </p>
            </>
          )}
        </div>
      </div>
    </div>

    {/* Hidden file input for font upload - always in DOM */}
    <input
      ref={fontFileInputRef}
      type="file"
      accept=".ttf,.otf,.woff,.woff2"
      onChange={handleFontUpload}
      className="hidden"
    />
    </>
  );
};

export default TextStylePanel;
