import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SCENARIO,
  DEFAULT_SCENARIO_ID,
  getScenario,
  listScenarios,
  publicScenario,
  requireScenario,
} from "../lib/content/registry";
import { UPCOMING } from "../lib/content/upcoming";

/**
 * Everything the salesperson must not be able to read: the answers to the
 * exercise. Checked against the serialised projection rather than named keys,
 * so a field nested one level deeper is still caught.
 */
const SECRET_KEYS = ["hiddenNeed", "manner", "resolution", "objections", "product", "maxTurns"];

describe("scenario composition", () => {
  test("the default scenario resolves its persona reference", () => {
    assert.equal(DEFAULT_SCENARIO.id, DEFAULT_SCENARIO_ID);
    assert.equal(DEFAULT_SCENARIO.persona.id, DEFAULT_SCENARIO.personaId);
    assert.ok(DEFAULT_SCENARIO.persona.hiddenNeed.length > 0);
    assert.ok(DEFAULT_SCENARIO.resolution.deal.length > 0);
  });

  test("an unregistered id is undefined, and requireScenario throws on it", () => {
    assert.equal(getScenario("no-such-scenario"), undefined);
    assert.throws(() => requireScenario("no-such-scenario"), /not registered/);
  });

  test("an announced persona has no scenario, so a session cannot open on it", () => {
    assert.ok(UPCOMING.length > 0, "the fixture assumes at least one announced persona");
    for (const persona of UPCOMING) {
      assert.equal(getScenario(persona.id), undefined, persona.id);
    }
  });
});

describe("the public catalogue", () => {
  const catalogue = listScenarios();

  test("lists every playable scenario and every announced one", () => {
    const ready = catalogue.filter((entry) => entry.status === "ready");
    const soon = catalogue.filter((entry) => entry.status === "coming_soon");
    assert.ok(ready.some((entry) => entry.id === DEFAULT_SCENARIO_ID));
    assert.equal(soon.length, UPCOMING.length);
  });

  // The trust boundary. If this fails, the exercise can be read out of the
  // browser's JavaScript before it is played.
  test("carries none of the answers to the exercise", () => {
    const serialised = JSON.stringify(catalogue);
    for (const key of SECRET_KEYS) {
      assert.equal(serialised.includes(key), false, `${key} reached the catalogue`);
    }
    assert.equal(
      serialised.includes(DEFAULT_SCENARIO.persona.hiddenNeed.slice(0, 40)),
      false,
      "the hidden need reached the catalogue verbatim",
    );
  });

  test("an announced card carries no scenario fields at all", () => {
    const soon = catalogue.find((entry) => entry.status === "coming_soon");
    assert.ok(soon);
    assert.deepEqual(Object.keys(soon).sort(), ["difficulty", "id", "persona", "status"]);
  });

  test("a playable card carries what the picker needs and nothing more", () => {
    const ready = catalogue.find((entry) => entry.id === DEFAULT_SCENARIO_ID);
    assert.ok(ready && ready.status === "ready");
    assert.deepEqual(Object.keys(ready).sort(), [
      "demoLines",
      "difficulty",
      "id",
      "openingLine",
      "persona",
      "status",
      "version",
    ]);
    assert.deepEqual(Object.keys(ready.persona).sort(), [
      "brief",
      "headline",
      "hint",
      "id",
      "initialState",
      "name",
      "traits",
      "version",
    ]);
  });

  test("publicScenario returns the same projection, and nothing for an unknown id", () => {
    assert.deepEqual(publicScenario(DEFAULT_SCENARIO_ID), catalogue[0]);
    assert.equal(publicScenario("no-such-scenario"), undefined);
  });

  test("the opening line is public: the client speaks first", () => {
    const ready = catalogue.find((entry) => entry.id === DEFAULT_SCENARIO_ID);
    assert.equal(ready?.status === "ready" && ready.openingLine, DEFAULT_SCENARIO.openingLine);
  });
});
