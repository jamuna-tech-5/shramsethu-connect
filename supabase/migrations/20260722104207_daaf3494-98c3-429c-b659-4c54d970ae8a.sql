
-- Extend document types with additional kinds
ALTER TYPE doc_kind ADD VALUE IF NOT EXISTS 'passport';
ALTER TYPE doc_kind ADD VALUE IF NOT EXISTS 'voter_id';
ALTER TYPE doc_kind ADD VALUE IF NOT EXISTS 'salary_slip';
ALTER TYPE doc_kind ADD VALUE IF NOT EXISTS 'bank_statement';
ALTER TYPE doc_kind ADD VALUE IF NOT EXISTS 'income_proof';
ALTER TYPE doc_kind ADD VALUE IF NOT EXISTS 'payment_receipt';
ALTER TYPE doc_kind ADD VALUE IF NOT EXISTS 'employment_letter';

-- Additional status for AI needing manual review
ALTER TYPE doc_status ADD VALUE IF NOT EXISTS 'needs_review';

-- Remove unique constraint so users can upload multiple documents of the same kind
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_user_id_kind_storage_path_key;

-- Add columns to store OCR + AI verification metadata
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS document_name text,
  ADD COLUMN IF NOT EXISTS ocr_status text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS ocr_text text,
  ADD COLUMN IF NOT EXISTS confidence_score integer,
  ADD COLUMN IF NOT EXISTS verification_reason text,
  ADD COLUMN IF NOT EXISTS ai_verified_at timestamptz;
