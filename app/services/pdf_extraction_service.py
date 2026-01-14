"""
PDF Extraction Service - Extract text, tables, and images from PDF files
"""
import io
import re
from typing import Optional
from pathlib import Path

try:
    import pdfplumber
    import PyPDF2
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False


class PDFExtractionService:
    """Service for extracting content from PDF files."""

    def __init__(self):
        if not PDF_AVAILABLE:
            raise ImportError("PDF libraries not available. Install PyPDF2 and pdfplumber.")

    def extract_text_from_bytes(self, pdf_bytes: bytes) -> str:
        """Extract all text from PDF bytes."""
        try:
            pdf_file = io.BytesIO(pdf_bytes)
            with pdfplumber.open(pdf_file) as pdf:
                text_parts = []
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
                return "\n\n".join(text_parts)
        except Exception as e:
            # Fallback to PyPDF2 if pdfplumber fails
            try:
                pdf_file = io.BytesIO(pdf_bytes)
                reader = PyPDF2.PdfReader(pdf_file)
                text_parts = []
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        text_parts.append(text)
                return "\n\n".join(text_parts)
            except Exception as fallback_error:
                raise Exception(f"Failed to extract text: {e}, fallback also failed: {fallback_error}")

    def extract_text_from_file(self, file_path: str) -> str:
        """Extract all text from PDF file path."""
        with open(file_path, "rb") as f:
            pdf_bytes = f.read()
        return self.extract_text_from_bytes(pdf_bytes)

    def extract_tables_from_bytes(self, pdf_bytes: bytes) -> list[dict]:
        """Extract tables from PDF bytes using pdfplumber."""
        try:
            pdf_file = io.BytesIO(pdf_bytes)
            tables = []

            with pdfplumber.open(pdf_file) as pdf:
                for page_num, page in enumerate(pdf.pages, start=1):
                    page_tables = page.extract_tables()
                    for table_num, table in enumerate(page_tables, start=1):
                        if table and len(table) > 0:
                            # Convert table to structured format
                            headers = table[0] if len(table) > 0 else []
                            rows = table[1:] if len(table) > 1 else []

                            # Clean up None values
                            headers = [str(h) if h is not None else "" for h in headers]
                            cleaned_rows = []
                            for row in rows:
                                cleaned_row = [str(cell) if cell is not None else "" for cell in row]
                                cleaned_rows.append(cleaned_row)

                            tables.append({
                                "page": page_num,
                                "table_index": table_num,
                                "columns": headers,
                                "rows": cleaned_rows,
                                "row_count": len(cleaned_rows),
                                "col_count": len(headers),
                            })

            return tables
        except Exception as e:
            print(f"Warning: Failed to extract tables: {e}")
            return []

    def get_pdf_metadata(self, pdf_bytes: bytes) -> dict:
        """Extract PDF metadata like title, author, etc."""
        try:
            pdf_file = io.BytesIO(pdf_bytes)
            reader = PyPDF2.PdfReader(pdf_file)

            metadata = {}
            if reader.metadata:
                metadata = {
                    "title": reader.metadata.get("/Title", ""),
                    "author": reader.metadata.get("/Author", ""),
                    "subject": reader.metadata.get("/Subject", ""),
                    "creator": reader.metadata.get("/Creator", ""),
                    "producer": reader.metadata.get("/Producer", ""),
                    "creation_date": str(reader.metadata.get("/CreationDate", "")),
                }

            metadata["page_count"] = len(reader.pages)

            return metadata
        except Exception as e:
            print(f"Warning: Failed to extract metadata: {e}")
            return {"page_count": 0}

    def extract_paper_info_from_filename(self, filename: str) -> dict:
        """
        Extract structured information from OMIP paper filename.
        Expected format: "Cytometry Pt A - YEAR - AUTHOR - OMIP‐NNN  Title.pdf"
        """
        info = {
            "omip_id": None,
            "year": None,
            "first_author": None,
            "title": None,
        }

        # Extract OMIP ID (e.g., OMIP-001, OMIP‐001)
        omip_match = re.search(r'OMIP[‐-](\d+)', filename, re.IGNORECASE)
        if omip_match:
            omip_num = omip_match.group(1).zfill(3)  # Pad to 3 digits
            info["omip_id"] = f"OMIP-{omip_num}"

        # Extract year
        year_match = re.search(r'- (\d{4}) -', filename)
        if year_match:
            info["year"] = int(year_match.group(1))

        # Extract first author
        # Pattern: "Pt A - YEAR - AUTHOR -"
        author_match = re.search(r'- \d{4} - ([^-]+) -', filename)
        if author_match:
            info["first_author"] = author_match.group(1).strip()

        # Extract title (text after OMIP ID)
        title_match = re.search(r'OMIP[‐-]\d+[:\s]+(.+)\.pdf$', filename, re.IGNORECASE)
        if title_match:
            title = title_match.group(1).strip()
            # Clean up special characters
            title = title.replace('  ', ' ')
            info["title"] = title

        return info

    def extract_full_content(self, pdf_bytes: bytes, filename: str = "") -> dict:
        """
        Extract all content from PDF: text, tables, metadata, and filename info.
        """
        return {
            "text": self.extract_text_from_bytes(pdf_bytes),
            "tables": self.extract_tables_from_bytes(pdf_bytes),
            "pdf_metadata": self.get_pdf_metadata(pdf_bytes),
            "filename_info": self.extract_paper_info_from_filename(filename) if filename else {},
        }
