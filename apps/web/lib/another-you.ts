export type SelfPortrait = {
  summary: string;
  want: string;
  fear: string;
  strangers: string;
  advice: string;
};

export type SelfDifference = {
  key: keyof SelfPortrait;
  label: string;
  before: string;
  now: string;
};

const FIELDS: { key: keyof SelfPortrait; label: string }[] = [
  { key: "want", label: "What they want" },
  { key: "fear", label: "What they fear" },
  { key: "strangers", label: "With strangers" },
  { key: "advice", label: "When advised" },
  { key: "summary", label: "How they describe themself" },
];

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

export function selfPortrait(value: Record<string, unknown>): SelfPortrait {
  return {
    summary: clean(value.summary),
    want: clean(value.want),
    fear: clean(value.fear),
    strangers: clean(value.strangers),
    advice: clean(value.advice),
  };
}

export function selfDifferences(origin: SelfPortrait, current: SelfPortrait): SelfDifference[] {
  return FIELDS.flatMap(({ key, label }) => {
    const before = clean(origin[key]);
    const now = clean(current[key]);
    return before && now && before !== now ? [{ key, label, before, now }] : [];
  });
}

export function divergenceCopy(count: number) {
  if (count === 0) return { label: "Close to the beginning", title: "Still recognisably you." };
  if (count === 1) return { label: "A first divergence", title: "One experience changed their direction." };
  if (count <= 3) return { label: "A life taking shape", title: "They are becoming someone new." };
  return { label: "A life of their own", title: "The island has changed them." };
}
