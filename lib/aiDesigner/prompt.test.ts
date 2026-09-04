import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArtworkPrompt, classifyPurpose, extractQuotedText, textAdvisory, validatePromptInput } from './prompt.ts';

test('emblem prompt forbids text and gradients, keeps customer request', () => {
  const b = buildArtworkPrompt({ request: '파란 방패 안에 번개, 축구팀 느낌', purpose: 'emblem', colorCount: 3 });
  assert.ok(b.prompt.includes('no text, no letters'));
  assert.ok(b.prompt.includes('exactly 3 colors'));
  assert.ok(b.prompt.includes('파란 방패 안에 번개'));
  assert.ok(b.negativePrompt.includes('gradient'));
  assert.ok(b.summary.includes('3색'));
});

test('wordmark prompt quotes the exact english text', () => {
  const b = buildArtworkPrompt({ request: '', purpose: 'wordmark', colorCount: 2, text: 'YONSEI 24' });
  assert.ok(b.prompt.includes('the only text is "YONSEI 24"'));
  assert.ok(!b.prompt.includes('no text, no letters'));
});

test('korean wordmark text is rejected with designer guidance', () => {
  const v = validatePromptInput({ request: '', purpose: 'wordmark', colorCount: 3, text: '연세대 24' });
  assert.equal(v.ok, false);
  if (!v.ok) assert.ok(v.error.includes('디자이너'));
  assert.equal(validatePromptInput({ request: '', purpose: 'wordmark', colorCount: 3, text: 'YONSEI' }).ok, true);
  assert.equal(validatePromptInput({ request: '', purpose: 'emblem', colorCount: 3 }).ok, false);
});

test('purpose classification and text advisory', () => {
  assert.equal(classifyPurpose('안경 쓴 북극곰 캐릭터'), 'mascot');
  assert.equal(classifyPurpose('"HANYANG" 글자 레터링'), 'wordmark');
  assert.equal(classifyPurpose('파란 방패와 번개'), 'emblem');
  assert.equal(extractQuotedText('"HANYANG" 글자 레터링'), 'HANYANG');
  assert.ok(textAdvisory({ request: '방패 안에 "24" 학번 넣어줘', purpose: 'emblem', colorCount: 3 }));
  assert.equal(textAdvisory({ request: '방패와 번개', purpose: 'emblem', colorCount: 3 }), null);
});
