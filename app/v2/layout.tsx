import * as React from "react";
import "./v2.css";

export default function V2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      <div
        className="modoo modoo-root"
        style={{
          height: "100dvh",
          background: "#f0eee9",
          maxWidth: 480,
          margin: "0 auto",
          position: "relative",
          overflowY: "auto",
          overflowX: "hidden",
          transform: "translateZ(0)",
        }}
      >
        {children}
      </div>
    </>
  );
}
