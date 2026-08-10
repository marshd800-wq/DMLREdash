-- ─────────────────────────────────────────────────────────────
-- Diana's OS — seed data
-- The listing-side task template (PRD §5, Georgia defaults). Templates are
-- DATA, not code, so Diana can edit them without a developer. These seed the
-- deadline engine that ships in Phase 2; loading them now is harmless.
-- ─────────────────────────────────────────────────────────────

insert into task_templates (side, title, anchor, offset_days, sort_order) values
  ('listing', 'Confirm earnest money received + receipted', 'contract',   3,  10),
  ('listing', 'Order/confirm inspections access',           'contract',   1,  20),
  ('listing', 'Due-diligence check-in with seller',         'inspection', -2, 30),
  ('listing', 'Repair-amendment follow-up',                 'inspection', -1, 40),
  ('listing', 'Appraisal ordered / access confirmed',       'financing', -10, 50),
  ('listing', 'Appraisal result review',                    'appraisal',   0, 60),
  ('listing', 'Financing clear check w/ lender',            'financing',  -2, 70),
  ('listing', 'Utilities/HOA/closing docs prep',            'closing',    -7, 80),
  ('listing', 'Final walkthrough scheduled',                'closing',    -2, 90),
  ('listing', 'Closing day + keys',                         'closing',     0, 100),
  ('listing', 'Next-day review + referral ask',             'closing',     1, 110)
on conflict do nothing;

-- Buyer-side starter set (editable; expand to Georgia norms in Phase 2).
insert into task_templates (side, title, anchor, offset_days, sort_order) values
  ('buyer', 'Confirm earnest money delivered + receipted',  'contract',   3,  10),
  ('buyer', 'Schedule inspections',                          'contract',   1,  20),
  ('buyer', 'Due-diligence review with buyer',               'inspection', -2, 30),
  ('buyer', 'Submit repair amendment if needed',             'inspection', -1, 40),
  ('buyer', 'Confirm appraisal ordered by lender',           'financing', -10, 50),
  ('buyer', 'Appraisal result review',                       'appraisal',   0, 60),
  ('buyer', 'Financing / clear-to-close check w/ lender',    'financing',  -2, 70),
  ('buyer', 'Final walkthrough scheduled',                   'closing',    -2, 80),
  ('buyer', 'Closing day + keys',                            'closing',     0, 90),
  ('buyer', 'Next-day review + referral ask',                'closing',     1, 100)
on conflict do nothing;
