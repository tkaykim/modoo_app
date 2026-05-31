'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { X, MapPin, Truck, Search } from 'lucide-react';
import { CoBuyDeliverySettings, CoBuyAddressInfo } from '@/types/types';

interface DeliverySettingsEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliverySettings: CoBuyDeliverySettings | null;
  onSave: (settings: CoBuyDeliverySettings) => Promise<void>;
}

export default function DeliverySettingsEditModal({
  isOpen,
  onClose,
  deliverySettings,
  onSave,
}: DeliverySettingsEditModalProps) {
  const [localSettings, setLocalSettings] = useState<CoBuyDeliverySettings>({
    enabled: false,
    deliveryFee: 0,
    pickupLocation: '',
    deliveryAddress: undefined,
    pickupAddress: undefined,
  });
  const [isPostcodeScriptLoaded, setIsPostcodeScriptLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && deliverySettings) {
      setLocalSettings({ ...deliverySettings });
    }
  }, [isOpen, deliverySettings]);

  const openDeliveryAddressSearch = () => {
    if (!isPostcodeScriptLoaded) {
      alert('주소 검색 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        const addressInfo: CoBuyAddressInfo = {
          roadAddress: data.roadAddress || data.jibunAddress,
          jibunAddress: data.jibunAddress,
          postalCode: data.zonecode,
          addressDetail: localSettings.deliveryAddress?.addressDetail || '',
        };
        setLocalSettings(prev => ({
          ...prev,
          deliveryAddress: addressInfo,
        }));
      }
    }).open();
  };

  const openPickupAddressSearch = () => {
    if (!isPostcodeScriptLoaded) {
      alert('주소 검색 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        const addressInfo: CoBuyAddressInfo = {
          roadAddress: data.roadAddress || data.jibunAddress,
          jibunAddress: data.jibunAddress,
          postalCode: data.zonecode,
          addressDetail: localSettings.pickupAddress?.addressDetail || '',
        };
        setLocalSettings(prev => ({
          ...prev,
          pickupAddress: addressInfo,
          pickupLocation: data.roadAddress || data.jibunAddress,
        }));
      }
    }).open();
  };

  const handleSave = async () => {
    if (!localSettings.deliveryAddress?.roadAddress) {
      alert('배송받을 장소를 입력해주세요.');
      return;
    }
    if (!localSettings.pickupAddress?.roadAddress) {
      alert('배부 장소를 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(localSettings);
      onClose();
    } catch (error) {
      console.error('Failed to save delivery settings:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Script
        src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        strategy="lazyOnload"
        onLoad={() => setIsPostcodeScriptLoaded(true)}
      />

      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">수령/배송 장소 수정</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-6">
            {/* 배송받을 장소 (Delivery Address) */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Truck className="w-4 h-4 text-[#0052CC]" />
                배송받을 장소
              </label>
              <p className="text-xs text-gray-500 mb-3">
                공장에서 제작된 상품이 배송될 주소입니다.
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={localSettings.deliveryAddress?.postalCode || ''}
                  readOnly
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-sm"
                  placeholder="우편번호"
                />
                <button
                  type="button"
                  onClick={openDeliveryAddressSearch}
                  className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  주소 검색
                </button>
              </div>
              {localSettings.deliveryAddress?.roadAddress && (
                <>
                  <input
                    type="text"
                    value={localSettings.deliveryAddress.roadAddress}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 mb-2"
                    placeholder="도로명 주소"
                  />
                  <input
                    type="text"
                    value={localSettings.deliveryAddress.addressDetail || ''}
                    onChange={(e) => setLocalSettings(prev => ({
                      ...prev,
                      deliveryAddress: prev.deliveryAddress ? {
                        ...prev.deliveryAddress,
                        addressDetail: e.target.value
                      } : undefined
                    }))}
                    placeholder="상세주소 (동/호수, 건물명 등)"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                    maxLength={100}
                  />
                </>
              )}
            </div>

            {/* 배부 장소 (Pickup Address) */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 text-green-600" />
                배부 장소
              </label>
              <p className="text-xs text-gray-500 mb-3">
                참여자들이 직접 수령할 장소입니다.
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={localSettings.pickupAddress?.postalCode || ''}
                  readOnly
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-sm"
                  placeholder="우편번호"
                />
                <button
                  type="button"
                  onClick={openPickupAddressSearch}
                  className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  주소 검색
                </button>
              </div>
              {localSettings.pickupAddress?.roadAddress && (
                <>
                  <input
                    type="text"
                    value={localSettings.pickupAddress.roadAddress}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 mb-2"
                    placeholder="도로명 주소"
                  />
                  <input
                    type="text"
                    value={localSettings.pickupAddress.addressDetail || ''}
                    onChange={(e) => setLocalSettings(prev => ({
                      ...prev,
                      pickupAddress: prev.pickupAddress ? {
                        ...prev.pickupAddress,
                        addressDetail: e.target.value
                      } : undefined,
                      pickupLocation: prev.pickupAddress ?
                        `${prev.pickupAddress.roadAddress} ${e.target.value}`.trim() : ''
                    }))}
                    placeholder="상세주소 (동/호수, 건물명 등)"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                    maxLength={100}
                  />
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}