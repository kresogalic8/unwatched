/** The approved Harbor person, in local coordinates. Shared by the study and articulated citizen. */
export const HARBOR_PERSON = {
  torso: "M-7 -32Q0 -38 7 -32L9 -14Q0 -10 -9 -14Z",
  hair: "M-6 3Q-11 -12 2 -10Q9 -8 7 -1L3 -5L-3 -4L-3 3Z",
  headY: -43,
  headXRadius: 6.6,
  headYRadius: 8,
  hipY: -14,
  shoulderY: -32,
  coat: 0x657e76,
  trousers: 0x516064,
  hairColor: 0x5c5143,
} as const;

/** Natural illustrated proportions for the production rig; the study retains its original drawing. */
export const CITIZEN_BODY = {
  legHeight: 22,
  torsoHeight: 22,
  headY: -55,
  headScale: .9,
  torso: "M-7 -32Q0 -36 7 -32L7.5 -14Q0 -12 -7.5 -14Z",
} as const;
