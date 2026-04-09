'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { CoBuyParticipant, CoBuySelectedItem, CoBuyCustomField } from '@/types/types';

interface CoBuyParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ParticipantFormData) => Promise<void>;
  participant?: CoBuyParticipant | null;
  customFields?: CoBuyCustomField[];
  sizeOptions?: string[];
  /** 사이즈별 개별 가격 (없으면 basePrice 사용) */
  sizePrices?: Record<string, number> | null;
  /** 기본 단가 (size_prices에 해당 사이즈가 없을 때 fallback) */
  basePrice?: number | null;
}

export interface ParticipantFormData {
  name: string;
  email: string;
  phone: string;
  selectedItems: CoBuySelectedItem[];
  fieldResponses: Record<string, string>;
  deliveryMethod: 'pickup' | 'delivery' | null;
}

export default function CoBuyParticipantModal({
  isOpen,
  onClose,
  onSave,
  participant,
  customFields,
  sizeOptions = [],
  sizePrices,
  basePrice,
}: CoBuyParticipantModalProps) {
  const isEditing = !!participant;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedItems, setSelectedItems] = useState<CoBuySelectedItem[]>([{ size: '', quantity: 1 }]);
  const [fieldResponses, setFieldResponses] = useState<Record<string, string>>({});
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery' | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (participant) {
        setName(participant.name);
        setEmail(participant.email);
        setPhone(participant.phone || '');
        setSelectedItems(
          participant.selected_items?.length
            ? participant.selected_items
            : [{ size: participant.selected_size || '', quantity: participant.total_quantity || 1 }]
        );
        setFieldResponses(participant.field_responses || {});
        setDeliveryMethod(participant.delivery_method || null);
      } else {
        setName('');
        setEmail('');
        setPhone('');
        setSelectedItems([{ size: sizeOptions[0] || '', quantity: 1 }]);
        setFieldResponses({});
        setDeliveryMethod(null);
      }
      setError(null);
    }
  }, [isOpen, participant, sizeOptions]);

  const handleAddSizeRow = () => {
    setSelectedItems([...selectedItems, { size: sizeOptions[0] || '', quantity: 1 }]);
  };

  const handleRemoveSizeRow = (index: number) => {
    if (selectedItems.length <= 1) return;
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const handleSizeChange = (index: number, field: 'size' | 'quantity', value: string | number) => {
    const updated = [...selectedItems];
    if (field === 'size') {
      updated[index] = { ...updated[index], size: value as string };
    } else {
      updated[index] = { ...updated[index], quantity: Math.max(1, value as number) };
    }
    setSelectedItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('이름과 이메일은 필수입니다.');
      return;
    }
    if (selectedItems.some(item => !item.size.trim())) {
      setError('사이즈를 선택해주세요.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        selectedItems,
        fieldResponses,
        deliveryMethod,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const editableCustomFields = customFields?.filter(f => f.id !== 'size' && !f.fixed) || [];

  const getUnitPrice = (size: string): number | null => {
    if (sizePrices && size && sizePrices[size] != null) return sizePrices[size];
    if (typeof basePrice === 'number') return basePrice;
    return null;
  };

  const hasPriceInfo = !!(sizePrices && Object.keys(sizePrices).length > 0) || typeof basePrice === 'number';

  const estimatedTotal = useMemo(() => {
    if (!hasPriceInfo) return null;
    let total = 0;
    for (const item of selectedItems) {
      const p = getUnitPrice(item.size);
      if (p == null) return null;
      total += p * item.quantity;
    }
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, sizePrices, basePrice]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">
            {isEditing ? '참여자 수정' : '참여자 추가'}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">이름 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-black focus:border-black"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">이메일 *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-black focus:border-black"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">전화번호</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">사이즈 / 수량 *</label>
              <button
                type="button"
                onClick={handleAddSizeRow}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-black"
              >
                <Plus className="w-3 h-3" /> 추가
              </button>
            </div>
            <div className="space-y-2">
              {selectedItems.map((item, index) => {
                const unitPrice = getUnitPrice(item.size);
                const lineTotal = unitPrice != null ? unitPrice * item.quantity : null;
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center gap-2">
                      {sizeOptions.length > 0 ? (
                        <select
                          value={item.size}
                          onChange={(e) => handleSizeChange(index, 'size', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">사이즈 선택</option>
                          {sizeOptions.map(s => {
                            const p = getUnitPrice(s);
                            return (
                              <option key={s} value={s}>
                                {s}{p != null ? ` (₩${p.toLocaleString()})` : ''}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={item.size}
                          onChange={(e) => handleSizeChange(index, 'size', e.target.value)}
                          placeholder="사이즈"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      )}
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleSizeChange(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center"
                      />
                      {selectedItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSizeRow(index)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {lineTotal != null && (
                      <p className="text-xs text-gray-500 pl-1">
                        단가 ₩{unitPrice!.toLocaleString()} × {item.quantity} = ₩{lineTotal.toLocaleString()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {estimatedTotal != null && (
              <div className="mt-3 pt-2 border-t border-gray-200 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">예상 합계</span>
                <span className="text-sm font-semibold text-gray-900">₩{estimatedTotal.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">수령 방법</label>
            <select
              value={deliveryMethod || ''}
              onChange={(e) => setDeliveryMethod((e.target.value || null) as 'pickup' | 'delivery' | null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">미지정</option>
              <option value="pickup">직접 수령</option>
              <option value="delivery">배송</option>
            </select>
          </div>

          {editableCustomFields.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-medium text-gray-700">추가 정보</label>
              {editableCustomFields.map((field) => (
                <div key={field.id}>
                  <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                  {field.type === 'dropdown' ? (
                    <select
                      value={fieldResponses[field.id] || ''}
                      onChange={(e) => setFieldResponses({ ...fieldResponses, [field.id]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">선택</option>
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                      value={fieldResponses[field.id] || ''}
                      onChange={(e) => setFieldResponses({ ...fieldResponses, [field.id]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              {saving ? '저장 중...' : isEditing ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
