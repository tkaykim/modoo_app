/* 신규회원 1만원 쿠폰 히어로 배너 생성 (1200x600, 2:1).
 * @napi-rs/canvas + Windows Malgun Gothic 으로 한글 렌더.
 * 출력: public/welcome-banner.jpg  (배포 후 사이트 URL로 서빙)
 * 재생성: node scripts/gen-welcome-banner.cjs
 */
const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

// --- 한글 폰트 등록 (Windows 기본 맑은고딕) ---
const FONTS = [
  ['C:/Windows/Fonts/malgunbd.ttf', 'MalgunBold'],
  ['C:/Windows/Fonts/malgun.ttf', 'Malgun'],
];
for (const [p, name] of FONTS) {
  if (fs.existsSync(p)) GlobalFonts.registerFromPath(p, name);
}
const BOLD = 'MalgunBold';
const REG = 'Malgun';

const W = 1200, H = 600;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// 색
const GOLD = '#f6b733', GOLD_LIGHT = '#ffe08a', GOLD_DEEP = '#e69c1f';

// --- 배경: 다크 네이비 라디얼 ---
const bg = ctx.createRadialGradient(W * 0.5, -120, 120, W * 0.5, H * 0.4, W * 0.85);
bg.addColorStop(0, '#2a3a63');
bg.addColorStop(0.55, '#161d2e');
bg.addColorStop(1, '#0c111c');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);

// 좌측 광원
const glow = ctx.createRadialGradient(330, 300, 20, 330, 300, 420);
glow.addColorStop(0, 'rgba(246,183,51,0.16)');
glow.addColorStop(1, 'rgba(246,183,51,0)');
ctx.fillStyle = glow;
ctx.fillRect(0, 0, W, H);

// --- 컨페티 ---
const confetti = [
  [120, 90, 14, GOLD, 20], [250, 60, 10, '#9db4e6', 45], [600, 80, 12, GOLD_LIGHT, 12],
  [160, 470, 12, GOLD, 30], [70, 300, 9, '#c7d3ef', 60], [520, 510, 11, GOLD_LIGHT, 50],
  [690, 200, 9, GOLD, 15], [40, 180, 8, '#9db4e6', 35],
];
for (const [x, y, s, c, r] of confetti) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((r * Math.PI) / 180);
  ctx.fillStyle = c;
  ctx.globalAlpha = 0.9;
  roundRect(ctx, -s / 2, -s / 2, s, s, 2);
  ctx.fill();
  ctx.restore();
}
ctx.globalAlpha = 1;

// --- 좌측 텍스트 ---
const LX = 80;

// eyebrow
ctx.fillStyle = GOLD;
ctx.font = `28px ${BOLD}`;
ctx.textBaseline = 'alphabetic';
ctx.fillText('신규회원 한정 특별 혜택', LX, 165);

// headline line1
ctx.fillStyle = '#ffffff';
ctx.font = `74px ${BOLD}`;
ctx.fillText('신규회원', LX, 255);

// headline line2 (gold gradient)
ctx.font = `74px ${BOLD}`;
const goldGrad = ctx.createLinearGradient(LX, 270, LX, 350);
goldGrad.addColorStop(0, GOLD_LIGHT);
goldGrad.addColorStop(1, GOLD_DEEP);
ctx.fillStyle = goldGrad;
ctx.fillText('1만원 쿠폰 지급', LX, 340);

// sub
ctx.fillStyle = '#cbd5e1';
ctx.font = `26px ${REG}`;
ctx.fillText('가입 즉시 지급 · 5만원 이상 주문 시 사용 · 30일 이내', LX, 400);

// CTA pill
const pillY = 440, pillH = 60, pillW = 300;
const pillGrad = ctx.createLinearGradient(LX, pillY, LX + pillW, pillY);
pillGrad.addColorStop(0, GOLD_LIGHT);
pillGrad.addColorStop(1, GOLD);
ctx.fillStyle = pillGrad;
roundRect(ctx, LX, pillY, pillW, pillH, 30);
ctx.fill();
ctx.fillStyle = '#3d2c00';
ctx.font = `27px ${BOLD}`;
ctx.fillText('지금 가입하고 받기  →', LX + 34, pillY + 39);

// --- 우측 쿠폰 티켓 ---
drawTicket(ctx, 945, 300, 360, 215, -7);

// 저장
(async () => {
  const buf = await canvas.encode('jpeg', 92);
  const out = path.join(__dirname, '..', 'public', 'welcome-banner.jpg');
  fs.writeFileSync(out, buf);
  console.log('written', out, (buf.length / 1024).toFixed(0) + 'KB');
})();

// ---- helpers ----
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTicket(ctx, cx, cy, w, h, rotDeg) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);

  // 그림자
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;

  const x = -w / 2, y = -h / 2;
  // 본체(흰색)
  const body = ctx.createLinearGradient(x, y, x + w, y + h);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(1, '#e9eef6');
  ctx.fillStyle = body;
  roundRect(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // 골드 스텁(우측 34%)
  const stubW = w * 0.34;
  const stubX = x + w - stubW;
  ctx.save();
  roundRect(ctx, x, y, w, h, 22);
  ctx.clip();
  const stub = ctx.createLinearGradient(stubX, y, stubX + stubW, y + h);
  stub.addColorStop(0, GOLD_LIGHT);
  stub.addColorStop(0.55, GOLD);
  stub.addColorStop(1, GOLD_DEEP);
  ctx.fillStyle = stub;
  ctx.fillRect(stubX, y, stubW, h);
  // 광택
  ctx.globalAlpha = 0.5;
  const sheen = ctx.createLinearGradient(stubX, y, stubX + stubW, y + h);
  sheen.addColorStop(0.3, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  sheen.addColorStop(0.7, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(stubX, y, stubW, h);
  ctx.globalAlpha = 1;
  ctx.restore();

  // 퍼포레이션(절취 점선 + 원형 컷)
  ctx.fillStyle = '#161d2e';
  ctx.beginPath(); ctx.arc(stubX, y, 11, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(stubX, y + h, 11, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(100,116,139,0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 7]);
  ctx.beginPath(); ctx.moveTo(stubX, y + 16); ctx.lineTo(stubX, y + h - 16); ctx.stroke();
  ctx.setLineDash([]);

  // 본체 텍스트
  ctx.fillStyle = '#94a3b8';
  ctx.font = `22px ${BOLD}`;
  ctx.fillText('COUPON', x + 34, y + 56);
  // 1만원
  const t = ctx.createLinearGradient(x, y + 70, x, y + 150);
  t.addColorStop(0, '#1f2a44');
  t.addColorStop(1, '#33446b');
  ctx.fillStyle = t;
  ctx.font = `76px ${BOLD}`;
  ctx.fillText('1만원', x + 30, y + 145);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `19px ${REG}`;
  ctx.fillText('신규회원 할인쿠폰', x + 34, y + 178);

  // 스텁 세로 글자
  ctx.save();
  ctx.translate(stubX + stubW / 2, 0);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = 'rgba(120,80,10,0.85)';
  ctx.font = `20px ${BOLD}`;
  ctx.textAlign = 'center';
  ctx.fillText('WELCOME', 0, 6);
  ctx.restore();

  ctx.restore();
}
