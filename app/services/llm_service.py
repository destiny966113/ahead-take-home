"""
LLM Service - Integration with OpenAI and Anthropic for structured data extraction
"""
import json
import re
from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field, ValidationError
from app.core.config import settings
from app.schemas.parse import PaperMetadata

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False


class TableMetadataSchema(BaseModel):
    """Pydantic schema for validating LLM-generated table metadata."""
    label: str = Field(..., description="Table label (e.g., 'Table 1')", min_length=1, max_length=100)
    caption: str = Field(..., description="Table caption", min_length=1, max_length=500)


class LLMService:
    """Service for LLM-based structured data extraction."""

    def __init__(self):
        self.provider = settings.LLM_PROVIDER
        self.model = settings.LLM_MODEL
        self.api_key = settings.LLM_API_KEY

        # Initialize clients
        self.openai_client = None
        self.anthropic_client = None

        if self.provider == "openai" and OPENAI_AVAILABLE and self.api_key:
            self.openai_client = openai.OpenAI(api_key=self.api_key)
        elif self.provider == "anthropic" and ANTHROPIC_AVAILABLE and self.api_key:
            self.anthropic_client = anthropic.Anthropic(api_key=self.api_key)

    def is_available(self) -> bool:
        """Check if LLM service is properly configured."""
        return (self.openai_client is not None) or (self.anthropic_client is not None)

    def extract_paper_metadata(
        self,
        text: str,
        filename_info: dict = None,
        pdf_metadata: dict = None
    ) -> Dict[str, Any]:
        """
        Extract paper metadata from text using LLM.
        Falls back to filename/PDF metadata if LLM is not available.
        """
        # If LLM not available, use fallback
        if not self.is_available():
            return self._extract_metadata_fallback(text, filename_info, pdf_metadata)

        # Prepare context from filename and PDF metadata
        context_parts = []
        if filename_info:
            if filename_info.get("omip_id"):
                context_parts.append(f"OMIP ID from filename: {filename_info['omip_id']}")
            if filename_info.get("year"):
                context_parts.append(f"Year from filename: {filename_info['year']}")
            if filename_info.get("first_author"):
                context_parts.append(f"First author from filename: {filename_info['first_author']}")
            if filename_info.get("title"):
                context_parts.append(f"Title from filename: {filename_info['title']}")

        context_str = "\n".join(context_parts) if context_parts else "No filename context available"

        # Truncate text to avoid token limits (keep first ~4000 chars)
        text_sample = text[:4000] if len(text) > 4000 else text

        prompt = f"""Extract metadata from this scientific paper (OMIP format - One Marker Immunophenotyping Panel).

Context from filename:
{context_str}

Paper text (first 4000 chars):
{text_sample}

Extract and return a JSON object with these fields:
- omip_id: String in format "OMIP-NNN" (e.g., "OMIP-001")
- title: Paper title (without OMIP ID prefix)
- authors: Array of author names (format: "LastName, F.")
- year: Publication year (integer)
- journal: Journal name (usually "Cytometry Part A")
- confidence_score: Your confidence in the extraction (0.0 to 1.0)

Return ONLY the JSON object, no additional text."""

        try:
            if self.provider == "openai":
                result = self._call_openai(prompt)
            elif self.provider == "anthropic":
                result = self._call_anthropic(prompt)
            else:
                result = None

            if result:
                metadata_dict = self._parse_json_response(result)
                if metadata_dict:
                    # Validate with Pydantic
                    try:
                        metadata_obj = PaperMetadata(**metadata_dict)
                        # Return as dict for compatibility
                        return metadata_obj.model_dump()
                    except ValidationError as ve:
                        print(f"LLM output validation failed: {ve}")
                        # Try to fix common issues
                        metadata_dict = self._fix_metadata_dict(metadata_dict)
                        try:
                            metadata_obj = PaperMetadata(**metadata_dict)
                            print(f"✓ Fixed validation errors, metadata accepted")
                            return metadata_obj.model_dump()
                        except ValidationError as ve2:
                            print(f"Unable to fix validation errors: {ve2}")

        except Exception as e:
            print(f"LLM extraction failed: {e}")

        # Fallback if LLM fails
        return self._extract_metadata_fallback(text, filename_info, pdf_metadata)

    def extract_table_metadata(
        self,
        table_data: dict,
        context_text: str = ""
    ) -> Dict[str, Any]:
        """
        Extract metadata for a table (label, caption) using LLM.
        """
        if not self.is_available():
            return {
                "label": f"Table {table_data.get('table_index', 1)}",
                "caption": f"Table from page {table_data.get('page', 1)}",
            }

        # Prepare table preview
        columns = table_data.get("columns", [])
        rows = table_data.get("rows", [])[:3]  # First 3 rows
        table_preview = f"Columns: {', '.join(columns[:5])}\n"
        for i, row in enumerate(rows, 1):
            table_preview += f"Row {i}: {', '.join(row[:5])}\n"

        # Truncate context
        context_sample = context_text[:1000] if context_text else "No context available"

        prompt = f"""Analyze this table from a scientific paper and provide metadata.

Context from paper:
{context_sample}

Table preview (from page {table_data.get('page', 1)}):
{table_preview}

Return a JSON object with:
- label: Table label (e.g., "Table 1", "Table S1", "Supplementary Table")
- caption: A brief caption describing the table content

Return ONLY the JSON object."""

        try:
            if self.provider == "openai":
                result = self._call_openai(prompt)
            elif self.provider == "anthropic":
                result = self._call_anthropic(prompt)
            else:
                result = None

            if result:
                metadata_dict = self._parse_json_response(result)
                if metadata_dict:
                    # Validate with Pydantic
                    try:
                        metadata_obj = TableMetadataSchema(**metadata_dict)
                        return metadata_obj.model_dump()
                    except ValidationError as ve:
                        print(f"Table metadata validation failed: {ve}")
                        # Use fallback if validation fails

        except Exception as e:
            print(f"Table metadata extraction failed: {e}")

        # Fallback
        return {
            "label": f"Table {table_data.get('table_index', 1)}",
            "caption": f"Table from page {table_data.get('page', 1)} with {table_data.get('row_count', 0)} rows",
        }

    def _call_openai(self, prompt: str) -> Optional[str]:
        """Call OpenAI API."""
        if not self.openai_client:
            return None

        model = self.model or "gpt-4o-mini"

        response = self.openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a scientific paper metadata extraction assistant. Always return valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=1000,
        )

        return response.choices[0].message.content

    def _call_anthropic(self, prompt: str) -> Optional[str]:
        """Call Anthropic API."""
        if not self.anthropic_client:
            return None

        model = self.model or "claude-3-5-sonnet-20241022"

        response = self.anthropic_client.messages.create(
            model=model,
            max_tokens=1000,
            temperature=0.1,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        return response.content[0].text

    def _parse_json_response(self, response: str) -> Optional[dict]:
        """Parse JSON from LLM response, handling markdown code blocks."""
        if not response:
            return None

        try:
            # Try direct parse first
            return json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group(1))
                except json.JSONDecodeError:
                    pass

            # Try to find JSON object in text
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group(0))
                except json.JSONDecodeError:
                    pass

        return None

    def _fix_metadata_dict(self, metadata: dict) -> dict:
        """Attempt to fix common validation errors in metadata dict."""
        fixed = metadata.copy()

        # Fix OMIP ID format (must be OMIP-XXX with 3 digits)
        if "omip_id" in fixed and fixed["omip_id"]:
            omip_id = str(fixed["omip_id"])
            # Extract number from various formats
            match = re.search(r'OMIP[‐-]?(\d+)', omip_id, re.IGNORECASE)
            if match:
                num = match.group(1).zfill(3)  # Pad to 3 digits
                fixed["omip_id"] = f"OMIP-{num}"
            else:
                # Invalid OMIP ID, set to None
                fixed["omip_id"] = None

        # Ensure authors is a list
        if "authors" not in fixed:
            fixed["authors"] = []
        elif not isinstance(fixed["authors"], list):
            fixed["authors"] = [str(fixed["authors"])]

        # Ensure year is int or None
        if "year" in fixed and fixed["year"]:
            try:
                fixed["year"] = int(fixed["year"])
            except (ValueError, TypeError):
                fixed["year"] = None

        # Ensure confidence_score is float between 0 and 1
        if "confidence_score" in fixed:
            try:
                score = float(fixed["confidence_score"])
                fixed["confidence_score"] = max(0.0, min(1.0, score))
            except (ValueError, TypeError):
                fixed["confidence_score"] = 0.7

        return fixed

    def _extract_metadata_fallback(
        self,
        text: str,
        filename_info: dict = None,
        pdf_metadata: dict = None
    ) -> Dict[str, Any]:
        """
        Fallback metadata extraction using regex and filename parsing.
        """
        metadata = {
            "omip_id": None,
            "title": None,
            "authors": [],
            "year": None,
            "journal": "Cytometry Part A",
            "confidence_score": 0.5,  # Lower confidence for fallback
        }

        # Use filename info first
        if filename_info:
            metadata["omip_id"] = filename_info.get("omip_id")
            metadata["year"] = filename_info.get("year")
            metadata["title"] = filename_info.get("title")
            if filename_info.get("first_author"):
                metadata["authors"] = [filename_info["first_author"]]

        # Try to extract from text if not found in filename
        if not metadata["omip_id"]:
            omip_match = re.search(r'OMIP[‐-](\d+)', text[:1000], re.IGNORECASE)
            if omip_match:
                omip_num = omip_match.group(1).zfill(3)
                metadata["omip_id"] = f"OMIP-{omip_num}"

        if not metadata["year"]:
            year_match = re.search(r'\b(19|20)\d{2}\b', text[:1000])
            if year_match:
                metadata["year"] = int(year_match.group(0))

        # Use PDF metadata if available
        if pdf_metadata:
            if not metadata["title"] and pdf_metadata.get("title"):
                metadata["title"] = pdf_metadata["title"]
            if not metadata["authors"] and pdf_metadata.get("author"):
                metadata["authors"] = [pdf_metadata["author"]]

        # Ensure we have some title
        if not metadata["title"]:
            metadata["title"] = f"Paper {metadata.get('omip_id', 'Unknown')}"

        return metadata
