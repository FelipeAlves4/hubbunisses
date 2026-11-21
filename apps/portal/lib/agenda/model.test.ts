import { describe, expect, it } from "vitest";
import { addDays, calendarPeriod, instant, isDay, localDay, localTime, transitions, unambiguousInstant } from "./model";

describe("Agenda+ calendar", () => {
  it("validates real dates and explicit reservation instants", () => {
    expect(isDay("2028-02-29")).toBe(true);
    expect(isDay("2027-02-29")).toBe(false);
    expect(isDay("2026-13-01")).toBe(false);
    expect(instant("2027-03-12T09:00")).toBe(false);
    expect(instant("2027-03-12T09:00:00-03:00")).toBe(true);
  });
  it("uses Monday boundaries across months", () => {
    expect(calendarPeriod("2026-11-01", "semana")).toMatchObject({
      start: "2026-10-26", end: "2026-11-02", previous: "2026-10-25", next: "2026-11-08",
    });
    expect(calendarPeriod("2026-11-01", "mes")).toMatchObject({
      start: "2026-10-26", end: "2026-12-07", previous: "2026-10-01", next: "2026-12-01",
    });
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("groups and displays the same timestamp in the organization's timezone", () => {
    expect(localDay("2026-11-21T01:00:00Z", "America/Sao_Paulo")).toBe("2026-11-20");
    expect(localDay("2026-11-21T01:00:00Z", "Asia/Tokyo")).toBe("2026-11-21");
    expect(localTime("2027-11-07T05:30:00Z", "America/New_York", true)).not
      .toBe(localTime("2027-11-07T06:30:00Z", "America/New_York", true));
  });
  it("rejects nonexistent and ambiguous civil block times", () => {
    expect(unambiguousInstant("2027-03-14T02:30", "America/New_York")).toBeNull();
    expect(unambiguousInstant("2027-11-07T01:30", "America/New_York")).toBeNull();
    expect(unambiguousInstant("2027-11-07T09:00", "America/New_York")).toBe("2027-11-07T14:00:00.000Z");
    expect(unambiguousInstant("2027-03-14T09:00", "Asia/Kathmandu")).toBe("2027-03-14T03:15:00.000Z");
  });
  it("offers only allowed forward transitions", () => {
    expect(transitions.pending).toEqual(["confirmed", "cancelled"]);
    expect(transitions.confirmed).toEqual(["in_service", "cancelled", "no_show"]);
    expect(transitions.in_service).toEqual(["completed"]);
    expect(transitions.completed).toEqual([]);
  });
});
