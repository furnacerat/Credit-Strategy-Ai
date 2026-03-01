# DB schema notes (draft)

We will add migrations under `supabase/migrations/`.

Tables (planned):

- `reports` (id, user_id, storage_path, size_bytes, status, progress, created_at, updated_at)
- `report_pages` (report_id, page_number, text, ocr_used, created_at)
- `report_analysis` (report_id, jsonb result, created_at)
- `dispute_letters` (report_id, bureau, storage_path, created_at)
