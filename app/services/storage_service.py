import hashlib
from io import BytesIO
from typing import Optional
from minio import Minio
from minio.error import S3Error

from app.core.config import settings


class StorageService:
    def __init__(self):
        self.client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_root_user,
            secret_key=settings.minio_root_password,
            secure=False,
        )
        self.bucket = settings.minio_bucket
        self._bucket_ensured = False

    def compute_sha256(self, data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    def put_object(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        # Ensure bucket exists (only check once per instance)
        if not self._bucket_ensured:
            try:
                if not self.client.bucket_exists(self.bucket):
                    self.client.make_bucket(self.bucket)
                self._bucket_ensured = True
            except S3Error:
                # In docker compose, bucket is created by a helper container; ignore errors here
                self._bucket_ensured = True
        stream = BytesIO(data)
        self.client.put_object(self.bucket, key, stream, length=len(data), content_type=content_type)
        return key

    def get_object(self, key: str) -> bytes:
        """Download object from MinIO and return as bytes."""
        try:
            response = self.client.get_object(self.bucket, key)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            raise Exception(f"Failed to get object from MinIO: {e}")

    def object_key_for_pdf(self, filename: str, sha256: str) -> str:
        return f"pdfs/{sha256}_{filename}"

