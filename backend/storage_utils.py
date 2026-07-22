"""Object storage helper - S3-compatible (AWS S3, Cloudflare R2, Backblaze B2, MinIO, etc).

Configure via env vars:
  S3_BUCKET            (required)
  S3_ENDPOINT_URL       (optional - set for R2/B2/MinIO, omit for real AWS S3)
  S3_REGION             (default "auto")
  AWS_ACCESS_KEY_ID     (required)
  AWS_SECRET_ACCESS_KEY (required)
"""
import os
from functools import lru_cache

import boto3
from botocore.client import Config as BotoConfig

_bucket_name: str | None = None


@lru_cache(maxsize=1)
def _client():
    global _bucket_name
    _bucket_name = os.environ["S3_BUCKET"]
    return boto3.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT_URL") or None,
        region_name=os.environ.get("S3_REGION", "auto"),
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        config=BotoConfig(signature_version="s3v4"),
    )


def init_storage() -> None:
    """Kept for backward-compat call sites; eagerly creates the client."""
    _client()


def put_object(path: str, data: bytes, content_type: str) -> dict:
    s3 = _client()
    s3.put_object(Bucket=_bucket_name, Key=path, Body=data, ContentType=content_type)
    return {"path": path, "content_type": content_type}


def get_object(path: str) -> tuple[bytes, str]:
    s3 = _client()
    obj = s3.get_object(Bucket=_bucket_name, Key=path)
    return obj["Body"].read(), obj.get("ContentType", "application/octet-stream")
