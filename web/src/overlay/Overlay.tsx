import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import { keyframes } from "@mui/material/styles";
import type { CounterState } from "../../../supabase/functions/_shared/protocol.ts";
import { tokens } from "../theme.ts";
import { diffKind, formatCount, type DiffKind } from "./format.ts";

// --- Motion ------------------------------------------------------------------
// A gust of wind (three turquoise streaks) blows across the panel on every change.
// up: left -> right, down: right -> left, reset: a slower, wider sand sweep.

const gustRight = keyframes`
  0%   { transform: translateX(-110%); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translateX(110%); opacity: 0; }
`;
const gustLeft = keyframes`
  0%   { transform: translateX(110%) scaleX(-1); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translateX(-110%) scaleX(-1); opacity: 0; }
`;
const numberUp = keyframes`
  0%   { transform: translateY(0.35em); opacity: 0; filter: blur(3px); }
  60%  { transform: translateY(-0.05em); opacity: 1; filter: blur(0); }
  100% { transform: translateY(0); }
`;
const numberDown = keyframes`
  0%   { transform: translateY(-0.35em); opacity: 0; filter: blur(3px); }
  60%  { transform: translateY(0.05em); opacity: 1; filter: blur(0); }
  100% { transform: translateY(0); }
`;
const numberReset = keyframes`
  0%   { transform: translateX(-0.4em) skewX(-14deg); opacity: 0; filter: blur(4px); }
  100% { transform: none; opacity: 1; filter: blur(0); }
`;

const numberMotion: Record<Exclude<DiffKind, "none">, string> = {
  up: `${numberUp} 520ms cubic-bezier(.2,.8,.3,1)`,
  down: `${numberDown} 520ms cubic-bezier(.2,.8,.3,1)`,
  reset: `${numberReset} 800ms cubic-bezier(.2,.8,.3,1)`,
};

const reducedMotion = "@media (prefers-reduced-motion: reduce)";

// --- Static artwork (own SVGs) ----------------------------------------------

/** A tapered brush stroke that curls like a gust; sits under the title. */
function WindStroke() {
  return (
    <Box component="svg" viewBox="0 0 220 14" aria-hidden sx={{ display: "block", width: 220, height: 14 }}>
      <path
        d="M2 9 C 40 3, 90 12, 140 7 S 200 2, 214 6 C 218 7, 216 10, 211 9 C 196 6, 170 11, 140 10 C 90 15, 40 7, 2 9 Z"
        fill={tokens.wind}
        opacity={0.9}
      />
    </Box>
  );
}

/** Three curved streaks used by the gust animation. */
function Gust() {
  return (
    <svg viewBox="0 0 400 160" width="400" height="160" aria-hidden>
      <g fill="none" stroke={tokens.wind} strokeLinecap="round">
        <path d="M20 52 C 120 34, 220 70, 380 44" strokeWidth="2.5" opacity="0.85" />
        <path d="M60 92 C 160 74, 250 110, 360 86" strokeWidth="1.6" opacity="0.6" />
        <path d="M10 124 C 110 112, 200 136, 330 118" strokeWidth="1.2" opacity="0.45" />
      </g>
    </svg>
  );
}

/** Faint sand-dune contours drifting in from the bottom right of the panel. */
function Dunes() {
  return (
    <Box
      component="svg"
      viewBox="0 0 384 144"
      aria-hidden
      sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <g fill="none" stroke={tokens.ochre} strokeLinecap="round">
        <path d="M150 144 C 210 112, 270 104, 384 96" strokeWidth="1.2" opacity="0.16" />
        <path d="M210 144 C 260 122, 310 116, 384 112" strokeWidth="1.2" opacity="0.12" />
        <path d="M270 144 C 310 132, 340 128, 384 127" strokeWidth="1.2" opacity="0.09" />
      </g>
    </Box>
  );
}

/** Square seal stamp with the kanji 風 ("wind"). */
function WindSeal() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 84,
        height: 84,
        flex: "0 0 auto",
        display: "grid",
        placeItems: "center",
        bgcolor: tokens.terracotta,
        borderRadius: "5px 9px 6px 10px",
        transform: "rotate(-4deg)",
        boxShadow: `inset 0 0 0 3px ${tokens.terracotta}, inset 0 0 0 5px ${tokens.sandLight}cc, 0 2px 0 #0006`,
        color: tokens.sandLight,
        fontSize: 58,
        fontWeight: 900,
        lineHeight: 1,
        textShadow: "0 1px 0 #0004",
      }}
    >
      風
    </Box>
  );
}

// --- Overlay -----------------------------------------------------------------

interface Motion {
  kind: Exclude<DiffKind, "none">;
  seq: number;
}

export function Overlay({ state }: { state: CounterState | null }) {
  const prev = useRef<CounterState | null>(null);
  const [motion, setMotion] = useState<Motion | null>(null);

  useEffect(() => {
    if (state === null) return;
    const kind = diffKind(prev.current, state);
    prev.current = state;
    if (kind !== "none") setMotion((m) => ({ kind, seq: (m?.seq ?? 0) + 1 }));
  }, [state]);

  const session = formatCount(state?.session ?? 0);
  const total = formatCount(state?.total ?? 0);
  const animatedNumber = motion
    ? { animation: numberMotion[motion.kind], [reducedMotion]: { animation: "none" } }
    : {};

  return (
    <Box
      sx={{
        width: 400,
        height: 160,
        p: "8px",
        pointerEvents: "none",
        userSelect: "none",
        // Outline the whole (clipped) panel so it stays visible on bright game scenes.
        // Warm rim first (separates it from dark scenes), then a dark halo (bright scenes).
        filter: `drop-shadow(0 0 0.6px ${tokens.ochre}) drop-shadow(0 0 1px #000a) drop-shadow(0 3px 6px #0008)`,
      }}
    >
      <Box
        sx={{
          position: "relative",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: "18px",
          pl: "20px",
          pr: "22px",
          overflow: "hidden",
          color: tokens.sand,
          background: `linear-gradient(100deg, ${tokens.ink}f0 0%, ${tokens.ink}e6 55%, ${tokens.inkSoft}e0 100%)`,
          // Wind-cut corner on the top right, a little notch bottom left.
          clipPath: "polygon(0 0, calc(100% - 34px) 0, 100% 34px, 100% 100%, 14px 100%, 0 calc(100% - 14px))",
          // Sand-coloured hairline along the top edge, like a scroll's mount.
          boxShadow: `inset 0 2px 0 ${tokens.ochre}99, inset 0 -1px 0 ${tokens.sand}33`,
        }}
      >
        {motion && (
          <Box
            key={`gust-${motion.seq}`}
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              animation: `${motion.kind === "down" ? gustLeft : gustRight} ${motion.kind === "reset" ? 1100 : 750}ms ease-out`,
              [reducedMotion]: { animation: "none" },
            }}
          >
            <Gust />
          </Box>
        )}

        <Dunes />
        <WindSeal />

        <Box sx={{ position: "relative", flex: 1, minWidth: 0 }}>
          <Box
            component="h1"
            sx={{
              m: 0,
              fontSize: 17,
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "0.01em",
              color: tokens.sandLight,
              whiteSpace: "nowrap",
            }}
          >
            Fragen an den Kazekage
          </Box>
          <Box sx={{ mt: "3px", mb: "6px", ml: "-2px" }}>
            <WindStroke />
          </Box>

          <Box
            component="dl"
            sx={{
              m: 0,
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "baseline",
              columnGap: "12px",
              "& dt": { fontSize: 15, fontWeight: 500, color: `${tokens.sand}d0` },
              "& dd": { m: 0, textAlign: "right", fontVariantNumeric: "tabular-nums", lineHeight: 1 },
            }}
          >
            <dt>Dieser Stream</dt>
            <Box
              component="dd"
              sx={{ fontSize: 48, fontWeight: 900, color: tokens.sandLight, textShadow: "0 2px 0 #0007" }}
            >
              <Box
                component="span"
                key={`s-${motion?.seq ?? 0}`}
                data-testid="session-value"
                sx={{ display: "inline-block", ...animatedNumber }}
              >
                {session}
              </Box>
            </Box>

            <dt>Insgesamt</dt>
            <Box
              component="dd"
              sx={{ fontSize: 22, fontWeight: 700, color: tokens.ochre, mt: "2px", textShadow: "0 1px 0 #0007" }}
            >
              <Box
                component="span"
                key={`t-${motion?.seq ?? 0}`}
                data-testid="total-value"
                sx={{ display: "inline-block", ...(motion?.kind === "reset" ? {} : animatedNumber) }}
              >
                {total}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
