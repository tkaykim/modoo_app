"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  HeartHandshake,
  Palette,
  PartyPopper,
  Sparkles,
  Store,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import Footer from "@/app/components/Footer";
import Header from "@/app/components/Header";
import styles from "./landing-v1.module.css";

const teamModes = [
  {
    id: "store",
    label: "매장 팀",
    title: "손님이 먼저 알아봐요.",
    description: "팀의 첫인상이 또렷해지면, 매장도 기억에 남습니다.",
    bubble: "여기, 기억나요!",
    note: "브랜드 첫인상",
    values: [92, 82, 88],
    icon: Store,
    color: "coral",
  },
  {
    id: "club",
    label: "동호회",
    title: "마음이 한 팀이 돼요.",
    description: "같은 옷 한 장이 함께 뛰는 이유를 더 선명하게 만듭니다.",
    bubble: "우리 팀 맞죠?",
    note: "팀의 결속감",
    values: [78, 96, 84],
    icon: UsersRound,
    color: "blue",
  },
  {
    id: "event",
    label: "행사 팀",
    title: "사람들 사이에서 빛나요.",
    description: "누가 우리 팀인지 한눈에 보여, 만남도 안내도 편해집니다.",
    bubble: "저기서 만나요!",
    note: "현장의 존재감",
    values: [88, 86, 94],
    icon: PartyPopper,
    color: "yellow",
  },
] as const;

type TeamModeId = (typeof teamModes)[number]["id"];

const benefits = [
  {
    icon: Sparkles,
    number: "01",
    title: "한눈에 보이는 팀",
    description: "고객도, 멤버도 우리를 더 빨리 알아봐요.",
    color: "yellow",
  },
  {
    icon: HeartHandshake,
    number: "02",
    title: "같이 움직이는 마음",
    description: "역할이 달라도 한 팀이라는 감각이 생겨요.",
    color: "coral",
  },
  {
    icon: Store,
    number: "03",
    title: "기억에 남는 매장",
    description: "좋은 첫인상이 다시 찾는 마음의 시작이 됩니다.",
    color: "blue",
  },
];

const steps = [
  { number: "01", title: "입을 옷 고르기", description: "티셔츠부터 후드까지." },
  { number: "02", title: "우리 팀 넣기", description: "색과 문구를 담아요." },
  { number: "03", title: "함께 입기", description: "이제, 우리 팀의 얼굴." },
];

export default function LandingV1() {
  const [activeMode, setActiveMode] = useState<TeamModeId>("store");
  const active = teamModes.find((mode) => mode.id === activeMode) ?? teamModes[0];
  const ActiveIcon = active.icon;

  const scrollToStart = () => {
    document.getElementById("landing-start")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className={styles.page}>
      <Header showHomeNav />

      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <span aria-hidden="true" />
              모두의 유니폼
            </p>
            <h1 id="hero-title">
              같이 입으면,
              <br />
              <em>같이 잘됩니다.</em>
            </h1>
            <p className={styles.heroDescription}>
              단체복 한 장으로,
              <br />
              우리 팀의 분위기가 달라져요.
            </p>
            <div className={styles.heroActions}>
              <button type="button" className={styles.primaryButton} onClick={scrollToStart}>
                우리 팀 시작하기
                <ArrowRight aria-hidden="true" size={19} strokeWidth={2.5} />
              </button>
              <a className={styles.textButton} href="#why">
                이유 보기
                <ChevronDown aria-hidden="true" size={18} strokeWidth={2.5} />
              </a>
            </div>
            <p className={styles.heroNote}>
              <Check aria-hidden="true" size={15} strokeWidth={3} />
              디자인부터 제작까지, 한 번에
            </p>
          </div>

          <div className={styles.heroVisual} aria-label="맞춤 단체복을 입은 세 명의 팀원">
            <span className={`${styles.speechBubble} ${styles.speechOne}`}>우리 팀 맞죠?</span>
            <span className={`${styles.speechBubble} ${styles.speechTwo}`}>오늘도 파이팅!</span>
            <span className={styles.rayOne} aria-hidden="true" />
            <span className={styles.rayTwo} aria-hidden="true" />
            <div className={styles.clayStage}>
              <span className={styles.stageTab}>TEAM MODE ON</span>
              <Image
                className={styles.clayTeam}
                src="/pictures/landing/v1/hero-clay-team-cropped.png"
                alt="맞춤 단체복을 입고 즐겁게 하이파이브하는 팀원들"
                width={1010}
                height={1185}
                priority
                sizes="(max-width: 720px) 95vw, (max-width: 1100px) 50vw, 530px"
              />
            </div>
            <span className={`${styles.smallSticker} ${styles.stickerBlue}`}>ONE TEAM</span>
            <span className={`${styles.smallSticker} ${styles.stickerYellow}`}>GOOD DAY</span>
          </div>
        </section>

        <section id="why" className={styles.whySection} aria-labelledby="why-title">
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>
              <span aria-hidden="true" />
              한 장이 만드는 변화
            </p>
            <h2 id="why-title">
              옷이 바꾸는 건,
              <br />
              생각보다 많아요.
            </h2>
          </div>

          <div className={styles.benefitGrid}>
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <article key={benefit.number} className={`${styles.benefit} ${styles[benefit.color]}`}>
                  <div className={styles.benefitTopline}>
                    <span>{benefit.number}</span>
                    <Icon aria-hidden="true" size={24} strokeWidth={2.25} />
                  </div>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.description}</p>
                </article>
              );
            })}
          </div>

          <p className={styles.memoryLine}>
            매출은 결국, <strong>기억나는 팀과 매장</strong>에서 시작돼요.
          </p>
        </section>

        <section id="team" className={styles.teamSection} aria-labelledby="team-title">
          <div className={styles.teamHeader}>
            <p className={styles.eyebrow}>
              <span aria-hidden="true" />
              우리 팀의 순간
            </p>
            <h2 id="team-title">
              어디에서,
              <br />
              함께 빛날까요?
            </h2>
          </div>

          <div className={styles.modeControls} role="tablist" aria-label="팀 사용 장면 선택">
            {teamModes.map((mode) => {
              const Icon = mode.icon;
              const isActive = activeMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`${styles.modeButton} ${isActive ? styles.modeButtonActive : ""}`}
                  onClick={() => setActiveMode(mode.id)}
                >
                  <Icon aria-hidden="true" size={19} strokeWidth={2.4} />
                  {mode.label}
                </button>
              );
            })}
          </div>

          <div className={`${styles.modePanel} ${styles[`mode${active.color[0].toUpperCase()}${active.color.slice(1)}`]}`} role="tabpanel">
            <div className={styles.modeCopy}>
              <span className={styles.modeIcon}>
                <ActiveIcon aria-hidden="true" size={28} strokeWidth={2.2} />
              </span>
              <p>{active.note}</p>
              <h3>{active.title}</h3>
              <span className={styles.dynamicBubble}>{active.bubble}</span>
              <p className={styles.modeDescription}>{active.description}</p>
            </div>
            <div className={styles.signalBoard} aria-label={`${active.label} 기대 효과`}>
              <div className={styles.signalRow}>
                <span>첫인상</span>
                <span className={styles.signalTrack}>
                  <i style={{ width: `${active.values[0]}%` }} />
                </span>
              </div>
              <div className={styles.signalRow}>
                <span>팀워크</span>
                <span className={styles.signalTrack}>
                  <i style={{ width: `${active.values[1]}%` }} />
                </span>
              </div>
              <div className={styles.signalRow}>
                <span>존재감</span>
                <span className={styles.signalTrack}>
                  <i style={{ width: `${active.values[2]}%` }} />
                </span>
              </div>
              <p>우리 팀의 온도, UP</p>
            </div>
          </div>
        </section>

        <section id="how" className={styles.howSection} aria-labelledby="how-title">
          <div className={styles.howHeader}>
            <p className={styles.eyebrow}>
              <span aria-hidden="true" />
              어렵지 않아요
            </p>
            <h2 id="how-title">
              우리 팀이 되는,
              <br />
              단 세 걸음.
            </h2>
          </div>
          <div className={styles.steps}>
            {steps.map((step) => (
              <article key={step.number} className={styles.step}>
                <span>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="landing-start" className={styles.ctaSection} aria-labelledby="cta-title">
          <div className={styles.ctaCopy}>
            <p className={styles.eyebrow}>
              <span aria-hidden="true" />
              이제 우리 팀 차례
            </p>
            <h2 id="cta-title">
              우리 팀의 얼굴,
              <br />
              오늘 만들어봐요.
            </h2>
            <p>예산과 수량만 알려주시면, 딱 맞는 제작 방법을 함께 찾아드릴게요.</p>
          </div>
          <div className={styles.ctaActions}>
            <Link href="/inquiries/new" className={styles.primaryButton}>
              무료 견적 받기
              <ArrowRight aria-hidden="true" size={19} strokeWidth={2.5} />
            </Link>
            <Link href="/home" className={styles.secondaryButton}>
              옷부터 둘러보기
              <Palette aria-hidden="true" size={18} strokeWidth={2.3} />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
