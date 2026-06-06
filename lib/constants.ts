export const VAS = ["Claire", "Rosalie", "Aliah", "Arvi", "Peevee"] as const;
export const STATUSES = ["New Client", "Performing", "Slow Generating", "At Risk", "Stopped"] as const;

export const DARK = {
  bg:      "#060810",
  bg2:     "#090d1c",
  bg3:     "#0f1628",
  border:  "#111d36",
  border2: "#1c2f50",
  text:    "#e2eaf8",
  muted:   "#4a6080",
  hint:    "#192640",
  green:   "#0fcf8a",
  gbg:     "#001914",
  amber:   "#ffab1a",
  abg:     "#1a0d00",
  red:     "#ff4d6a",
  rbg:     "#1a0010",
  blue:    "#4ba3ff",
  bbg:     "#010d25",
  purple:  "#9b7ff5",
  pbg:     "#0c0825",
  ai:      "#7c3aed",
  aibg:    "#0d0928",
} as const;

export const LIGHT = {
  bg:      "#f5f7fb",
  bg2:     "#edf1f8",
  bg3:     "#e4eaf5",
  border:  "#c8d4e8",
  border2: "#b0c0d8",
  text:    "#1a2440",
  muted:   "#5a6e90",
  hint:    "#9daec8",
  green:   "#0aaa6a",
  gbg:     "#e6faf2",
  amber:   "#c48600",
  abg:     "#fff8e0",
  red:     "#d6304a",
  rbg:     "#fff0f3",
  blue:    "#1a72d4",
  bbg:     "#e8f0ff",
  purple:  "#7c4fe8",
  pbg:     "#f0eaff",
  ai:      "#6428d0",
  aibg:    "#ede8ff",
} as const;

export type Palette = { [K in keyof typeof DARK]: string };

export const D = DARK;