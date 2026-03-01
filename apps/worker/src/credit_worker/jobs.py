"""Job definitions.

We will process PDFs page-by-page and persist intermediate progress so large files
don't require holding everything in memory.

Implementation will be wired to a Postgres-backed queue (e.g. Procrastinate).
"""


def parse_report(report_id: str) -> None:
  """Parse a single uploaded report and persist results."""
  raise NotImplementedError
