import type { TeamTheme } from "./types.js";

/**
 * team name (as it appears in TxLINE fixture metadata) -> theme.
 * Colors are each nation's flag colors, not federation branding — no crests, no FIFA marks.
 * Covers the four known replay fixtures plus common World Cup nations for general reskin.
 */
export const TEAM_THEMES: Record<string, TeamTheme> = {
  France: { iso: "fr", name: "France", primary: "#0055A4", secondary: "#EF4135" },
  Spain: { iso: "es", name: "Spain", primary: "#AA151B", secondary: "#F1BF00" },
  England: { iso: "gb-eng", name: "England", primary: "#CE1124", secondary: "#FFFFFF" },
  Argentina: { iso: "ar", name: "Argentina", primary: "#75AADB", secondary: "#FFFFFF" },
  Brazil: { iso: "br", name: "Brazil", primary: "#009C3B", secondary: "#FFDF00" },
  Germany: { iso: "de", name: "Germany", primary: "#000000", secondary: "#DD0000" },
  Portugal: { iso: "pt", name: "Portugal", primary: "#046A38", secondary: "#DA291C" },
  Netherlands: { iso: "nl", name: "Netherlands", primary: "#FF6900", secondary: "#21468B" },
  Italy: { iso: "it", name: "Italy", primary: "#008C45", secondary: "#CD212A" },
  Belgium: { iso: "be", name: "Belgium", primary: "#000000", secondary: "#FDDA24" },
  Croatia: { iso: "hr", name: "Croatia", primary: "#FF0000", secondary: "#171796" },
  Morocco: { iso: "ma", name: "Morocco", primary: "#C1272D", secondary: "#006233" },
  Uruguay: { iso: "uy", name: "Uruguay", primary: "#7BB2E0", secondary: "#FCD116" },
  USA: { iso: "us", name: "USA", primary: "#B22234", secondary: "#3C3B6E" },
  Mexico: { iso: "mx", name: "Mexico", primary: "#006847", secondary: "#CE1126" },
  Japan: { iso: "jp", name: "Japan", primary: "#BC002D", secondary: "#FFFFFF" },
  "South Korea": { iso: "kr", name: "South Korea", primary: "#CD2E3A", secondary: "#0047A0" },
  Switzerland: { iso: "ch", name: "Switzerland", primary: "#FF0000", secondary: "#FFFFFF" },
  Denmark: { iso: "dk", name: "Denmark", primary: "#C60C30", secondary: "#FFFFFF" },
  Senegal: { iso: "sn", name: "Senegal", primary: "#00853F", secondary: "#FDEF42" },
};

export const DEFAULT_THEME: TeamTheme = {
  iso: "un",
  name: "Team",
  primary: "#2563EB",
  secondary: "#F59E0B",
};

export function getTeamTheme(name: string | undefined | null): TeamTheme {
  if (!name) return DEFAULT_THEME;
  return TEAM_THEMES[name] ?? { ...DEFAULT_THEME, name };
}
