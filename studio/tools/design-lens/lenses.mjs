/*
 * design-lens DATA — the studio port of the-platformer's design.js, generalised
 * across ALL archetypes. The bridge between game-design THEORY and the level data:
 * the 8 MDA aesthetics (the "kinds of fun"), Jesse Schell's LENSES (the questions
 * we design through), and a per-archetype MECHANIC catalog tagged by how the
 * deterministic autopilot copes (spatial / timed / stateful / economic).
 *
 * Read by tools/design-lens/lens.mjs (the diagnostic) and quotable by docs.
 * Grounded in: Hunicke/LeBlanc/Zubek, "MDA: A Formal Approach to Game Design"
 * (2004); Jesse Schell, "The Art of Game Design: A Book of Lenses" (2nd ed.).
 */

// The 8 kinds of fun (MDA "Aesthetics") — the feelings a level should evoke.
export const FUN = {
  Sensation:  'Sense-pleasure — juicy hits, particles, screen-shake, sound.',
  Fantasy:    'Make-believe — you ARE the hero/convoy/fleet in this world.',
  Narrative:  'Unfolding drama — the campaign’s rising journey.',
  Challenge:  'Obstacle course — the right difficulty with real variety.',
  Fellowship: 'Social frame — the shared playlist / playtest notes.',
  Discovery:  'Uncharted territory — new biomes, units, mechanics.',
  Expression: 'Self-expression — your route / composition / style.',
  Submission: 'Pastime — the easy pick-up-and-play rhythm / flow.'
};

// Schell's lenses we actually design with (number + the question it asks).
export const LENSES = {
  essence:   { n: 1,  name: 'Essential Experience', q: 'What experience must this level deliver, and is it present in every beat?' },
  surprise:  { n: 2,  name: 'Surprise',             q: 'What will genuinely surprise the player here?' },
  fun:       { n: 3,  name: 'Fun',                  q: 'Which parts are fun, and how could each be MORE fun without clutter?' },
  curiosity: { n: 4,  name: 'Curiosity',            q: 'What question does this level plant that pulls the player forward?' },
  problem:   { n: 6,  name: 'Problem Solving',      q: 'What problem does it ask the player to solve? Is there more than one solution?' },
  tetrad:    { n: 7,  name: 'Elemental Tetrad',     q: 'Are Mechanics, Story, Aesthetics & Technology all pulling toward one theme?' },
  flow:      { n: 18, name: 'Flow',                 q: 'Clear goal? Direct feedback? A steady stream of not-too-easy, not-too-hard challenges?' },
  challenge: { n: 31, name: 'Challenge',            q: 'Right difficulty? Enough VARIETY of challenge? Does it ramp and peak before the end?' },
  choices:   { n: 32, name: 'Meaningful Choices',   q: 'Real choices (not an obvious-best or arbitrary)? Is the number right?' },
  triangle:  { n: 33, name: 'Triangularity',        q: 'A safe-low-reward vs risky-high-reward fork, rewards matched to the risk?' },
  reward:    { n: 40, name: 'Reward',               q: 'Are rewards exciting, understood, and building over time (not too predictable)?' },
  punish:    { n: 41, name: 'Punishment',           q: 'Is failure fair, legible, and a quick retry — never cheap?' },
  juice:     { n: 58, name: 'Juiciness',            q: 'Does every action get a satisfying response — bursting with feedback?' },
  interest:  { n: 61, name: 'Interest Curve',       q: 'Does interest hook early, rise with peaks/valleys, and climax just before the end?' },
  inherent:  { n: 62, name: 'Inherent Interest',    q: 'Which moments are inherently gripping (risk, spectacle, novelty) vs filler?' },
  beauty:    { n: 63, name: 'Beauty',               q: 'Is the art cohesive and characterful enough to be its own reward?' }
};

// ── per-archetype MECHANIC catalog. `ai` = how the deterministic autopilot copes:
//   spatial   = the probe already sees it (re-skinned geometry): no driver work.
//   timed     = a cyclic/scheduled element the autopilot reads on a clock.
//   stateful  = needs new world state + planning.
//   economic  = a resource/throughput lever (RTS): bounded so the autopilot still wins.
// `lever` names the design knob; `lens` is the lens it most serves.
export const MECHANICS = {
  runner: {
    gap:       { name: 'Lava gap',       ai: 'spatial', lever: 'risk',     lens: 'challenge', note: 'Jump it — the base verb.' },
    wall:      { name: 'Wall / ledge',   ai: 'spatial', lever: 'skill',    lens: 'challenge', note: 'Clear with a running launch.' },
    spring:    { name: 'Spring',         ai: 'timed',   lever: 'spectacle',lens: 'surprise',  note: 'Launches you to a high reward road.' },
    mover:     { name: 'Moving platform',ai: 'timed',   lever: 'rhythm',   lens: 'flow',      note: 'Match its phase, ride, hop off.' },
    coinFork:  { name: 'Coins over a pit',ai:'spatial',  lever: 'reward',   lens: 'triangle',  note: 'Safe-low vs risky-high fork — the #1 spice.' },
    enemy:     { name: 'Walker enemy',   ai: 'spatial', lever: 'threat',   lens: 'challenge', note: 'Patrols; stomp or avoid.' }
  },
  vertical: {
    updraft:   { name: 'Updraft column', ai: 'timed',   lever: 'spectacle',lens: 'flow',      note: 'Ride the lift to the next shelf.' },
    spring:    { name: 'Spring',         ai: 'timed',   lever: 'spectacle',lens: 'surprise',  note: 'Bounce to a high platform.' },
    gust:      { name: 'Wind gust',      ai: 'timed',   lever: 'rhythm',   lens: 'challenge', note: 'Periodic push that bends the climb.' },
    coinFork:  { name: 'Coins off-route',ai: 'spatial', lever: 'reward',   lens: 'triangle',  note: 'A risky detour for a reward.' }
  },
  shooter: {
    curtain:   { name: 'Bullet curtain', ai: 'timed',   lever: 'threat',   lens: 'flow',      note: 'The sweeping-gap wall — ride the safe column.' },
    formation: { name: 'Enemy formation',ai: 'timed',   lever: 'variety',  lens: 'challenge', note: 'A wave shape to clear — variety beat.' },
    boss:      { name: 'Boss mothership', ai: 'timed',  lever: 'climax',   lens: 'interest',  note: 'The end-of-campaign set-piece.' },
    powerup:   { name: 'Power-up',       ai: 'spatial', lever: 'reward',   lens: 'reward',    note: 'A reward pickup that builds power.' }
  },
  rts: {
    build:     { name: 'Build economy',  ai: 'economic',lever: 'engine',   lens: 'flow',      note: 'Scrap→cars throughput; the core loop.' },
    units:     { name: 'Unit roster',    ai: 'economic',lever: 'variety',  lens: 'choices',   note: 'scout (fast/cheap) · brawler (tank) · gunner (ranged) — a real choice.' },
    rally:     { name: 'Lane rally',     ai: 'economic',lever: 'choice',   lens: 'choices',   note: 'Which lane to commit — the macro decision.' },
    wave:      { name: 'Enemy wave',     ai: 'timed',   lever: 'threat',   lens: 'interest',  note: 'A scheduled push — the intensity spike.' },
    flank:     { name: 'Flank rush',     ai: 'timed',   lever: 'surprise', lens: 'surprise',  note: 'An off-rally lane poke — the react-NOW spike (turret-bounded so the AI still wins).' },
    boss:      { name: 'Warlord / elite',ai: 'timed',   lever: 'climax',   lens: 'interest',  note: 'A heavy named adversary as the climactic final assault.' },
    depot:     { name: 'Scrap depot',    ai: 'economic',lever: 'reward',   lens: 'triangle',  note: 'A capturable income node — risk units forward for +income (safe-low vs risky-high).' },
    turret:    { name: 'HQ turret',      ai: 'economic',lever: 'safety',   lens: 'punish',     note: 'The base gun — a fair last-ditch defence that defends all lanes.' }
  }
};

// ── the DIAGNOSIS map: MDA upward. A weak Feel COMPONENT is an *aesthetic* report;
// trace it to the LENS that asks the right question and the MECHANIC lever that
// fixes it (never patch the symptom). Used by lens.mjs to turn a low score into a
// concrete, archetype-specific prescription.
export const DIAGNOSIS = {
  engagement: {
    aesthetic: 'Challenge / Inherent Interest', lens: 'inherent',
    low: 'Too much filler — not enough inherently gripping beats (risk, spectacle, novelty).',
    fix: { runner: 'pack more verbs per screen (springs, movers, coin-forks).', vertical: 'more updrafts/springs and reward detours.', shooter: 'denser formations + tighter curtains.', rts: 'denser waves and a richer unit mix so the front is always hot.' }
  },
  dynamics: {
    aesthetic: 'Challenge (variety) / Surprise', lens: 'challenge',
    low: 'Too samey — the same beat repeats; not enough VARIETY or surprise.',
    fix: { runner: 'introduce a new element/adversary per level; alternate verbs.', vertical: 'vary mechanic per shelf; add a gust or mover.', shooter: 'rotate formation shapes; add a mid-wave twist.', rts: 'introduce a per-ground signature (a new unit, a flank rush, an elite) — the introduce→develop→twist→master grammar.' }
  },
  arc: {
    aesthetic: 'Narrative / Interest Curve', lens: 'interest',
    low: 'Flat or early-peaking — no hook→rising-peaks→climax shape.',
    fix: { runner: 'hook in the first seconds, rest valleys between peaks, hardest set-piece just before the flag.', vertical: 'ease the base, climax near the top.', shooter: 'lighter opening, boss/climax wave near the end.', rts: 'open with a probing skirmish, build waves with rests between them, end on a climactic fortress assault (a dense final push / a boss).' }
  },
  flow: {
    aesthetic: 'Submission / Flow', lens: 'flow',
    low: 'Dead air or uneven difficulty breaks the rhythm.',
    fix: { runner: 'remove long empty stretches; keep a steady ramp.', vertical: 'no long gaps between shelves.', shooter: 'no silent lulls between waves.', rts: 'no quiet gaps — keep the front engaged between scheduled pushes; smooth the difficulty ramp.' }
  }
};

// ── PRODUCTION POLISH — the fun the level-geometry Feel model is BLIND to.
// The Studio.Feel score measures the interest curve of the level layout only; a
// game's fun ALSO comes from juice, reward loops, spectacle, sensory variety and
// art (Schell #58 Juiciness · #40 Reward · #62 Inherent Interest · #31 Challenge-
// variety · #63 Beauty). These are REAL, well-established fun sources, so the
// headline FUN should credit them. Each dimension scores 0..1 from features the
// game actually ships; the weights sum to 1.
export const POLISH = {
  juice:     { w: 0.30, lens: 'juice',    q: 'Does every hit/death/win burst with feedback — explosions, shockwaves, muzzle flashes, floating text, shake?' },
  spectacle: { w: 0.22, lens: 'inherent', q: 'Is there a climactic set-piece (a boss / big moment) that is inherently gripping?' },
  reward:    { w: 0.20, lens: 'reward',   q: 'Is there a building reward/economy loop the player invests in?' },
  variety:   { w: 0.16, lens: 'challenge',q: 'Sensory + mechanical variety — a distinct score per level, multiple unit/enemy types?' },
  beauty:    { w: 0.12, lens: 'beauty',   q: 'Cohesive, characterful art (backdrops, hero/units, props, a wordmark)?' }
};
// the headline FUN blends level-design interest (geometry) with production polish.
export const FUN_BLEND = { design: 0.62, polish: 0.38 };

// the studio FUN bar (rules.json thresholds.funMin), surfaced for the tool.
export const FUN_MIN = 80;
