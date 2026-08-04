ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS income_month smallint,
  ADD COLUMN IF NOT EXISTS income_year smallint;