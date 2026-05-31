'use client'

import React, { useState, useEffect } from 'react';
import Script from 'next/script';
import { CoBuyCustomField, CoBuySelectedItem, CoBuyDeliverySettings, CoBuyDeliveryMethod, CoBuyDeliveryInfo } from '@/types/types';
import { Plus, Minus, Trash2, Truck, MapPin, Search } from 'lucide-react';

interface ParticipantFormProps {
  customFields: CoBuyCustomField[];
  sizeOptions: string[];
  onSubmit: (data: ParticipantFormData) => void;
  isSubmitting?: boolean;
  pricePerItem?: number;
  deliverySettings?: CoBuyDeliverySettings | null; // Delivery configuration
}

export interface ParticipantFormData {
  name: string;
  email: string;
  phone?: string;
  selectedSize: string; // Legacy - primary size for backward compatibility
  selectedItems: CoBuySelectedItem[]; // New - supports multiple sizes with quantities
  fieldResponses: Record<string, string>;
  deliveryMethod: CoBuyDeliveryMethod | null;
  deliveryInfo: CoBuyDeliveryInfo | null;
  deliveryFee: number;
}

const ParticipantForm: React.FC<ParticipantFormProps> = ({
  customFields,
  sizeOptions,
  onSubmit,
  isSubmitting = false,
  pricePerItem = 0,
  deliverySettings = null,
}) => {
  const [formData, setFormData] = useState<ParticipantFormData>({
    name: '',
    email: '',
    phone: '',
    selectedSize: '',
    selectedItems: [{ size: '', quantity: 1 }], // Start with one item
    fieldResponses: {},
    deliveryMethod: deliverySettings?.enabled ? null : 'pickup', // Default to pickup if delivery not enabled
    deliveryInfo: null,
    deliveryFee: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPostcodeScriptLoaded, setIsPostcodeScriptLoaded] = useState(false);

  // Check if Daum Postcode script is already loaded
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).daum?.Postcode) {
      setIsPostcodeScriptLoaded(true);
    }
  }, []);

  // Handle Daum Postcode API address search
  const handleAddressSearch = () => {
    if (!(window as any).daum?.Postcode) {
      alert('주소 검색 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        setFormData(prev => ({
          ...prev,
          deliveryInfo: {
            recipientName: prev.deliveryInfo?.recipientName || '',
            phone: prev.deliveryInfo?.phone || '',
            address: data.roadAddress || data.jibunAddress,
            addressDetail: prev.deliveryInfo?.addressDetail || '',
            postalCode: data.zonecode,
            memo: prev.deliveryInfo?.memo || '',
          },
        }));
        // Clear address-related errors
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.address;
          delete newErrors.postalCode;
          return newErrors;
        });
      }
    }).open();
  };

  const handleInputChange = (fieldId: string, value: string) => {
    if (fieldId === 'name' || fieldId === 'email' || fieldId === 'phone' || fieldId === 'selectedSize') {
      setFormData(prev => ({ ...prev, [fieldId]: value }));
    } else {
      setFormData(prev => ({
        ...prev,
        fieldResponses: { ...prev.fieldResponses, [fieldId]: value }
      }));
    }

    // Clear error for this field
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldId];
      return newErrors;
    });
  };

  // Handle selected items (size + quantity)
  const handleItemSizeChange = (index: number, size: string) => {
    setFormData(prev => {
      const newItems = [...prev.selectedItems];
      newItems[index] = { ...newItems[index], size };
      // Update legacy selectedSize with the first item's size
      const selectedSize = newItems[0]?.size || '';
      return { ...prev, selectedItems: newItems, selectedSize };
    });
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`item-${index}-size`];
      return newErrors;
    });
  };

  const handleItemQuantityChange = (index: number, quantity: number) => {
    setFormData(prev => {
      const newItems = [...prev.selectedItems];
      newItems[index] = { ...newItems[index], quantity: Math.max(1, quantity) };
      return { ...prev, selectedItems: newItems };
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      selectedItems: [...prev.selectedItems, { size: '', quantity: 1 }]
    }));
  };

  const removeItem = (index: number) => {
    if (formData.selectedItems.length <= 1) return; // Keep at least one item
    setFormData(prev => {
      const newItems = prev.selectedItems.filter((_, i) => i !== index);
      // Update legacy selectedSize with the first item's size
      const selectedSize = newItems[0]?.size || '';
      return { ...prev, selectedItems: newItems, selectedSize };
    });
  };

  // Handle delivery method change
  const handleDeliveryMethodChange = (method: CoBuyDeliveryMethod) => {
    const fee = method === 'delivery' ? (deliverySettings?.deliveryFee || 0) : 0;
    setFormData(prev => ({
      ...prev,
      deliveryMethod: method,
      deliveryFee: fee,
      deliveryInfo: method === 'pickup' ? null : prev.deliveryInfo,
    }));
    // Clear delivery-related errors
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.deliveryMethod;
      if (method === 'pickup') {
        delete newErrors.recipientName;
        delete newErrors.deliveryPhone;
        delete newErrors.address;
        delete newErrors.addressDetail;
        delete newErrors.postalCode;
      }
      return newErrors;
    });
  };

  // Handle delivery info change
  const handleDeliveryInfoChange = (field: keyof CoBuyDeliveryInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      deliveryInfo: {
        recipientName: prev.deliveryInfo?.recipientName || '',
        phone: prev.deliveryInfo?.phone || '',
        address: prev.deliveryInfo?.address || '',
        addressDetail: prev.deliveryInfo?.addressDetail || '',
        postalCode: prev.deliveryInfo?.postalCode || '',
        memo: prev.deliveryInfo?.memo || '',
        [field]: value,
      },
    }));
    // Clear error for this field
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field === 'phone' ? 'deliveryPhone' : field];
      return newErrors;
    });
  };

  const getTotalQuantity = () => {
    return formData.selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return getTotalQuantity() * pricePerItem + formData.deliveryFee;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate built-in fields
    if (!formData.name.trim()) {
      newErrors.name = '이름을 입력해주세요';
    }

    if (!formData.email.trim()) {
      newErrors.email = '이메일을 입력해주세요';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다';
    }

    // Validate selected items (size + quantity)
    formData.selectedItems.forEach((item, index) => {
      if (!item.size) {
        newErrors[`item-${index}-size`] = '사이즈를 선택해주세요';
      }
      if (item.quantity < 1) {
        newErrors[`item-${index}-quantity`] = '수량은 1 이상이어야 합니다';
      }
    });

    // Validate custom fields
    customFields.forEach(field => {
      if (field.fixed) return; // Skip size field as it's validated above

      const value = formData.fieldResponses[field.id];

      if (field.required && (!value || !value.trim())) {
        newErrors[field.id] = `${field.label}을(를) 입력해주세요`;
        return;
      }

      if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors[field.id] = '올바른 이메일 형식이 아닙니다';
      }

      if (value && field.type === 'phone' && !/^[0-9]*$/.test(value)) {
        newErrors[field.id] = '올바른 전화번호 형식이 아닙니다';
      }
    });

    // Validate delivery method if delivery settings are enabled
    if (deliverySettings?.enabled) {
      if (!formData.deliveryMethod) {
        newErrors.deliveryMethod = '수령 방법을 선택해주세요';
      }

      // Validate delivery address if delivery is selected
      if (formData.deliveryMethod === 'delivery') {
        if (!formData.deliveryInfo?.recipientName?.trim()) {
          newErrors.recipientName = '수령인 이름을 입력해주세요';
        }
        if (!formData.deliveryInfo?.phone?.trim()) {
          newErrors.deliveryPhone = '연락처를 입력해주세요';
        }
        if (!formData.deliveryInfo?.address?.trim()) {
          newErrors.address = '주소를 입력해주세요';
        }
        if (!formData.deliveryInfo?.addressDetail?.trim()) {
          newErrors.addressDetail = '상세 주소를 입력해주세요';
        }
        if (!formData.deliveryInfo?.postalCode?.trim()) {
          newErrors.postalCode = '우편번호를 입력해주세요';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const renderField = (field: CoBuyCustomField) => {
    if (field.fixed && field.type === 'dropdown') {
      // This is the size field - handled separately
      return null;
    }

    const value = formData.fieldResponses[field.id] || '';

    return (
      <div key={field.id} className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {field.type === 'dropdown' && field.options ? (
          <select
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
            required={field.required}
          >
            <option value="">선택해주세요</option>
            {field.options.map((option, idx) => (
              <option key={idx} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : field.type === 'email' ? (
          <input
            type="email"
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder={`${field.label}을(를) 입력하세요`}
            required={field.required}
          />
        ) : field.type === 'phone' ? (
          <input
            type="tel"
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value.replace(/[^0-9]/g, ''))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="01012345678"
            required={field.required}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder={`${field.label}을(를) 입력하세요`}
            required={field.required}
          />
        )}

        {errors[field.id] && (
          <p className="text-red-500 text-xs mt-1">{errors[field.id]}</p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Built-in fields */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
          placeholder="이름을 입력하세요"
        />
        {errors.name && (
          <p className="text-red-500 text-xs mt-1">{errors.name}</p>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          이메일 <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
          placeholder="example@email.com"
        />
        {errors.email && (
          <p className="text-red-500 text-xs mt-1">{errors.email}</p>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          전화번호
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => handleInputChange('phone', e.target.value.replace(/[^0-9]/g, ''))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
          placeholder="01012345678"
        />
        {errors.phone && (
          <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
        )}
      </div>

      {/* Size and Quantity selector (multi-item support) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          사이즈 및 수량 <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-3">
          여러 사이즈를 구매하려면 &apos;추가&apos; 버튼을 눌러주세요
        </p>

        <div className="space-y-3">
          {formData.selectedItems.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              {/* Size dropdown */}
              <div className="flex-1">
                <select
                  value={item.size}
                  onChange={(e) => handleItemSizeChange(index, e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand ${
                    errors[`item-${index}-size`] ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">사이즈 선택</option>
                  {sizeOptions.map((size, idx) => (
                    <option key={idx} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                {errors[`item-${index}-size`] && (
                  <p className="text-red-500 text-xs mt-1">{errors[`item-${index}-size`]}</p>
                )}
              </div>

              {/* Quantity controls */}
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleItemQuantityChange(index, item.quantity - 1)}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-l-lg transition-colors"
                  disabled={item.quantity <= 1}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-3 py-2 min-w-10 text-center font-medium">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => handleItemQuantityChange(index, item.quantity + 1)}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-r-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Remove button (only show if more than 1 item) */}
              {formData.selectedItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add another size button */}
        <button
          type="button"
          onClick={addItem}
          className="mt-3 w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          다른 사이즈 추가
        </button>

        {/* Total summary */}
        {getTotalQuantity() > 0 && (
          <div className="mt-3 p-3 bg-brand/10 rounded-lg space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-700">총 수량</span>
              <span className="font-bold text-brand">{getTotalQuantity()}벌</span>
            </div>
            {pricePerItem > 0 && (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">단가</span>
                  <span className="font-medium text-brand">₩{pricePerItem.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">상품 금액</span>
                  <span className="font-medium text-brand">₩{(getTotalQuantity() * pricePerItem).toLocaleString()}</span>
                </div>
                {formData.deliveryFee > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">배송비</span>
                    <span className="font-medium text-brand">+₩{formData.deliveryFee.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm pt-1 border-t border-brand/30">
                  <span className="text-gray-700 font-medium">예상 결제 금액</span>
                  <span className="font-bold text-brand text-lg">₩{getTotalPrice().toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Delivery Method Selection */}
      {deliverySettings?.enabled && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Truck className="w-4 h-4 inline-block mr-1" />
            수령 방법 <span className="text-red-500">*</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            {/* Pickup Option */}
            <button
              type="button"
              onClick={() => handleDeliveryMethodChange('pickup')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                formData.deliveryMethod === 'pickup'
                  ? 'border-brand bg-brand/10'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-5 h-5 text-gray-600" />
                <span className="font-medium">직접 수령</span>
              </div>
              <p className="text-xs text-gray-500">무료</p>
              {deliverySettings.pickupLocation && (
                <p className="text-xs text-gray-600 mt-1">{deliverySettings.pickupLocation}</p>
              )}
            </button>

            {/* Delivery Option */}
            <button
              type="button"
              onClick={() => handleDeliveryMethodChange('delivery')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                formData.deliveryMethod === 'delivery'
                  ? 'border-brand bg-brand/10'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Truck className="w-5 h-5 text-gray-600" />
                <span className="font-medium">배송</span>
              </div>
              <p className="text-xs text-gray-500">
                {deliverySettings.deliveryFee > 0
                  ? `+₩${deliverySettings.deliveryFee.toLocaleString()}`
                  : '무료 배송'}
              </p>
            </button>
          </div>

          {errors.deliveryMethod && (
            <p className="text-red-500 text-xs mt-1">{errors.deliveryMethod}</p>
          )}

          {/* Delivery Address Form */}
          {formData.deliveryMethod === 'delivery' && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
              {/* Load Daum Postcode Script */}
              {!isPostcodeScriptLoaded && (
                <Script
                  src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
                  strategy="lazyOnload"
                  onLoad={() => setIsPostcodeScriptLoaded(true)}
                />
              )}

              <p className="text-sm font-medium text-gray-700 mb-2">배송 정보</p>

              {/* Recipient Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  수령인 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.deliveryInfo?.recipientName || ''}
                  onChange={(e) => handleDeliveryInfoChange('recipientName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm ${
                    errors.recipientName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="수령인 이름"
                />
                {errors.recipientName && (
                  <p className="text-red-500 text-xs mt-1">{errors.recipientName}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.deliveryInfo?.phone || ''}
                  onChange={(e) => handleDeliveryInfoChange('phone', e.target.value.replace(/[^0-9]/g, ''))}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm ${
                    errors.deliveryPhone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="01012345678"
                />
                {errors.deliveryPhone && (
                  <p className="text-red-500 text-xs mt-1">{errors.deliveryPhone}</p>
                )}
              </div>

              {/* Address Search */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  주소 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.deliveryInfo?.postalCode || ''}
                    readOnly
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-sm"
                    placeholder="우편번호"
                  />
                  <button
                    type="button"
                    onClick={handleAddressSearch}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition font-medium text-sm flex items-center gap-1.5"
                  >
                    <Search className="w-4 h-4" />
                    주소 검색
                  </button>
                </div>
                {errors.postalCode && (
                  <p className="text-red-500 text-xs mt-1">{errors.postalCode}</p>
                )}
              </div>

              {/* Show address fields after search */}
              {formData.deliveryInfo?.address && (
                <>
                  {/* Road Address (readonly) */}
                  <input
                    type="text"
                    value={formData.deliveryInfo?.address || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-sm"
                    placeholder="도로명 주소"
                  />

                  {/* Address Detail */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      상세 주소 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.deliveryInfo?.addressDetail || ''}
                      onChange={(e) => handleDeliveryInfoChange('addressDetail', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm ${
                        errors.addressDetail ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="아파트 동/호수, 건물명 등"
                    />
                    {errors.addressDetail && (
                      <p className="text-red-500 text-xs mt-1">{errors.addressDetail}</p>
                    )}
                  </div>
                </>
              )}

              {errors.address && !formData.deliveryInfo?.address && (
                <p className="text-red-500 text-xs">{errors.address}</p>
              )}

              {/* Delivery Memo */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  배송 요청사항 (선택)
                </label>
                <input
                  type="text"
                  value={formData.deliveryInfo?.memo || ''}
                  onChange={(e) => handleDeliveryInfoChange('memo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm"
                  placeholder="예: 문 앞에 놓아주세요"
                  maxLength={100}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Custom fields */}
      {customFields.filter(f => !f.fixed).map(renderField)}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
          isSubmitting
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-brand hover:bg-brand-deep'
        }`}
      >
        {isSubmitting ? '처리 중...' : '결제하기'}
      </button>
    </form>
  );
};

export default ParticipantForm;
