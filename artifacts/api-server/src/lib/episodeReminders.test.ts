import { describe, it, expect } from "vitest";
import { selectReminderTokens, formatLead, type TokenRow } from "./episodeReminders";
import { isValidReminderLead } from "./reminderValidation";

const rows: TokenRow[] = [
  { token: "t-player-in-game", userId: 1, role: "player" },
  { token: "t-player-other-game", userId: 2, role: "player" },
  { token: "t-admin-in-game", userId: 3, role: "admin" },
  { token: "t-player-complete", userId: 4, role: "player" },
  { token: "t-player-complete-2nd-device", userId: 4, role: "player" },
];

// Users 1, 3, 4 participate in the game; user 2 plays a different game.
const participantUserIds = new Set([1, 3, 4]);
// User 4 answered every question of the week.
const completedUserIds = new Set([4]);

describe("selectReminderTokens", () => {
  it("only targets non-admin participants of the game", () => {
    const tokens = selectReminderTokens({
      tokenRows: rows,
      participantUserIds,
      completedUserIds,
      onlyMissing: false,
    });
    expect(tokens).toContain("t-player-in-game");
    expect(tokens).toContain("t-player-complete");
    expect(tokens).not.toContain("t-player-other-game"); // nonparticipant excluded
    expect(tokens).not.toContain("t-admin-in-game"); // admins excluded
  });

  it("excludes players who answered everything when onlyMissing is set", () => {
    const tokens = selectReminderTokens({
      tokenRows: rows,
      participantUserIds,
      completedUserIds,
      onlyMissing: true,
    });
    expect(tokens).toEqual(["t-player-in-game"]);
  });

  it("with no questions (nobody complete), all participating players still get it", () => {
    const tokens = selectReminderTokens({
      tokenRows: rows,
      participantUserIds,
      completedUserIds: new Set(),
      onlyMissing: true,
    });
    expect(tokens.sort()).toEqual(
      ["t-player-complete", "t-player-complete-2nd-device", "t-player-in-game"].sort(),
    );
  });

  it("returns nothing when the game has no participants", () => {
    const tokens = selectReminderTokens({
      tokenRows: rows,
      participantUserIds: new Set(),
      completedUserIds: new Set(),
      onlyMissing: false,
    });
    expect(tokens).toEqual([]);
  });
});

describe("isValidReminderLead", () => {
  it("accepts sane values and rejects out-of-range or non-integer input", () => {
    expect(isValidReminderLead(1)).toBe(true);
    expect(isValidReminderLead(60)).toBe(true);
    expect(isValidReminderLead(1440)).toBe(true);
    expect(isValidReminderLead(0)).toBe(false);
    expect(isValidReminderLead(-5)).toBe(false);
    expect(isValidReminderLead(1441)).toBe(false);
    expect(isValidReminderLead(2.5)).toBe(false);
    expect(isValidReminderLead(NaN)).toBe(false);
  });
});

describe("formatLead", () => {
  it("formats hours and minutes", () => {
    expect(formatLead(60)).toBe("1 hour");
    expect(formatLead(120)).toBe("2 hours");
    expect(formatLead(45)).toBe("45 minutes");
  });
});
