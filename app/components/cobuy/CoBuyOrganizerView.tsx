'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import { useAuthStore } from '@/store/useAuthStore';
import { createClient } from '@/lib/supabase-client';
import {
  closeCoBuySession,
  getCoBuySession,
  getCoBuySessionForOrganizerByShareToken,
  getParticipants,
  requestCancellation,
  updateParticipantPickupStatus,
  updateDeliverySettings
} from '@/lib/cobuyService';
import { CoBuyParticipant, CoBuySession, CoBuyDeliverySettings, CoBuyPickupStatus } from '@/types/types';
import { Calendar, CheckCircle, Clock, Copy, Users, PackageCheck, ShoppingBag, Info, ChevronDown, Truck, MapPin, Pencil, Search, UserPlus, Trash2 } from 'lucide-react';
import CoBuyProgressBar from '@/app/components/cobuy/CoBuyProgressBar';
import CoBuyOrderModal from '@/app/components/cobuy/CoBuyOrderModal';
import DeliverySettingsEditModal from '@/app/components/cobuy/DeliverySettingsEditModal';
import CoBuyParticipantModal, { ParticipantFormData } from '@/app/components/cobuy/CoBuyParticipantModal';
import { formatKstDateOnly } from '@/lib/kst';

const statusLabels: Record<CoBuySession['status'], { label: string; color: string }> = {
  gathering: { label: '모집중', color: 'bg-green-100 text-green-800' },
  gather_complete: { label: '모집 완료', color: 'bg-blue-100 text-blue-800' },
  order_complete: { label: '주문 완료', color: 'bg-blue-100 text-blue-800' },
  manufacturing: { label: '제작중', color: 'bg-yellow-100 text-yellow-800' },
  manufacture_complete: { label: '제작 완료', color: 'bg-blue-100 text-blue-800' },
  delivering: { label: '배송중', color: 'bg-purple-100 text-purple-800' },
  delivery_complete: { label: '배송 완료', color: 'bg-gray-100 text-gray-800' },
  cancelled: { label: '취소됨', color: 'bg-red-100 text-red-800' },
};

const paymentLabels: Record<CoBuyParticipant['payment_status'], { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: '완료', color: 'bg-green-100 text-green-800' },
  failed: { label: '실패', color: 'bg-red-100 text-red-800' },
  refunded: { label: '환불', color: 'bg-gray-100 text-gray-800' },
  not_required: { label: '대표자 일괄결제', color: 'bg-blue-100 text-blue-800' },
};

const pickupLabels: Record<CoBuyPickupStatus, { label: string; cls: string }> = {
  pending: { label: '미수령', cls: 'bg-gray-200 text-gray-800 hover:bg-gray-300' },
  picked_up: { label: '수령', cls: 'bg-green-100 text-green-800 hover:bg-green-200' },
};

/** 마이페이지 UUID 경로(로그인 필수) 또는 share_token 기반 `/cobuy/host/[shareToken]`(누구나 접근 가능) */
export type CoBuyOrganizerAccess =
  | { mode: 'sessionId'; sessionId: string }
  | { mode: 'shareToken'; shareToken: string };

interface CoBuyOrganizerViewProps {
  access: CoBuyOrganizerAccess;
}

export default function CoBuyOrganizerView({ access }: CoBuyOrganizerViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const loginRedirectQuery = pathname ? `?redirect=${encodeURIComponent(pathname)}` : '';
  const isShareEntry = access.mode === 'shareToken';
  const routeSessionId = access.mode === 'sessionId' ? access.sessionId : '';
  const routeShareToken = access.mode === 'shareToken' ? access.shareToken : '';

  const { isAuthenticated, user } = useAuthStore();

  const [session, setSession] = useState<CoBuySession | null>(null);
  const [participants, setParticipants] = useState<CoBuyParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedParticipants, setExpandedParticipants] = useState<Set<string>>(new Set());
  const [updatingPickupStatus, setUpdatingPickupStatus] = useState<Set<string>>(new Set());
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isDeliverySettingsModalOpen, setIsDeliverySettingsModalOpen] = useState(false);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<CoBuyParticipant | null>(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantPaymentFilter, setParticipantPaymentFilter] = useState<'all' | CoBuyParticipant['payment_status']>('all');
  const [participantPickupFilter, setParticipantPickupFilter] = useState<'all' | 'pending' | 'picked_up'>('all');

  // Check if editing is allowed (before order_complete)
  const canEditDeliverySettings = session && !['order_complete', 'manufacturing', 'manufacture_complete', 'delivering', 'delivery_complete', 'cancelled'].includes(session.status);

  const isTokenAccess = isShareEntry && !isAuthenticated;

  const handleSaveDeliverySettings = async (settings: CoBuyDeliverySettings) => {
    if (!session) return;
    if (isTokenAccess) {
      const res = await fetch('/api/cobuy/host/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToken: routeShareToken, action: 'update_delivery', deliverySettings: settings }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update delivery settings');
      setSession(json.data);
    } else {
      const updated = await updateDeliverySettings(session.id, settings);
      if (updated) {
        setSession(updated);
      } else {
        throw new Error('Failed to update delivery settings');
      }
    }
  };

  const toggleParticipantExpand = (participantId: string) => {
    setExpandedParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) {
        next.delete(participantId);
      } else {
        next.add(participantId);
      }
      return next;
    });
  };

  const handlePickupStatusToggle = async (participant: CoBuyParticipant) => {
    if (updatingPickupStatus.has(participant.id)) return;

    const newStatus = participant.pickup_status === 'picked_up' ? 'pending' : 'picked_up';

    setUpdatingPickupStatus((prev) => new Set(prev).add(participant.id));

    let success = false;
    if (isTokenAccess) {
      const res = await fetch('/api/cobuy/host/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToken: routeShareToken, participantId: participant.id, pickupStatus: newStatus }),
      });
      success = res.ok;
    } else {
      const updated = await updateParticipantPickupStatus(participant.id, newStatus);
      success = !!updated;
    }

    if (success) {
      setParticipants((current) =>
        current.map((p) => (p.id === participant.id ? { ...p, pickup_status: newStatus } : p))
      );
    } else {
      alert('수령 상태 변경에 실패했습니다.');
    }

    setUpdatingPickupStatus((prev) => {
      const next = new Set(prev);
      next.delete(participant.id);
      return next;
    });
  };

  const fetchSessionData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (access.mode === 'sessionId') {
        if (!user) return;
        if (!routeSessionId) return;
        const [sessionData, participantData] = await Promise.all([
          getCoBuySession(routeSessionId, user.id),
          getParticipants(routeSessionId),
        ]);
        if (!sessionData) {
          setError('공동구매 정보를 찾을 수 없습니다.');
          setSession(null);
        } else {
          setSession(sessionData);
        }
        setParticipants(participantData);
        return;
      }

      if (!routeShareToken?.trim()) return;

      if (isAuthenticated && user) {
        const sessionData = await getCoBuySessionForOrganizerByShareToken(routeShareToken, user.id);
        if (sessionData) {
          const participantData = await getParticipants(sessionData.id);
          setSession(sessionData);
          setParticipants(participantData);
          return;
        }
      }

      const res = await fetch(`/api/cobuy/host/bootstrap?shareToken=${encodeURIComponent(routeShareToken)}`);
      const json = await res.json();
      if (!res.ok || !json.data) {
        setError('공동구매를 찾을 수 없습니다.');
        setSession(null);
        setParticipants([]);
        return;
      }
      setSession(json.data.session);
      setParticipants(json.data.participants);
    } catch (err) {
      console.error('Error fetching CoBuy session detail:', err);
      setError('공동구매 정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (access.mode === 'sessionId' && (!isAuthenticated || !user)) {
      setIsLoading(false);
      return;
    }

    fetchSessionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, access.mode, routeSessionId, routeShareToken]);

  const realtimeSessionId =
    access.mode === 'sessionId' ? routeSessionId : session?.id ?? null;

  useEffect(() => {
    if (!realtimeSessionId || !isAuthenticated) return;

    const supabase = createClient();
    const sessionId = realtimeSessionId;

    const participantsChannel = supabase
      .channel(`cobuy-participants-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cobuy_participants',
          filter: `cobuy_session_id=eq.${sessionId}`,
        },
        (payload) => {
          setParticipants((current) => {
            if (payload.eventType === 'INSERT') {
              const newParticipant = payload.new as CoBuyParticipant;
              return [newParticipant, ...current];
            }

            if (payload.eventType === 'UPDATE') {
              const updatedParticipant = payload.new as CoBuyParticipant;
              return current.map((participant) =>
                participant.id === updatedParticipant.id ? updatedParticipant : participant
              );
            }

            if (payload.eventType === 'DELETE') {
              const removedParticipant = payload.old as CoBuyParticipant;
              return current.filter((participant) => participant.id !== removedParticipant.id);
            }

            return current;
          });
        }
      )
      .subscribe();

    const sessionsChannel = supabase
      .channel(`cobuy-sessions-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cobuy_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.new) {
            setSession(payload.new as CoBuySession);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(participantsChannel);
      supabase.removeChannel(sessionsChannel);
    };
  }, [isAuthenticated, realtimeSessionId]);

  const isSurveyMode = session?.payment_mode === 'survey';

  const completedCount = useMemo(
    () => participants.filter((p) =>
      isSurveyMode
        ? p.payment_status === 'not_required'
        : p.payment_status === 'completed'
    ).length,
    [participants, isSurveyMode]
  );

  const totalPaid = useMemo(
    () => participants.reduce((sum, participant) => sum + (participant.payment_amount || 0), 0),
    [participants]
  );

  const totalQuantity = useMemo(
    () => participants
      .filter((p) => isSurveyMode
        ? p.payment_status === 'not_required'
        : p.payment_status === 'completed'
      )
      .reduce((sum, p) => sum + (p.total_quantity || 0), 0),
    [participants, isSurveyMode]
  );

  const filteredParticipants = useMemo(() => {
    let filtered = participants;
    if (participantSearch.trim()) {
      const q = participantSearch.trim().toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q))
      );
    }
    if (participantPaymentFilter !== 'all') {
      filtered = filtered.filter(p => p.payment_status === participantPaymentFilter);
    }
    if (participantPickupFilter !== 'all') {
      filtered = filtered.filter(p => (p.pickup_status || 'pending') === participantPickupFilter);
    }
    return filtered;
  }, [participants, participantSearch, participantPaymentFilter, participantPickupFilter]);

  // 컬럼 가시성: 실제로 데이터가 있는 컬럼만 표시
  const showDeliveryColumn = useMemo(
    () => participants.some(p => !!p.delivery_method),
    [participants]
  );
  const showCustomFieldColumn = useMemo(() => {
    const customFields = session?.custom_fields?.filter(f => !f.fixed) || [];
    if (customFields.length === 0) return false;
    return participants.some(p =>
      customFields.some(f => p.field_responses?.[f.id])
    );
  }, [participants, session?.custom_fields]);

  // 수기 추가된 참여자의 가짜 이메일(@cobuy.local) 숨김
  const displayEmail = (email: string) => {
    if (!email || email.endsWith('@cobuy.local')) return null;
    return email;
  };

  const sizeOptionsFromSession = useMemo(() => {
    const sizeField = session?.custom_fields?.find((f: { id: string; type: string; options?: string[] }) => f.id === 'size' && f.type === 'dropdown');
    return sizeField?.options ?? [];
  }, [session?.custom_fields]);

  const handleAddParticipant = async (data: ParticipantFormData) => {
    if (!session) return;
    const response = await fetch('/api/cobuy/participant/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        ...(isShareEntry ? { shareToken: routeShareToken } : {}),
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        selectedItems: data.selectedItems,
        fieldResponses: data.fieldResponses,
        deliveryMethod: data.deliveryMethod,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || '참여자 추가에 실패했습니다.');
    }
    fetchSessionData();
  };

  const handleEditParticipant = async (data: ParticipantFormData) => {
    if (!editingParticipant || !session) return;
    const totalQty = data.selectedItems.reduce((sum, item) => sum + item.quantity, 0);
    const selectedSize = data.selectedItems.map(i => `${i.size}(${i.quantity})`).join(', ');

    const response = await fetch('/api/cobuy/participant/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: editingParticipant.id,
        sessionId: session.id,
        ...(isShareEntry ? { shareToken: routeShareToken } : {}),
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        selectedItems: data.selectedItems,
        totalQuantity: totalQty,
        selectedSize,
        fieldResponses: data.fieldResponses,
        deliveryMethod: data.deliveryMethod,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || '참여자 수정에 실패했습니다.');
    }
    fetchSessionData();
  };

  const handleDeleteParticipant = async (participant: CoBuyParticipant) => {
    if (!session) return;
    if (participant.payment_status !== 'pending') {
      alert('결제 대기 상태의 참여자만 삭제할 수 있습니다.');
      return;
    }
    const confirmed = window.confirm(`${participant.name}님을 삭제하시겠습니까?`);
    if (!confirmed) return;

    try {
      const response = await fetch('/api/cobuy/participant/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participant.id,
          sessionId: session.id,
          ...(isShareEntry ? { shareToken: routeShareToken } : {}),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '참여자 삭제에 실패했습니다.');
      }
      fetchSessionData();
    } catch (err) {
      console.error('Error deleting participant:', err);
      alert(err instanceof Error ? err.message : '참여자 삭제에 실패했습니다.');
    }
  };

  const getItemUnitPrice = (size: string): number | null => {
    if (session?.size_prices && size && session.size_prices[size] != null) return session.size_prices[size];
    const bp = (session as any)?.saved_design_screenshot?.price_per_item;
    return typeof bp === 'number' ? bp : null;
  };

  const renderSelectedItems = (participant: CoBuyParticipant) => {
    const items = participant.selected_items;
    if (!items || items.length === 0) {
      return participant.selected_size || '-';
    }

    return (
      <div className="space-y-1">
        {items.map((item, idx) => {
          const unitPrice = getItemUnitPrice(item.size);
          return (
            <div key={idx} className="flex items-center gap-2 flex-wrap">
              <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-medium">
                {item.size}
              </span>
              <span className="text-gray-500">×</span>
              <span className="font-medium">{item.quantity}</span>
              {unitPrice != null && (
                <span className="text-xs text-gray-400">
                  (₩{(unitPrice * item.quantity).toLocaleString()})
                </span>
              )}
            </div>
          );
        })}
        <div className="text-xs text-gray-500 pt-1 border-t border-gray-100 flex justify-between">
          <span>총 {participant.total_quantity || items.reduce((sum, i) => sum + i.quantity, 0)}벌</span>
          {participant.payment_amount != null && participant.payment_amount > 0 && (
            <span className="font-medium text-gray-700">₩{participant.payment_amount.toLocaleString()}</span>
          )}
        </div>
      </div>
    );
  };

  // Helper to render custom field responses
  const renderFieldResponses = (participant: CoBuyParticipant, variant: 'mobile' | 'desktop' = 'desktop') => {
    const customFields = session?.custom_fields || [];
    const responses = participant.field_responses || {};

    // Filter out fixed fields (like size) since we show those separately
    const fieldsToShow = customFields.filter((f) => !f.fixed && responses[f.id]);

    if (fieldsToShow.length === 0) return null;

    if (variant === 'mobile') {
      return (
        <div className="space-y-1.5 pt-2 mt-2 border-t border-gray-100">
          {fieldsToShow.map((field) => (
            <div key={field.id} className="flex justify-between text-sm">
              <span className="text-gray-500">{field.label}</span>
              <span className="text-gray-700">{responses[field.id]}</span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-0.5 text-xs text-gray-500">
        {fieldsToShow.map((field) => (
          <div key={field.id}>
            <span className="text-gray-400">{field.label}:</span>{' '}
            <span>{responses[field.id]}</span>
          </div>
        ))}
      </div>
    );
  };

  // Helper to render inline-clickable pickup status chip (배부 상태 칩)
  const renderPickupStatusToggle = (participant: CoBuyParticipant) => {
    const pickupStatus: CoBuyPickupStatus = participant.pickup_status || 'pending';
    const isPickedUp = pickupStatus === 'picked_up';
    const isUpdating = updatingPickupStatus.has(participant.id);
    const { label, cls } = pickupLabels[pickupStatus];

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handlePickupStatusToggle(participant);
        }}
        disabled={isUpdating}
        title={isPickedUp ? '클릭하여 미수령으로 변경' : '클릭하여 수령으로 변경'}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${cls} ${
          isUpdating ? 'opacity-60 cursor-wait' : 'cursor-pointer'
        }`}
      >
        {isUpdating && (
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {label}
      </button>
    );
  };

  // Helper to render delivery info
  const renderDeliveryInfo = (participant: CoBuyParticipant, variant: 'mobile' | 'desktop' = 'desktop') => {
    if (!participant.delivery_method) return null;

    const isDelivery = participant.delivery_method === 'delivery';
    const deliveryInfo = participant.delivery_info;

    if (variant === 'mobile') {
      return (
        <div className="space-y-1.5 pt-2 mt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm">
            {isDelivery ? (
              <Truck className="w-4 h-4 text-[#3B55A5]" />
            ) : (
              <MapPin className="w-4 h-4 text-green-600" />
            )}
            <span className="font-medium">
              {isDelivery ? '배송' : '직접 수령'}
            </span>
            {participant.delivery_fee > 0 && (
              <span className="text-xs text-gray-500">
                (+₩{participant.delivery_fee.toLocaleString()})
              </span>
            )}
          </div>
          {isDelivery && deliveryInfo && (
            <div className="pl-6 text-sm text-gray-600 space-y-0.5">
              <p>{deliveryInfo.recipientName} / {deliveryInfo.phone}</p>
              <p>({deliveryInfo.postalCode}) {deliveryInfo.address}</p>
              <p>{deliveryInfo.addressDetail}</p>
              {deliveryInfo.memo && (
                <p className="text-xs text-gray-500">요청: {deliveryInfo.memo}</p>
              )}
            </div>
          )}
        </div>
      );
    }

    // Desktop variant
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          {isDelivery ? (
            <Truck className="w-3.5 h-3.5 text-[#3B55A5]" />
          ) : (
            <MapPin className="w-3.5 h-3.5 text-green-600" />
          )}
          <span className="text-xs font-medium">
            {isDelivery ? '배송' : '직접 수령'}
          </span>
          {participant.delivery_fee > 0 && (
            <span className="text-xs text-gray-500">
              (+₩{participant.delivery_fee.toLocaleString()})
            </span>
          )}
        </div>
        {isDelivery && deliveryInfo && (
          <div className="text-xs text-gray-500 space-y-0.5">
            <p>{deliveryInfo.recipientName} / {deliveryInfo.phone}</p>
            <p className="truncate max-w-48" title={`${deliveryInfo.address} ${deliveryInfo.addressDetail}`}>
              {deliveryInfo.address}
            </p>
          </div>
        )}
      </div>
    );
  };

  const copyShareLink = () => {
    if (!session) return;
    const shareUrl = `${window.location.origin}/cobuy/${session.share_token}`;
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 5000);
    });
  };

  const handleCloseSession = async () => {
    if (!session || session.status !== 'gathering') return;
    const confirmed = window.confirm('공동구매를 마감하시겠습니까? 이후에는 참여자가 추가될 수 없습니다.');
    if (!confirmed) return;

    setIsUpdating(true);
    if (isTokenAccess) {
      const res = await fetch('/api/cobuy/host/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToken: routeShareToken, action: 'close_gathering' }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setSession(json.data);
        fetch('/api/cobuy/notify/session-closed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: json.data.id, shareToken: routeShareToken }),
        }).catch((error) => console.error('Failed to notify session closed:', error));
      } else {
        alert(json.error || '공동구매 마감에 실패했습니다.');
      }
    } else {
      const updated = await closeCoBuySession(session.id);
      if (updated) {
        setSession(updated);
        fetch('/api/cobuy/notify/session-closed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: updated.id }),
        }).catch((error) => console.error('Failed to notify session closed:', error));
      } else {
        alert('공동구매 마감에 실패했습니다.');
      }
    }
    setIsUpdating(false);
  };

  const handleCancelSession = async () => {
    if (!session) return;
    const confirmed = window.confirm('공동구매를 취소 요청하시겠습니까?');
    if (!confirmed) return;

    setIsUpdating(true);
    if (isTokenAccess) {
      const res = await fetch('/api/cobuy/host/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToken: routeShareToken, action: 'cancel' }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setSession(json.data);
      } else {
        alert(json.error || '공동구매 취소 요청에 실패했습니다.');
      }
    } else {
      const updated = await requestCancellation(session.id);
      if (updated) {
        setSession(updated);
      } else {
        alert('공동구매 취소 요청에 실패했습니다.');
      }
    }
    setIsUpdating(false);
  };

  const handleCreateOrders = () => {
    if (!session) return;
    setIsOrderModalOpen(true);
  };

  const handleOrderCreated = () => {
    // Refresh the session data after order creation
    fetchSessionData();
  };

  const handleSessionUpdated = (updatedSession: CoBuySession) => {
    setSession(updatedSession);
  };

  if (isShareEntry && !routeShareToken?.trim()) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Header back backHref="/cobuy" />
        <div className="max-w-3xl mx-auto p-6 text-center">
          <p className="text-red-500 mb-4">유효한 주최자 링크가 아닙니다.</p>
          <button
            type="button"
            onClick={() => router.push('/cobuy')}
            className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            공동구매 목록
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isShareEntry) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Header back />
        <div className="max-w-3xl mx-auto p-6 text-center">
          <p className="text-gray-500 mb-4">주최자 관리 화면은 로그인 후 이용할 수 있습니다.</p>
          <button
            type="button"
            onClick={() => router.push(`/login${loginRedirectQuery}`)}
            className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Header back backHref={isShareEntry ? '/cobuy' : undefined} />
        <div className="max-w-3xl mx-auto p-6 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="text-gray-500 mt-4">공동구매 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Header back backHref={isShareEntry ? '/cobuy' : undefined} />
        <div className="max-w-3xl mx-auto p-6 text-center">
          <p className="text-red-500 mb-4">{error || '공동구매 정보를 찾을 수 없습니다.'}</p>
          <button
            type="button"
            onClick={() => router.push(isShareEntry ? '/cobuy' : '/home/my-page/cobuy')}
            className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            {isShareEntry ? '공동구매 목록' : '목록으로 돌아가기'}
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = statusLabels[session.status];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header back backHref={isShareEntry ? '/cobuy' : undefined} />

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-xl font-bold text-gray-900">{session.title}</h1>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
              {session.description && (
                <p className="text-gray-600 mb-3">{session.description}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  시작일: {formatKstDateOnly(session.start_date)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  종료일: {formatKstDateOnly(session.end_date)}
                </span>
              </div>
            </div>

            <div className="w-full bg-gray-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">참여모집 링크</p>
                  <p className="text-xs text-gray-500 mt-0.5">이 링크를 통해 참여자 모집을 진행할 수 있습니다.</p>
                </div>
                <button
                  onClick={copyShareLink}
                  className="shrink-0 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>복사됨</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>참여모집 링크 복사</span>
                    </>
                  )}
                </button>
              </div>
              {copied && (
                <p className="text-sm text-green-700 leading-relaxed pl-0.5">
                  이제 단톡방, SNS에 이 링크를 공유하여 참여자를 모집할 수 있습니다.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {session.status !== 'delivery_complete' && (
                <>
                  <button
                    onClick={handleCloseSession}
                    disabled={isUpdating || session.status !== 'gathering'}
                    className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    마감하기
                  </button>
                  <button
                    onClick={handleCancelSession}
                    disabled={isUpdating || session.status === 'cancelled' || ['order_complete', 'manufacturing', 'manufacture_complete', 'delivering'].includes(session.status)}
                    className="px-4 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    취소 요청
                  </button>
                  <button
                    onClick={handleCreateOrders}
                    disabled={session.status === 'cancelled' || ['order_complete', 'manufacturing', 'manufacture_complete', 'delivering'].includes(session.status)}
                    className="px-4 py-2 bg-[#3B55A5] text-white text-sm rounded-lg hover:bg-[#2D4280] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>주문 생성</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Delivery Settings Section */}
        {session.delivery_settings && (
          <section className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">수령/배송 장소</h2>
              {canEditDeliverySettings && (
                <button
                  onClick={() => setIsDeliverySettingsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  수정
                </button>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {/* 배송받을 장소 */}
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-4 h-4 text-[#3B55A5]" />
                  <p className="text-sm font-medium text-gray-700">배송받을 장소</p>
                </div>
                {session.delivery_settings.deliveryAddress ? (
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <p>({session.delivery_settings.deliveryAddress.postalCode}) {session.delivery_settings.deliveryAddress.roadAddress}</p>
                    {session.delivery_settings.deliveryAddress.addressDetail && (
                      <p>{session.delivery_settings.deliveryAddress.addressDetail}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">미설정</p>
                )}
              </div>

              {/* 배부 장소 */}
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-medium text-gray-700">배부 장소</p>
                </div>
                {session.delivery_settings.pickupAddress ? (
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <p>({session.delivery_settings.pickupAddress.postalCode}) {session.delivery_settings.pickupAddress.roadAddress}</p>
                    {session.delivery_settings.pickupAddress.addressDetail && (
                      <p>{session.delivery_settings.pickupAddress.addressDetail}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">미설정</p>
                )}
              </div>
            </div>
            {!canEditDeliverySettings && (
              <p className="text-xs text-gray-400 mt-3">주문 완료 후에는 수정할 수 없습니다.</p>
            )}
          </section>
        )}

        {/* Progress Bar Section */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">진행 상태</h2>
          <CoBuyProgressBar currentStatus={session.status} />
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">진행 현황</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <Users className="w-4 h-4" />
                참여 인원
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {session.current_participant_count}
                {session.max_participants ? (
                  <span className="text-sm text-gray-500"> / {session.max_participants}</span>
                ) : null}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <ShoppingBag className="w-4 h-4" />
                총 주문 수량
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {totalQuantity}
                <span className="text-sm text-gray-500">벌</span>
                {session.max_quantity ? (
                  <span className="text-sm text-gray-500"> / {session.max_quantity}</span>
                ) : null}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500 mb-2">
                {isSurveyMode ? '참여 완료 인원' : '결제 완료 인원'}
              </p>
              <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500 mb-2">
                {isSurveyMode ? '총 예상 금액' : '총 결제 금액'}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {totalPaid.toLocaleString('ko-KR')}원
              </p>
            </div>
          </div>

          {/* Min Quantity Info */}
          {session.min_quantity && (
            <div className="mt-4 p-4 bg-[#3B55A5]/10 rounded-xl">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-[#3B55A5] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-600">
                    최소 수량: {session.min_quantity}벌
                    {totalQuantity < session.min_quantity && (
                      <span className="text-red-600 ml-2">
                        ({session.min_quantity - totalQuantity}벌 더 필요)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              참여자 목록
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({filteredParticipants.length}{filteredParticipants.length !== participants.length ? ` / ${participants.length}` : ''}명)
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditingParticipant(null); setShowParticipantModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-black rounded-lg hover:bg-gray-800 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">수기 추가</span>
              </button>
              <button
                onClick={fetchSessionData}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                새로고침
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="이름, 이메일, 전화번호 검색..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-black focus:border-black"
              />
            </div>
            <select
              value={participantPaymentFilter}
              onChange={(e) => setParticipantPaymentFilter(e.target.value as typeof participantPaymentFilter)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="all">결제: 전체</option>
              <option value="pending">결제: 대기</option>
              <option value="completed">결제: 완료</option>
              <option value="failed">결제: 실패</option>
              <option value="refunded">결제: 환불</option>
            </select>
            <select
              value={participantPickupFilter}
              onChange={(e) => setParticipantPickupFilter(e.target.value as typeof participantPickupFilter)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="all">수령: 전체</option>
              <option value="pending">수령: 미수령</option>
              <option value="picked_up">수령: 완료</option>
            </select>
          </div>

          {filteredParticipants.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">
              {participants.length === 0 ? '아직 참여한 인원이 없습니다.' : '검색 결과가 없습니다.'}
            </p>
          ) : (
            <>
              {/* Mobile view - Accordion layout */}
              <div className="md:hidden space-y-2">
                {filteredParticipants.map((participant) => {
                  const paymentInfo = paymentLabels[participant.payment_status];
                  const isExpanded = expandedParticipants.has(participant.id);
                  const totalQty = participant.total_quantity || participant.selected_items?.reduce((sum, i) => sum + i.quantity, 0) || 1;

                  return (
                    <div key={participant.id} className="flex items-stretch gap-2">
                      {/* Accordion item */}
                      <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden">
                        {/* Accordion Header - Always visible */}
                        <div className="flex items-center bg-white hover:bg-gray-50 transition-colors">
                          <button
                            type="button"
                            onClick={() => toggleParticipantExpand(participant.id)}
                            className="flex-1 min-w-0 px-4 py-3 text-left"
                          >
                            <p className="font-medium text-gray-900 truncate">{participant.name}</p>
                            <p className="text-xs text-gray-500">{totalQty}벌 · {participant.payment_amount ? `₩${participant.payment_amount.toLocaleString()}` : (isSurveyMode ? '금액 미산정' : '미결제')}</p>
                          </button>
                          <div className="flex items-center gap-2 shrink-0 pr-3 flex-wrap justify-end">
                            {renderPickupStatusToggle(participant)}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentInfo.color}`}>
                              {paymentInfo.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleParticipantExpand(participant.id)}
                              className="p-1 -mr-1"
                              aria-label="펼치기"
                            >
                              <ChevronDown
                                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                      {/* Accordion Content - Expandable */}
                      <div
                        className={`overflow-hidden transition-all duration-200 ${
                          isExpanded ? 'max-h-96' : 'max-h-0'
                        }`}
                      >
                        <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50 space-y-3">
                          {/* Contact Info */}
                          <div className="text-sm">
                            {displayEmail(participant.email) && (
                              <p className="text-gray-600">{displayEmail(participant.email)}</p>
                            )}
                            {participant.phone && (
                              <p className="text-gray-600">{participant.phone}</p>
                            )}
                          </div>

                          {/* Order Details */}
                          <div className="text-sm">
                            <p className="text-xs text-gray-500 mb-1">주문 내역</p>
                            <div className="bg-white rounded-lg p-2">
                              {renderSelectedItems(participant)}
                            </div>
                          </div>

                          {/* Payment & Date */}
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-gray-500">{isSurveyMode ? '예상 금액' : '결제 금액'}</p>
                              <p className="font-medium text-gray-900">
                                {participant.payment_amount ? `₩${participant.payment_amount.toLocaleString()}` : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">참여일</p>
                              <p className="text-gray-700">
                                {formatKstDateOnly(participant.joined_at)}
                              </p>
                            </div>
                          </div>

                          {/* Delivery info */}
                          {renderDeliveryInfo(participant, 'mobile')}

                          {/* Custom field responses */}
                          {renderFieldResponses(participant, 'mobile')}

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-2 mt-2 border-t border-gray-200">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingParticipant(participant); setShowParticipantModal(true); }}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                              <Pencil className="w-3 h-3" /> 수정
                            </button>
                            {participant.payment_status === 'pending' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteParticipant(participant); }}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50"
                              >
                                <Trash2 className="w-3 h-3" /> 삭제
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop view - Table layout */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2 pr-4 font-medium whitespace-nowrap">참여자</th>
                      <th className="py-2 pr-4 font-medium whitespace-nowrap">주문 내역</th>
                      {showDeliveryColumn && (
                        <th className="py-2 pr-4 font-medium whitespace-nowrap">수령 방법</th>
                      )}
                      {showCustomFieldColumn && (
                        <th className="py-2 pr-4 font-medium whitespace-nowrap">추가 정보</th>
                      )}
                      <th className="py-2 pr-4 font-medium whitespace-nowrap">결제</th>
                      <th className="py-2 pr-4 font-medium whitespace-nowrap text-right">금액</th>
                      <th className="py-2 pr-4 font-medium whitespace-nowrap">참여일</th>
                      <th className="py-2 pr-4 font-medium whitespace-nowrap text-center">배부</th>
                      <th className="py-2 font-medium whitespace-nowrap text-center">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((participant) => {
                      const paymentInfo = paymentLabels[participant.payment_status];
                      const visibleEmail = displayEmail(participant.email);
                      return (
                        <tr key={participant.id} className="border-b last:border-b-0 align-top hover:bg-gray-50/50">
                          <td className="py-3 pr-4">
                            <div className="text-gray-900 font-medium">{participant.name}</div>
                            {visibleEmail && (
                              <div className="text-gray-500 text-xs truncate max-w-[200px]">{visibleEmail}</div>
                            )}
                            {participant.phone && (
                              <div className="text-gray-500 text-xs whitespace-nowrap">{participant.phone}</div>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-gray-600">
                            {renderSelectedItems(participant)}
                          </td>
                          {showDeliveryColumn && (
                            <td className="py-3 pr-4 text-gray-600">
                              {renderDeliveryInfo(participant, 'desktop') || (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </td>
                          )}
                          {showCustomFieldColumn && (
                            <td className="py-3 pr-4 text-gray-600">
                              {renderFieldResponses(participant, 'desktop') || (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </td>
                          )}
                          <td className="py-3 pr-4">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${paymentInfo.color}`}>
                              {paymentInfo.label}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-gray-700 whitespace-nowrap text-right tabular-nums">
                            {participant.payment_amount ? participant.payment_amount.toLocaleString('ko-KR') + '원' : '—'}
                          </td>
                          <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                            {formatKstDateOnly(participant.joined_at)}
                          </td>
                          <td className="py-3 pr-4 text-center">
                            {renderPickupStatusToggle(participant)}
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => { setEditingParticipant(participant); setShowParticipantModal(true); }}
                                title="수정"
                                className="p-2 text-gray-500 hover:text-[#3B55A5] hover:bg-blue-50 rounded-md transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {participant.payment_status === 'pending' && (
                                <button
                                  onClick={() => handleDeleteParticipant(participant)}
                                  title="삭제"
                                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Order Modal */}
      {session && (
        <CoBuyOrderModal
          isOpen={isOrderModalOpen}
          onClose={() => setIsOrderModalOpen(false)}
          session={session}
          participants={participants}
          onOrderCreated={handleOrderCreated}
          onSessionUpdated={handleSessionUpdated}
          shareToken={isTokenAccess ? routeShareToken : undefined}
        />
      )}

      {/* Delivery Settings Edit Modal */}
      {session && (
        <DeliverySettingsEditModal
          isOpen={isDeliverySettingsModalOpen}
          onClose={() => setIsDeliverySettingsModalOpen(false)}
          deliverySettings={session.delivery_settings}
          onSave={handleSaveDeliverySettings}
        />
      )}

      {/* Participant Add/Edit Modal */}
      {session && (
        <CoBuyParticipantModal
          isOpen={showParticipantModal}
          onClose={() => { setShowParticipantModal(false); setEditingParticipant(null); }}
          onSave={editingParticipant ? handleEditParticipant : handleAddParticipant}
          participant={editingParticipant}
          customFields={session.custom_fields}
          sizeOptions={sizeOptionsFromSession}
          sizePrices={session.size_prices}
          basePrice={(session as any).saved_design_screenshot?.price_per_item ?? null}
        />
      )}
    </div>
  );
}
