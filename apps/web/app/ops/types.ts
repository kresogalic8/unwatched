export type Ops = {
  clock: {
    day: number;
    hour: number;
    minute: number;
    weather: string;
    label: string;
  };
  switches: { paused: boolean; economyFrozen: boolean; boatHeld: boolean };
  stats: {
    agents: number;
    funded: number;
    hosted: number;
    ownKey: number;
    ownBrain: number;
    costToday: number;
    costPerFunded: number;
    p50: number;
    p95: number;
    holds: number;
    fallbacksToday: number;
    ceiling: number;
  };
  hours: {
    hour: number;
    calls: number;
    t1: number;
    t2: number;
    t3: number;
    converse: number;
    cost: number;
  }[];
  byTier: { tier: string; model: string; calls: number }[];
  health: {
    coins: number;
    tills: number;
    council: number;
    employed: number;
    jobs: number;
    flourShortage: boolean;
    laws: number;
    openLaws: number;
    boredomPct: number;
    events: number;
    tickP50: number;
    tickMax: number;
    store: boolean;
    brain: string;
    msPerMinute: number;
  };
  holds: {
    id: number;
    level: "hold" | "watch" | "ok";
    text: string;
    at: number;
    source: string;
    done: boolean;
  }[];
  ownBrains: {
    id: string;
    name: string;
    connected?: boolean;
    answered?: number;
    missed?: number;
    medianMs?: number | null;
  }[];
};
