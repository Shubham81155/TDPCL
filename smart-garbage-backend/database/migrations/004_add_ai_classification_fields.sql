-- Add AI classification metadata columns for garbage image model output
ALTER TABLE complaints
ADD COLUMN IF NOT EXISTS classified_label VARCHAR(100),
ADD COLUMN IF NOT EXISTS classification_confidence DECIMAL(5,4);

CREATE INDEX IF NOT EXISTS idx_complaints_classified_label ON complaints(classified_label);
