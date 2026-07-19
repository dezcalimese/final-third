import type { TeamTheme } from "@final-third/shared";

export function TeamBadge({ team, size = "md" }: { team: TeamTheme; size?: "sm" | "md" | "lg" }) {
  const flagSize = size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-base";
  const textSize = size === "lg" ? "text-lg" : size === "md" ? "text-sm" : "text-xs";
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`fi fi-${team.iso} ${flagSize}`} aria-hidden />
      <span className={`font-semibold tracking-wide ${textSize}`}>{team.name}</span>
    </span>
  );
}
