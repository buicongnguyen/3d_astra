// The `rewards` connector (HERO-COINS-PLAN.md H2/H4; owner 2026-11-27): the one door a rewarded ad will use
// later, when the game ships as an Android/iOS app with AdMob (H4). Today it is inert: no SDK is loaded,
// nothing is offered and nothing is granted, so no screen shows an ad offer. Rules for later (plan H4):
// rewarded only and always optional, never needed to win, at most one offer per debrief; offers are
// "double the coins after a match", "a free Skywing for one mission" or a cosmetic colour.
export const REWARD_KINDS = Object.freeze(["doubleCoins", "freeSkywing", "cosmetic"]);

export const rewards = Object.freeze({
  // Whether an ad provider is plugged in (never, for now).
  available: false,
  // The offers a screen may show (none while unavailable).
  offers: () => [],
  // Asks the provider to play one rewarded offer; resolves { granted: false } while unavailable.
  offer: async (kind) => ({ granted: false, kind: REWARD_KINDS.includes(kind) ? kind : null, reason: "unavailable" }),
});
