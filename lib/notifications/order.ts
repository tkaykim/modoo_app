import { sendGmailEmail } from '@/lib/gmail';
import { formatKstTodayLong } from '@/lib/kst';

interface OrderItemSummary {
  product_title: string;
  quantity: number;
  price_per_item: number;
}

interface OrderNotificationParams {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalAmount: number;
  deliveryFee: number;
  couponDiscount?: number;
  shippingMethod: 'domestic' | 'international' | 'pickup';
  orderCategory: 'regular' | 'cobuy';
  items: OrderItemSummary[];
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

function shippingMethodLabel(method: string): string {
  switch (method) {
    case 'domestic': return '국내 배송';
    case 'international': return '해외 배송';
    case 'pickup': return '직접 수령';
    default: return method;
  }
}

function buildItemsHtml(items: OrderItemSummary[]): string {
  return items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.product_title}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(item.price_per_item)}</td>
        </tr>`
    )
    .join('');
}

function buildCustomerHtml(params: OrderNotificationParams): string {
  const productTotal = params.items.reduce(
    (sum, item) => sum + item.price_per_item * item.quantity,
    0
  );
  const discount = params.couponDiscount || 0;
  const orderDate = formatKstTodayLong();

  return `
    <div style="max-width:600px;margin:0 auto;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#333;background:#ffffff;">
      <!-- Header with Logo -->
      <div style="background:#0052cc;padding:28px 24px;text-align:center;">
        <img src="https://modoouniform.com/icons/modoo_logo.png" alt="모두의 유니폼" style="height:36px;margin-bottom:16px;" />
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;">주문이 완료되었습니다</h1>
      </div>

      <!-- Thank You -->
      <div style="padding:28px 24px 0;">
        <p style="font-size:15px;margin:0 0 4px;"><strong>${params.customerName}</strong>님, 감사합니다!</p>
        <p style="font-size:13px;color:#666;margin:0;">주문이 정상적으로 접수되었습니다. 아래 내역을 확인해 주세요.</p>
      </div>

      <!-- Order Info -->
      <div style="padding:20px 24px;">
        <div style="background:#f8f9fa;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr>
              <td style="color:#888;padding:3px 0;width:80px;">주문번호</td>
              <td style="font-weight:600;padding:3px 0;">${params.orderId}</td>
            </tr>
            <tr>
              <td style="color:#888;padding:3px 0;">주문일시</td>
              <td style="padding:3px 0;">${orderDate}</td>
            </tr>
            <tr>
              <td style="color:#888;padding:3px 0;">배송방법</td>
              <td style="padding:3px 0;">${shippingMethodLabel(params.shippingMethod)}</td>
            </tr>
            ${params.orderCategory === 'cobuy' ? `<tr><td style="color:#888;padding:3px 0;">주문유형</td><td style="padding:3px 0;">공동구매</td></tr>` : ''}
          </table>
        </div>

        <!-- Items -->
        <p style="font-size:13px;font-weight:600;margin:0 0 8px;color:#333;">주문 상품</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:2px solid #333;">
              <th style="padding:8px 0;text-align:left;font-weight:600;">상품</th>
              <th style="padding:8px 0;text-align:center;font-weight:600;width:50px;">수량</th>
              <th style="padding:8px 0;text-align:right;font-weight:600;width:90px;">금액</th>
            </tr>
          </thead>
          <tbody>
            ${params.items.map(item => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #eee;">${item.product_title}</td>
                <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
                <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(item.price_per_item * item.quantity)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totals -->
        <div style="margin-top:16px;font-size:13px;">
          <div style="display:flex;justify-content:space-between;padding:4px 0;">
            <span style="color:#666;">상품 합계</span>
            <span>${formatCurrency(productTotal)}</span>
          </div>
          ${discount > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:4px 0;">
            <span style="color:#e74c3c;">쿠폰 할인</span>
            <span style="color:#e74c3c;">-${formatCurrency(discount)}</span>
          </div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:4px 0;">
            <span style="color:#666;">배송비</span>
            <span>${params.deliveryFee === 0 ? '무료' : formatCurrency(params.deliveryFee)}</span>
          </div>
          <div style="border-top:2px solid #333;margin-top:8px;padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:600;font-size:14px;">총 결제금액</span>
            <span style="font-weight:700;font-size:18px;color:#0052cc;">${formatCurrency(params.totalAmount)}</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="background:#f8f9fa;padding:20px 24px;margin-top:12px;text-align:center;font-size:12px;color:#999;">
        <p style="margin:0 0 8px;">문의사항이 있으시면 언제든 연락해 주세요.</p>
        <p style="margin:0;">카카오톡 채널: 모두의유니폼 &nbsp;|&nbsp; 전화: 010-8140-0621</p>
        <p style="margin:8px 0 0;color:#bbb;">모두의 유니폼 &nbsp;|&nbsp; 서울특별시 마포구 성지3길 55, 4층</p>
      </div>
    </div>
  `;
}

function buildAdminHtml(params: OrderNotificationParams): string {
  const adminUrl = 'https://admin.modoogoods.com';
  const orderDetailUrl = `${adminUrl}/orders/${params.orderId}`;

  return `
    <div style="max-width:600px;margin:0 auto;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#333;">
      <div style="background:#e74c3c;padding:24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:22px;">새 주문이 접수되었습니다</h1>
      </div>
      <div style="padding:24px;">
        <h3 style="margin-top:0;">주문 정보</h3>
        <p>주문번호: <strong>${params.orderId}</strong></p>
        <p>주문 유형: ${params.orderCategory === 'cobuy' ? '공동구매' : '일반 주문'}</p>

        <h3>고객 정보</h3>
        <p>이름: ${params.customerName}</p>
        <p>이메일: ${params.customerEmail}</p>
        <p>전화번호: ${params.customerPhone}</p>
        <p>배송 방법: ${shippingMethodLabel(params.shippingMethod)}</p>

        <h3>주문 상품</h3>
        <table style="width:100%;border-collapse:collapse;margin:8px 0;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px 12px;text-align:left;">상품</th>
              <th style="padding:8px 12px;text-align:center;">수량</th>
              <th style="padding:8px 12px;text-align:right;">단가</th>
            </tr>
          </thead>
          <tbody>
            ${buildItemsHtml(params.items)}
          </tbody>
        </table>

        <div style="border-top:2px solid #333;padding-top:12px;margin-top:8px;">
          ${params.couponDiscount ? `<p style="margin:4px 0;color:#e74c3c;">쿠폰 할인: -${formatCurrency(params.couponDiscount)}</p>` : ''}
          <p style="margin:4px 0;">배송비: ${formatCurrency(params.deliveryFee)}</p>
          <p style="margin:4px 0;font-size:18px;"><strong>총 결제금액: ${formatCurrency(params.totalAmount)}</strong></p>
        </div>

        <div style="text-align:center;margin:24px 0;">
          <a href="${orderDetailUrl}" style="display:inline-block;background:#e74c3c;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">주문 상세 보기</a>
        </div>
      </div>
    </div>
  `;
}

function buildCustomerText(params: OrderNotificationParams): string {
  const discount = params.couponDiscount || 0;
  const productTotal = params.items.reduce(
    (sum, item) => sum + item.price_per_item * item.quantity, 0
  );
  const itemLines = params.items
    .map((item) => `- ${item.product_title} x${item.quantity} : ${formatCurrency(item.price_per_item * item.quantity)}`)
    .join('\n');

  return [
    `[모두의 유니폼] 주문 확인서`,
    '',
    `${params.customerName}님, 감사합니다!`,
    `주문이 정상적으로 접수되었습니다.`,
    '',
    `주문번호: ${params.orderId}`,
    `배송 방법: ${shippingMethodLabel(params.shippingMethod)}`,
    '',
    '--- 주문 상품 ---',
    itemLines,
    '',
    `상품 합계: ${formatCurrency(productTotal)}`,
    ...(discount > 0 ? [`쿠폰 할인: -${formatCurrency(discount)}`] : []),
    `배송비: ${params.deliveryFee === 0 ? '무료' : formatCurrency(params.deliveryFee)}`,
    `총 결제금액: ${formatCurrency(params.totalAmount)}`,
    '',
    '문의: 카카오톡 채널 "모두의유니폼" / 010-8140-0621',
  ].join('\n');
}

function buildAdminText(params: OrderNotificationParams): string {
  const adminUrl = 'https://admin.modoogoods.com';
  const itemLines = params.items
    .map((item) => `- ${item.product_title} x${item.quantity} (${formatCurrency(item.price_per_item)})`)
    .join('\n');

  return [
    '새 주문이 접수되었습니다',
    `주문번호: ${params.orderId}`,
    `주문 유형: ${params.orderCategory === 'cobuy' ? '공동구매' : '일반 주문'}`,
    '',
    '고객 정보:',
    `이름: ${params.customerName}`,
    `이메일: ${params.customerEmail}`,
    `전화번호: ${params.customerPhone}`,
    '',
    '주문 상품:',
    itemLines,
    '',
    `총 결제금액: ${formatCurrency(params.totalAmount)}`,
    '',
    `주문 상세 보기: ${adminUrl}/orders/${params.orderId}`,
  ].join('\n');
}

async function sendOrderDiscordNotification(params: OrderNotificationParams): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const itemFields = params.items.map((item) => ({
    name: item.product_title,
    value: `${item.quantity}개 × ${formatCurrency(item.price_per_item)}`,
    inline: true,
  }));

  const discount = params.couponDiscount || 0;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: `🛒 새 주문 접수 — ${params.orderCategory === 'cobuy' ? '공동구매' : '일반 주문'}`,
        color: params.orderCategory === 'cobuy' ? 0xF39C12 : 0x2ECC71,
        fields: [
          { name: '주문번호', value: params.orderId, inline: false },
          { name: '고객명', value: params.customerName, inline: true },
          { name: '이메일', value: params.customerEmail, inline: true },
          { name: '연락처', value: params.customerPhone, inline: true },
          ...itemFields,
          ...(discount > 0 ? [{ name: '쿠폰 할인', value: `-${formatCurrency(discount)}`, inline: true }] : []),
          { name: '배송비', value: formatCurrency(params.deliveryFee), inline: true },
          { name: '총 결제금액', value: `**${formatCurrency(params.totalAmount)}**`, inline: true },
          { name: '배송 방법', value: shippingMethodLabel(params.shippingMethod), inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    }),
  });

  if (!response.ok) {
    console.error('Discord order notification failed:', await response.text());
  }
}

export async function sendOrderNotificationEmails(
  params: OrderNotificationParams
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;

  // Send customer confirmation email
  try {
    await sendGmailEmail({
      to: [{ email: params.customerEmail, name: params.customerName }],
      subject: `[모두의 유니폼] 주문이 완료되었습니다 (${params.orderId})`,
      text: buildCustomerText(params),
      html: buildCustomerHtml(params),
    });
  } catch (error) {
    console.error('Failed to send customer order confirmation email:', error);
  }

  // Send admin notification email
  if (adminEmail) {
    try {
      await sendGmailEmail({
        to: [{ email: adminEmail }],
        subject: `[새 주문] ${params.customerName} - ${formatCurrency(params.totalAmount)} (${params.orderId})`,
        text: buildAdminText(params),
        html: buildAdminHtml(params),
      });
    } catch (error) {
      console.error('Failed to send admin order notification email:', error);
    }
  }

  // Send Discord notification
  try {
    await sendOrderDiscordNotification(params);
  } catch (error) {
    console.error('Failed to send Discord order notification:', error);
  }
}
