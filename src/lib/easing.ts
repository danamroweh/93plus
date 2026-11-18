/**
 * GSAP's easing curves as CSS `linear()` strings, for the browser's own
 * animation API (element.animate). Same maths GSAP uses, sampled finely
 * enough that the motion is indistinguishable — which is what let the card
 * reveal, the cursor and the cart sparkle drop the 27 KB library from every
 * page. Browsers without `linear()` (pre-2023) get the closest cubic-bezier.
 */

type Curve = (p: number) => number;

/** GSAP "expo.out" */
export const expoOut: Curve = (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
/** GSAP "back.out(2)" */
export const backOut2: Curve = (p) => 1 - (1 - p) ** 2 * (1 - 3 * p);
/** GSAP "power1.out", its default ease */
export const power1Out: Curve = (p) => 1 - (1 - p) ** 2;

/** Points packed toward the start, where these curves move fastest. */
function toLinear(curve: Curve, n = 48) {
  const stops: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) ** 1.6;
    stops.push(`${+curve(t).toFixed(4)} ${+(t * 100).toFixed(2)}%`);
  }
  return `linear(${stops.join(", ")})`;
}

const supportsLinear = () =>
  typeof CSS !== "undefined" && CSS.supports("animation-timing-function", "linear(0, 1)");

/** Easing strings for element.animate(). Call in the browser only. */
export function easings() {
  const ok = supportsLinear();
  return {
    expoOut: ok ? toLinear(expoOut) : "cubic-bezier(0.19, 1, 0.22, 1)",
    backOut2: ok ? toLinear(backOut2) : "cubic-bezier(0.34, 1.8, 0.64, 1)",
    power1Out: ok ? toLinear(power1Out, 24) : "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  };
}
