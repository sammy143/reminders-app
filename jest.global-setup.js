// Runs once before any test worker starts, so every Date in the tests sees this zone.
// Los Angeles has DST (it ends on 2026-11-01), which catches UTC-only assumptions; see F005 plan.
module.exports = () => {
  process.env.TZ = 'America/Los_Angeles';
};
