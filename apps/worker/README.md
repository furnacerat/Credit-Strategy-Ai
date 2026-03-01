# Worker (Python)

This folder will contain the Render worker that:

- Downloads uploaded PDFs from Supabase Storage
- Extracts text digitally (fast path)
- Falls back to OCR when needed
- Writes structured parse output + analysis to Postgres
- Generates dispute letters and stores them in Supabase Storage

## Running locally

1) Create a virtualenv and install

`python3 -m venv .venv && source .venv/bin/activate && pip install -e .`

2) Configure env

Copy `apps/worker/.env.example` to `apps/worker/.env` and fill values.

3) Run

`credit-worker`

## Render

Recommended: deploy using `apps/worker/Dockerfile` so Tesseract is available for OCR.
