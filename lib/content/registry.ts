import "server-only";
import type { Persona, Scenario, ScenarioArtifact } from "../scenario";
import { DEMO, demoLines } from "../demo";
import { ANDREAS_KELLER } from "./personas/andreas-keller";
import { ACTIVE_TRADER_SWITCHING } from "./scenarios/active-trader-switching";
import { UPCOMING } from "./upcoming";

/** The single registration point for content. Keys match the artifact ids. */
const PERSONAS = {
  [ANDREAS_KELLER.id]: ANDREAS_KELLER,
} satisfies Record<string, Persona>;

const SCENARIOS = {
  [ACTIVE_TRADER_SWITCHING.id]: ACTIVE_TRADER_SWITCHING,
} satisfies Record<string, ScenarioArtifact>;

export const DEFAULT_SCENARIO_ID = ACTIVE_TRADER_SWITCHING.id;

export function getScenario(id: string): Scenario | undefined {
  const artifact = SCENARIOS[id];
  if (!artifact) return undefined;

  const persona = PERSONAS[artifact.personaId];
  if (!persona) {
    throw new Error(`Persona ${artifact.personaId} for scenario ${artifact.id} is not registered`);
  }

  return { ...artifact, persona };
}

export function requireScenario(id: string): Scenario {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`Scenario ${id} is not registered`);
  return scenario;
}

export const DEFAULT_SCENARIO = requireScenario(DEFAULT_SCENARIO_ID);

/**
 * A safe catalogue without hiddenNeed, manner or resolution conditions.
 *
 * This projection is the trust boundary: content is reached only through this
 * module, which is marked `server-only`, so a field added to Persona cannot
 * reach the browser unless it is listed here.
 */
export function listScenarios() {
  const ready = Object.values(SCENARIOS).map((artifact) => {
    const persona = PERSONAS[artifact.personaId];
    if (!persona) throw new Error(`Persona ${artifact.personaId} is not registered`);

    return {
      status: "ready" as const,
      id: artifact.id,
      version: artifact.version,
      difficulty: artifact.difficulty,
      persona: {
        id: persona.id,
        version: persona.version,
        name: persona.name,
        headline: persona.headline,
        brief: persona.brief,
        hint: persona.hint,
        traits: persona.traits,
        initialState: persona.initialState,
      },
      openingLine: artifact.openingLine,
      // Only in demo mode, and only the salesperson's own lines: the recorded
      // avatar turns and report stay on the server.
      demoLines: DEMO ? demoLines(artifact.id) : [],
    };
  });

  // Announced but not playable: no scenario exists, so these ids are unknown to
  // getScenario and the dialogue routes reject them without any help from the UI.
  const upcoming = UPCOMING.map((persona) => ({
    status: "coming_soon" as const,
    id: persona.id,
    difficulty: persona.difficulty,
    persona: {
      id: persona.id,
      name: persona.name,
      headline: persona.headline,
      brief: persona.brief,
      traits: persona.traits,
    },
  }));

  return [...ready, ...upcoming];
}
