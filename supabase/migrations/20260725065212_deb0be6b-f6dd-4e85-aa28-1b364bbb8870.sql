
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS frequency text CHECK (frequency IN ('daily','weekly','monthly')),
  ADD COLUMN IF NOT EXISTS confidence_score integer;

CREATE INDEX IF NOT EXISTS transactions_document_idx ON public.transactions(document_id);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS income_source text,
  ADD COLUMN IF NOT EXISTS income_frequency text CHECK (income_frequency IN ('daily','weekly','monthly')),
  ADD COLUMN IF NOT EXISTS extracted_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS extracted_date date,
  ADD COLUMN IF NOT EXISTS extracted_employer text,
  ADD COLUMN IF NOT EXISTS extracted_txn_ref text,
  ADD COLUMN IF NOT EXISTS is_income_proof boolean NOT NULL DEFAULT false;
