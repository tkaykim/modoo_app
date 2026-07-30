import type { Metadata } from "next";
import LandingV1 from "./LandingV1";

export const metadata: Metadata = {
  title: "같이 입으면, 같이 잘됩니다",
  description:
    "팀의 첫인상과 단합을 만드는 모두의 유니폼 단체복 제작 랜딩페이지입니다.",
  alternates: { canonical: "/landing/v1" },
};

export default function LandingV1Page() {
  return <LandingV1 />;
}
