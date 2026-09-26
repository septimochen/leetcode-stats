-- Totals are nullable because older snapshots did not collect them.
ALTER TABLE stats ADD COLUMN total_problems INTEGER;
ALTER TABLE stats ADD COLUMN easy_problems INTEGER;
ALTER TABLE stats ADD COLUMN medium_problems INTEGER;
ALTER TABLE stats ADD COLUMN hard_problems INTEGER;
