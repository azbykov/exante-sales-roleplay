import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { averageScore, clock, formatDay, formatScore, plural, todayISO } from "../app/format";

describe("averageScore", () => {
  test("averages the observed scores", () => {
    assert.equal(averageScore([5, 4, 3]), 4);
  });

  // A skill that never came up is not a neutral three: it is left out entirely.
  test("skips unobserved dimensions rather than counting them as zero", () => {
    assert.equal(averageScore([5, null, 3]), 4);
    assert.equal(averageScore([4, null, null]), 4);
  });

  test("is null when nothing was observed at all", () => {
    assert.equal(averageScore([null, null, null]), null);
    assert.equal(averageScore([]), null);
  });
});

describe("formatScore", () => {
  test("always shows one decimal, so the headline does not jump width", () => {
    assert.equal(formatScore(5), "5.0");
    assert.equal(formatScore(3.666666), "3.7");
    assert.equal(formatScore(3.5), "3.5");
  });
});

describe("clock", () => {
  test("pads to mm:ss", () => {
    assert.equal(clock(0), "00:00");
    assert.equal(clock(9), "00:09");
    assert.equal(clock(61), "01:01");
    assert.equal(clock(600), "10:00");
  });

  test("keeps counting past an hour rather than wrapping", () => {
    assert.equal(clock(3_601), "60:01");
  });
});

describe("plural", () => {
  test("singular only at one", () => {
    assert.equal(plural(1, "line"), "line");
    assert.equal(plural(0, "line"), "lines");
    assert.equal(plural(2, "minute"), "minutes");
  });
});

/**
 * These run under a fixed western time zone (the `test` script pins TZ): the
 * UTC-midnight trap below only bites west of Greenwich, so on a machine set to
 * Moscow or Berlin the assertion would pass either way and prove nothing.
 */
describe("dates", () => {
  test("todayISO returns the local calendar day", () => {
    const at = new Date(2026, 8, 2, 23, 30);
    assert.equal(todayISO(at), "2026-09-02");
  });

  test("pads month and day", () => {
    assert.equal(todayISO(new Date(2026, 0, 5, 12)), "2026-01-05");
  });

  test("the current day reads as today", () => {
    const now = new Date(2026, 8, 2, 12);
    assert.equal(formatDay("2026-09-02", now), "today");
  });

  /**
   * The stored day is a bare YYYY-MM-DD. Parsed without a time it is read as UTC
   * midnight, which renders as the day before anywhere west of Greenwich — so a
   * session logged on the 2nd would show up as "Sep 1".
   */
  test("an earlier day renders on the day it was stored, whatever the time zone", () => {
    const now = new Date(2026, 8, 10, 12);
    assert.equal(formatDay("2026-09-02", now), "Sep 2");
    assert.equal(formatDay("2026-01-31", now), "Jan 31");
    assert.equal(formatDay("2026-12-01", now), "Dec 1");
  });
});
