import { create } from 'zustand';

// 웰컴쿠폰 오버레이(팝업/지급완료 모달)가 화면에 떠 있는지 공유하는 신호.
// 떠 있는 동안 챗봇 버블을 숨겨, 반투명 backdrop 너머로 비쳐 겹쳐 보이지 않게 한다.
interface WelcomeOverlayState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useWelcomeOverlayStore = create<WelcomeOverlayState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
