import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from app.repositories.run_repo import RunRepository
from app.repositories.metadata_repo import MetadataRepository
from app.models.models import ParsedMetadata

def test_metadata_version_logic():
    # Mock DB Session
    mock_db = MagicMock()
    
    # Test MetadataRepository
    repo = MetadataRepository(mock_db)
    run_id = uuid4()
    
    # Test add_version
    repo.add_version(
        run_id=run_id,
        omip_id="OMIP-001",
        title="Test Title",
        authors=["Author A"],
        year=2024
    )
    
    # Verify add was called
    assert mock_db.add.called
    added_obj = mock_db.add.call_args[0][0]
    assert isinstance(added_obj, ParsedMetadata)
    assert added_obj.run_id == run_id
    assert added_obj.omip_id == "OMIP-001"
    
def test_run_creation_creates_metadata_version():
    mock_db = MagicMock()
    run_repo = RunRepository(mock_db)
    
    paper_id = uuid4()
    raw_metadata = {
        "omip_id": "OMIP-999",
        "title": "Integration Test Title",
        "authors": ["Tester"],
        "year": 2025
    }
    
    # Mock the internal calls within RunRepository.create
    # Since we can't easily patch the import *inside* the method without more complex mocking,
    # we'll rely on the fact that we modified run_repo.py to import MetadataRepository locally.
    
    # However, to properly test the integration of logic without a real DB, we can check if 
    # db.add was called twice (once for run, once for metadata)
    
    with patch("app.repositories.metadata_repo.MetadataRepository") as MockMetaRepo:
        mock_meta_instance = MockMetaRepo.return_value
        
        run_repo.create(paper_id=paper_id, batch_id=None, raw_metadata=raw_metadata)
        
        # Check that metadata repo was initialized and add_version called
        assert MockMetaRepo.called
        mock_meta_instance.add_version.assert_called_once()
        ca = mock_meta_instance.add_version.call_args
        assert ca.kwargs['omip_id'] == "OMIP-999"
