/* Canonical game content — imported by BOTH the frontend (src/content.js)
 * and the backend seed store (api/_lib/seeds.js). Single source of truth. */

export const PROMPTS = [
  {
    id: "letgo",
    label: "the one you let go",
    messages: [
      "I still take the long way past your old street.",
      "We were nineteen. I thought there'd be more time.",
      "You said 'we should catch up.' I never replied. I was scared.",
      "I married someone kind. I still wonder.",
      "I deleted your number so I'd stop almost calling.",
      "Not love, exactly. Just — what if.",
      "I'd know your laugh in any crowd, anywhere.",
      "I kept the ticket stub. I don't know why.",
      "Last seen: a Tuesday. I didn't know it was the last one.",
      "I hope your dog is okay. I hope you are too.",
    ],
  },
  {
    id: "neversaid",
    label: "what you've never said out loud",
    messages: [
      "I'm not okay, and I've gotten very good at it.",
      "Sometimes I'm relieved when plans fall through.",
      "I love them, but I miss being alone.",
      "I'm proud of myself. I've never told anyone that.",
      "I pretend to be busier than I am so no one worries.",
      "I'd leave it all tomorrow if I were braver.",
      "I talk to my mom in the car. She's been gone four years.",
      "I think I peaked at twenty-three. I'm making peace with it.",
      "I'm doing better than I let people believe.",
      "I don't think I chose this life. It happened to me.",
    ],
  },
  {
    id: "threeam",
    label: "who you think about at 3am",
    messages: [
      "The friend I ghosted. You deserved a reason.",
      "My brother. Six years of silence over nothing.",
      "A stranger from a train in 2014. We talked for an hour.",
      "Everyone I lost touch with who'd still pick up.",
      "Whether anyone thinks about me at 3am.",
      "The apology I rehearse and never send.",
      "How fast my parents are getting older.",
      "The person I'll become if I keep saying yes to everything.",
      "Nothing, lately. That scares me more than something would.",
      "Whether I'm wasting the only life I get.",
    ],
  },
  {
    id: "almost",
    label: "the version of you that almost was",
    messages: [
      "He stayed in the band. I see him sometimes, lit up.",
      "She moved to Lisbon and never looked back.",
      "The one who said yes to the job in the city.",
      "I'd have a studio full of canvases by now.",
      "The me that didn't apologize for taking up space.",
      "She kept writing. People read her now.",
      "The one who left at twenty-two instead of staying 'one more year.'",
      "He never got cautious. Probably broke and happy.",
      "I think he'd be proud of where I landed, actually.",
      "Honestly? This version turned out okay.",
    ],
  },
];

export const PALETTE = {
  bg: "#0d0b1f", bg2: "#05040d",
  you: "#f4b860", them: "#9fc6ff", thread: "#dff1ff",
};

/* Each prompt colors the whole night — the four palettes from the original
 * design handoff, matched to each prompt's mood. The intro always uses the
 * default Cosmic Indigo; the field shifts when you tune in. */
export const PROMPT_PALETTES = {
  // longing, warm — Ember Dusk
  letgo:     { bg: "#1c0f12", bg2: "#0a0506", you: "#ffb27a", them: "#ff8fae", thread: "#ffe6d5" },
  // secrets in deep space — Cosmic Indigo (the default)
  neversaid: { bg: "#0d0b1f", bg2: "#05040d", you: "#f4b860", them: "#9fc6ff", thread: "#dff1ff" },
  // sleepless monochrome — Noir Signal
  threeam:   { bg: "#0c0c0e", bg2: "#050506", you: "#f5f5f0", them: "#8a8a99", thread: "#ffffff" },
  // the other life, sea-changed — Deep Teal
  almost:    { bg: "#04161a", bg2: "#010a0c", you: "#ffd27a", them: "#6fe3d0", thread: "#d6fff6" },
};

export function paletteFor(promptId) {
  return PROMPT_PALETTES[promptId] || PALETTE;
}
