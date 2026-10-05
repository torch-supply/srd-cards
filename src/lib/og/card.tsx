/**
 * Open Graph images (link previews), drawn with next/og by `pnpm og:emit`
 * (scripts/og.tsx). Build-time only: never import this from app code, or
 * next/og's wasm ends up in the Worker bundle.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { iconParts } from "../icon-parts";
import { OG_IMAGE_SIZE } from "../seo";
import type { CardKind } from "../srd/card-types";

/** Tailwind 400 shades (the dark-theme type colors in globals.css); satori can't read CSS variables. */
export const OG_TYPE_COLORS: Record<CardKind, string> = {
  class: "#fbbf24",
  subclass: "#fb923c",
  spell: "#a78bfa",
  monster: "#f87171",
  equipment: "#a8a29e",
  "magic-item": "#38bdf8",
  feat: "#34d399",
  condition: "#f472b6",
  rule: "#60a5fa",
  custom: "#a1a1aa",
};

const BACKGROUND = "#18181b";
const FOREGROUND = "#fafafa";
const MUTED = "#a1a1aa";

let assets: Promise<{ fonts: ArrayBuffer[]; logo: string }> | undefined;

function loadAssets() {
  const file = (...parts: string[]) =>
    readFile(path.join(process.cwd(), "src", ...parts));
  assets ??= Promise.all([
    file("lib", "og", "fonts", "Geist-Regular.ttf"),
    file("lib", "og", "fonts", "Geist-Medium.ttf"),
    file("lib", "og", "fonts", "CrimsonPro-SemiBold.ttf"),
    file("app", "icon.svg"),
  ]).then(([regular, medium, serif, logo]) => ({
    fonts: [regular, medium, serif].map((b) => Uint8Array.from(b).buffer),
    logo: `data:image/svg+xml;base64,${logo.toString("base64")}`,
  }));
  return assets;
}

/** A react-icons icon as a plain <svg> (satori can't render `IconBase`). */
export function ogIcon(Icon: IconType, color: string, size: number) {
  const { attr, children } = iconParts(Icon);
  return (
    <svg {...attr} width={size} height={size} fill={color}>
      {children}
    </svg>
  );
}

/** An icon in a tinted rounded square, like the site's TypeChip. */
export function OgChip({
  icon,
  color,
  size = 72,
}: {
  icon: IconType;
  color: string;
  size?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size / 4.5,
        background: `${color}26`,
      }}
    >
      {ogIcon(icon, color, Math.round(size * 0.66))}
    </div>
  );
}

function titleSize(title: string) {
  if (title.length <= 16) return 120;
  if (title.length <= 26) return 96;
  if (title.length <= 40) return 80;
  return 64;
}

export async function ogImage({
  accent,
  top,
  title,
  subtitle,
  footnote,
}: {
  accent: string;
  /** Row above the title: a type chip and label, or a row of chips. */
  top: ReactNode;
  title: string;
  subtitle?: string;
  /** Bottom right, opposite the logo. */
  footnote?: string;
}) {
  const { fonts, logo } = await loadAssets();
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: BACKGROUND,
        color: FOREGROUND,
        fontFamily: "Geist",
      }}
    >
      <div style={{ display: "flex", width: 20, background: accent }} />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px 56px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {top}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "block",
              lineClamp: 2,
              fontFamily: "Crimson Pro",
              fontSize: titleSize(title),
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -1,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                display: "block",
                lineClamp: 2,
                fontSize: 38,
                lineHeight: 1.3,
                color: MUTED,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 30,
            color: MUTED,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- satori renders plain <img> */}
            <img src={logo} width={52} height={52} alt="" />
            <div
              style={{
                fontFamily: "Crimson Pro",
                fontSize: 44,
                fontWeight: 600,
                color: FOREGROUND,
              }}
            >
              srd.cards
            </div>
          </div>
          {footnote && <div>{footnote}</div>}
        </div>
      </div>
    </div>,
    {
      ...OG_IMAGE_SIZE,
      fonts: [
        { name: "Geist", data: fonts[0], weight: 400, style: "normal" },
        { name: "Geist", data: fonts[1], weight: 500, style: "normal" },
        { name: "Crimson Pro", data: fonts[2], weight: 600, style: "normal" },
      ],
    },
  );
}

/** Type chip and uppercase label, e.g. the spell icon and "SPELL". */
export function OgTypeLabel({
  icon,
  color,
  label,
}: {
  icon: IconType;
  color: string;
  label: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <OgChip icon={icon} color={color} />
      <div
        style={{
          fontSize: 34,
          fontWeight: 500,
          letterSpacing: 3,
          textTransform: "uppercase",
          color,
        }}
      >
        {label}
      </div>
    </div>
  );
}
