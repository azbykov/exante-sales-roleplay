/** A stable client character, reused across scenarios. */
export type Persona = {
  id: string;
  version: string;
  name: string;
  headline: string;
  /** What the client may reveal in the course of a normal conversation. */
  context: string[];
  /** Briefing for the RM before the call: who they are talking to. Never reveals the hidden need. */
  brief: string;
  /** A hint about the task of this conversation, not about the right words. */
  hint: string;
  /** Three or four short character traits for the selection card. */
  traits: string[];
  /** What he actually wants — unspoken until the RM explores the situation. */
  hiddenNeed: string;
  /** Pace, tone and stable behavioural traits. */
  manner: string[];
  /** The client's starting position on the 1-5 scales. */
  initialState: { trust: number; interest: number; patience: number };
};

/** A specific exercise that references a persona by id. */
export type ScenarioArtifact = {
  id: string;
  version: string;
  personaId: string;
  difficulty: 1 | 2 | 3;
  product: string;
  /** Objections target specific dimensions of the rubric. */
  objections: { trigger: string; line: string }[];
  /** Resolution conditions are checked by Character on every turn. */
  resolution: {
    deal: string;
    noDeal: string;
    walkout: string;
  };
  openingLine: string;
  maxTurns: number;
};

/** The trusted composition the runtime hands to Character and Analyzer. */
export type Scenario = ScenarioArtifact & { persona: Persona };

/**
 * A persona shown in the catalogue that has no scenario written for it yet.
 *
 * Display fields only, and deliberately not a Persona: there is no hidden need,
 * no manner and no initial state to write until the exercise around it exists.
 */
export type UpcomingPersona = {
  id: string;
  name: string;
  headline: string;
  /** What this exercise will be about — read before the scenario exists. */
  brief: string;
  traits: string[];
  difficulty: 1 | 2 | 3;
};
