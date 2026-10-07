import { visibilityAriaLabel, visibilityShortLabel, visibilityState } from "./visibility";

// Farbe allein reicht als Informationsträger nicht: jedes Badge trägt
// zusätzlich ein Symbol und einen Klartext.

const SYMBOLS = {
  day: "☀",
  night: "☾",
  unknown: "?",
};

export function buildIssIconHtml(visibility) {
  const state = visibilityState(visibility);

  return [
    '<span class="iss-icon__ring"></span>',
    '<span class="iss-icon__dot"></span>',
    `<span class="iss-icon__badge iss-icon__badge--${state}" aria-label="${visibilityAriaLabel(
      visibility,
    )}">` +
      `<span class="iss-icon__badge-symbol" aria-hidden="true">${SYMBOLS[state]}</span>` +
      `${visibilityShortLabel(visibility)}</span>`,
  ].join("");
}
