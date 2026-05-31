'use client';

import { ChatMessage as ChatMessageType, QuickReply, Priority, PrintLocation, PrintMethodChoice, DesignType, ColorCount, DesignSizeCounts } from '@/lib/chatbot/types';
import { LogIn } from 'lucide-react';
import ProductCard from './ProductCard';
import PricingTable from './PricingTable';
import QuickReplies from './QuickReplies';
import DatePickerBubble from './DatePickerBubble';
import PrioritySelectorBubble from './PrioritySelectorBubble';
import ContactFormBubble from './ContactFormBubble';
import LocationSelectorBubble from './LocationSelectorBubble';
import DesignSizeBubble from './DesignSizeBubble';
import QuantityInputBubble from './QuantityInputBubble';
import PrintMethodBubble from './PrintMethodBubble';
import RecommendationCard from './RecommendationCard';

interface ChatMessageProps {
  message: ChatMessageType;
  onQuickReplyClick: (reply: QuickReply) => void;
  onProductClick: (productId: string) => void;
  isLastBotMessage?: boolean;
  onDateSubmit?: (date: string | null, flexible: boolean) => void;
  onPrioritiesSubmit?: (priorities: Priority[]) => void;
  onContactSubmit?: (name: string, email: string, phone: string) => void;
  onLocationSubmit?: (locations: PrintLocation[]) => void;
  onDesignSizeSubmit?: (counts: DesignSizeCounts) => void;
  onQuantitySubmit?: (qty: number) => void;
  onMethodSelect?: (method: PrintMethodChoice) => void;
  onConsult?: (productId?: string) => void;
  designType?: DesignType;
  colorCount?: ColorCount;
  isTyping?: boolean;
  isSubmitting?: boolean;
}

export default function ChatMessage({
  message,
  onQuickReplyClick,
  onProductClick,
  isLastBotMessage,
  onDateSubmit,
  onPrioritiesSubmit,
  onContactSubmit,
  onLocationSubmit,
  onDesignSizeSubmit,
  onQuantitySubmit,
  onMethodSelect,
  onConsult,
  designType,
  colorCount,
  isTyping,
  isSubmitting
}: ChatMessageProps) {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] ${
          isUser
            ? 'bg-[#0052CC] text-white rounded-2xl rounded-br-md px-4 py-2'
            : 'bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md px-4 py-2'
        }`}
      >
        {/* Login prompt icon */}
        {message.contentType === 'login_prompt' && (
          <div className="flex items-center gap-2 mb-2 text-amber-600">
            <LogIn className="w-4 h-4" />
            <span className="text-sm font-medium">로그인 필요</span>
          </div>
        )}

        {/* Text content */}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {/* Product recommendations */}
        {message.contentType === 'products' && message.metadata?.products && (
          <div className="mt-3 space-y-2">
            {message.metadata.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => onProductClick(product.id)}
              />
            ))}
          </div>
        )}

        {/* Pricing table */}
        {message.contentType === 'pricing' && message.metadata?.pricingData && (
          <div className="mt-3">
            <PricingTable data={message.metadata.pricingData} />
          </div>
        )}

        {/* Date picker - only show on last bot message */}
        {message.contentType === 'date_picker' && isLastBotMessage && onDateSubmit && (
          <DatePickerBubble
            onSubmit={onDateSubmit}
            disabled={isTyping}
          />
        )}

        {/* Priority selector - only show on last bot message */}
        {message.contentType === 'priority_selector' && isLastBotMessage && onPrioritiesSubmit && (
          <PrioritySelectorBubble
            onSubmit={onPrioritiesSubmit}
            disabled={isTyping}
          />
        )}

        {/* Contact form - only show on last bot message */}
        {message.contentType === 'contact_form' && isLastBotMessage && onContactSubmit && (
          <ContactFormBubble
            onSubmit={onContactSubmit}
            disabled={isTyping}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Print location multi-select - only show on last bot message */}
        {message.contentType === 'location_selector' && isLastBotMessage && onLocationSubmit && (
          <LocationSelectorBubble
            onSubmit={onLocationSubmit}
            disabled={isTyping}
          />
        )}

        {/* Design size counts - only show on last bot message */}
        {message.contentType === 'design_size_input' && isLastBotMessage && onDesignSizeSubmit && (
          <DesignSizeBubble
            onSubmit={onDesignSizeSubmit}
            disabled={isTyping}
          />
        )}

        {/* Quantity number input - only show on last bot message */}
        {message.contentType === 'quantity_input' && isLastBotMessage && onQuantitySubmit && (
          <QuantityInputBubble
            onSubmit={onQuantitySubmit}
            disabled={isTyping}
          />
        )}

        {/* Print method picker - only show on last bot message */}
        {message.contentType === 'print_method' && isLastBotMessage && onMethodSelect && (
          <PrintMethodBubble
            recommendedMethod={message.metadata?.recommendedMethod}
            methodQuotes={message.metadata?.methodQuotes}
            designType={designType}
            colorCount={colorCount}
            onSelect={onMethodSelect}
            disabled={isTyping}
          />
        )}

        {/* Recommendation + estimate card - only show on last bot message */}
        {message.contentType === 'recommendation_card' && isLastBotMessage && message.metadata?.recommendation && onConsult && (
          <RecommendationCard
            recommendation={message.metadata.recommendation}
            products={message.metadata.products || []}
            onProductClick={onProductClick}
            onConsult={onConsult}
            disabled={isTyping || isSubmitting}
          />
        )}

        {/* Quick replies - only show on last bot message */}
        {!isUser && isLastBotMessage && message.metadata?.quickReplies && (
          <QuickReplies
            replies={message.metadata.quickReplies}
            onReplyClick={onQuickReplyClick}
          />
        )}
      </div>
    </div>
  );
}
