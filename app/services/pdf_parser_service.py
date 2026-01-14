"""
PDF Parser Service - Orchestrates PDF extraction using PARSER API
"""
import time
from typing import List, Dict, Any
from uuid import UUID

from app.services.external_parser_service import ExternalParserService
from app.services.storage_service import StorageService
from app.schemas.parse import (
    ParsingResultPayload,
    PaperMetadata,
    ExtractedElement,
    ElementType,
    TableContent,
    TableCell,
    FigureContent,
    FigureImage,
)


class PDFParserService:
    """High-level service for parsing PDF files using PARSER API."""

    def __init__(self):
        self.external_parser_service = ExternalParserService()
        self.storage_service = StorageService()

    def parse_pdf_from_storage(
        self,
        object_key: str,
        filename: str = ""
    ) -> ParsingResultPayload:
        """
        Parse a PDF file from MinIO storage.

        Args:
            object_key: MinIO object key for the PDF
            filename: Original filename (for metadata extraction)

        Returns:
            ParsingResultPayload with extracted metadata and elements
        """
        start_time = time.time()

        # Download PDF from storage
        try:
            pdf_bytes = self.storage_service.get_object(object_key)
        except Exception as e:
            raise Exception(f"Failed to download PDF from storage: {e}")

        return self.parse_pdf_from_bytes(pdf_bytes, filename)

    def parse_pdf_from_bytes(
        self,
        pdf_bytes: bytes,
        filename: str = ""
    ) -> ParsingResultPayload:
        """
        Parse a PDF file from bytes using PARSER API.

        Args:
            pdf_bytes: PDF file content as bytes
            filename: Original filename (for metadata extraction)

        Returns:
            ParsingResultPayload with extracted metadata and elements
        """
        start_time = time.time()

        try:
            # Call PARSER API to parse PDF
            parser_result = self.external_parser_service.parse_pdf_omip(
                pdf_bytes=pdf_bytes,
                filename=filename
            )

            # Extract metadata from PARSER result
            metadata = PaperMetadata(
                omip_id=parser_result.get("omip_id"),
                title=parser_result.get("title"),
                authors=parser_result.get("authors", []),
                year=parser_result.get("year"),
                journal="Cytometry Part A",
                confidence_score=0.9,  # PARSER is generally high confidence
                parser_raw=parser_result,
            )

            # Convert tables and figures to ExtractedElement format
            elements = []
            order_index = 0

            # Process tables
            for table_data in parser_result.get("tables", []):
                # Convert PARSER table rows to TableCell format
                rows = []
                for row in table_data.get("rows", []):
                    cell_row = []
                    for cell in row:
                        cell_row.append(TableCell(
                            text=cell.get("text"),
                            colspan=cell.get("colspan"),
                            rowspan=cell.get("rowspan")
                        ))
                    rows.append(cell_row)

                element = ExtractedElement(
                    type=ElementType.table,
                    label=f"Table {table_data.get('number', order_index + 1)}",
                    caption=table_data.get("caption"),
                    order_index=order_index,
                    content=TableContent(
                        number=table_data.get("number"),
                        caption=table_data.get("caption"),
                        rows=rows,
                        confidence=table_data.get("confidence"),
                        is_manually_edited=False
                    )
                )
                elements.append(element)
                order_index += 1

            # Process figures
            for figure_data in parser_result.get("figures", []):
                image_data = figure_data.get("image", {})
                image = None
                if image_data:
                    image = FigureImage(
                        page=image_data.get("page"),
                        bbox=image_data.get("bbox"),
                        path=image_data.get("path")
                    )

                element = ExtractedElement(
                    type=ElementType.figure,
                    label=f"Figure {figure_data.get('number', order_index + 1)}",
                    caption=figure_data.get("caption"),
                    order_index=order_index,
                    content=FigureContent(
                        number=figure_data.get("number"),
                        caption=figure_data.get("caption"),
                        image=image,
                        confidence=figure_data.get("confidence")
                    )
                )
                elements.append(element)
                order_index += 1

            processing_time_ms = int((time.time() - start_time) * 1000)

            return ParsingResultPayload(
                raw_metadata=metadata,
                elements=elements,
                processing_time_ms=processing_time_ms
            )

        except Exception as e:
            # Do not fallback to mock; propagate error so run is marked failed
            raise

    def _create_mock_result(
        self,
        filename: str,
        processing_time_ms: int,
        error: str = None
    ) -> ParsingResultPayload:
        """Create a mock parsing result as fallback."""
        # Try to extract basic info from filename
        filename_info = {}
        try:
            # Simple regex extraction from filename
            import re
            omip_match = re.search(r'OMIP[‐-](\d+)', filename)
            year_match = re.search(r'(\d{4})', filename)
            if omip_match:
                filename_info["omip_id"] = f"OMIP-{omip_match.group(1).zfill(3)}"
            if year_match:
                filename_info["year"] = int(year_match.group(1))
        except:
            pass

        metadata = PaperMetadata(
            omip_id=filename_info.get("omip_id", "OMIP-001"),
            title=filename_info.get("title") or f"Parsed {filename}",
            authors=["Unknown Author"],
            year=filename_info.get("year", 2024),
            journal="Cytometry Part A",
            confidence_score=0.3  # Low confidence for mock data
        )

        caption = f"Mock table generated for {filename}"
        if error:
            caption += f" (Error: {error[:100]})"

        # Create mock table with PARSER-style cell structure
        rows = [
            [TableCell(text="Marker"), TableCell(text="Fluorochrome")],
            [TableCell(text="CD3"), TableCell(text="FITC")],
            [TableCell(text="CD4"), TableCell(text="PE")],
            [TableCell(text="CD8"), TableCell(text="APC")]
        ]

        elements = [
            ExtractedElement(
                type=ElementType.table,
                label="Table 1",
                caption=caption,
                order_index=0,
                content=TableContent(
                    number="1",
                    caption=caption,
                    rows=rows,
                    is_manually_edited=False
                )
            )
        ]

        return ParsingResultPayload(
            raw_metadata=metadata,
            elements=elements,
            processing_time_ms=processing_time_ms
        )
