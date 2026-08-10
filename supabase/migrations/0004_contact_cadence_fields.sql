-- ─────────────────────────────────────────────────────────────
-- Give contacts their real Rechat cadence + birthday, so Band 2 stops
-- guessing.
--
-- touch_freq: Diana's own touch cadence in days. It comes either straight
--   off the Rechat contact, or from the Rechat Contact List the contact
--   belongs to (her "Warm" list = 60d, "Hot" = 30d, …). When set, it
--   overrides the built-in type/heat cadence defaults.
-- birthday: drives the "wish them a happy birthday" outreach trigger.
-- ─────────────────────────────────────────────────────────────

alter table contacts add column if not exists touch_freq int;
alter table contacts add column if not exists birthday date;
