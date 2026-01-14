"""
PARSER API Client Service - Interfaces with the external PARSER server for PDF parsing
"""
import requests
from typing import Dict, Any, Optional
from app.core.config import settings


class ExternalParserService:
    """Client for PARSER API to parse PDF files into structured JSON."""

    def __init__(self, base_url: str = None, timeout: float = 120.0):
        """
        Initialize PARSER service client.
        
        Args:
            base_url: PARSER API base URL (default from settings or http://10.13.13.8:8000)
            timeout: Request timeout in seconds
        """
        self.base_url = base_url or getattr(settings, 'parser_api_url', 'http://10.13.13.8:8000')
        self.timeout = timeout
        self.parse_url = f"{self.base_url}/parse"
        self.schemas_url = f"{self.base_url}/schemas"

    def get_available_schemas(self) -> Dict[str, Any]:
        """
        Get list of available schemas from PARSER API.
        
        Returns:
            Dictionary with available schemas
        """
        try:
            response = requests.get(self.schemas_url, timeout=10.0)
            if response.ok:
                return response.json()
        except Exception as e:
            print(f"Failed to get PARSER schemas: {e}")
        return {}

    def parse_pdf(
        self,
        pdf_bytes: bytes,
        filename: str = "document.pdf",
        schema: str = "omip",
        include_conf: bool = False,
        save_images: bool = True
    ) -> Dict[str, Any]:
        """
        Parse a PDF file using PARSER API.
        
        Args:
            pdf_bytes: PDF file content as bytes
            filename: Original filename
            schema: Output schema (omip, full, metadata, citations, tei)
            include_conf: Include confidence scores
            save_images: Save figure images to server
            
        Returns:
            Parsed document as dictionary
            
        Raises:
            Exception: If parsing fails
        """
        try:
            # Prepare multipart form data
            files = {
                'file': (filename, pdf_bytes, 'application/pdf')
            }
            data = {
                'schema': schema
            }
            params = {}
            if include_conf:
                params['include_conf'] = 'true'
            if save_images:
                params['save_images'] = 'true'

            # Make request to PARSER API
            response = requests.post(
                self.parse_url,
                files=files,
                data=data,
                params=params,
                timeout=self.timeout
            )

            # Check response
            if not response.ok:
                error_msg = response.text[:500] if response.text else f"HTTP {response.status_code}"
                raise Exception(f"PARSER API error: {error_msg}")

            # Parse JSON response
            content_type = response.headers.get('content-type', '')
            if 'application/json' in content_type:
                return response.json()
            else:
                raise Exception(f"Unexpected content type: {content_type}")

        except requests.exceptions.Timeout:
            raise Exception(f"PARSER API timeout after {self.timeout}s")
        except requests.exceptions.ConnectionError as e:
            raise Exception(f"Failed to connect to PARSER API at {self.base_url}: {e}")
        except Exception as e:
            raise Exception(f"PARSER parsing failed: {e}")

    def parse_pdf_omip(
        self,
        pdf_bytes: bytes,
        filename: str = "document.pdf"
    ) -> Dict[str, Any]:
        """
        Parse a PDF file using OMIP schema (convenience method).
        
        Args:
            pdf_bytes: PDF file content as bytes
            filename: Original filename
            
        Returns:
            Parsed document with OMIP structure:
            {
                "omip_id": str,
                "title": str,
                "authors": [str],
                "year": int,
                "tables": [{"number": str, "caption": str, "rows": [[{"text": str}]]}],
                "figures": [{"number": str, "caption": str, "image": {...}}]
            }
        """
        return self.parse_pdf(
            pdf_bytes=pdf_bytes,
            filename=filename,
            schema="omip",
            include_conf=False,
            save_images=True
        )
