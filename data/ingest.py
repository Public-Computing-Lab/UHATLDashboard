#!/usr/bin/env python3
"""
CSV Data Ingestion Script for Supabase csv_submissions table
Handles normalization, parsing, and inserts into Supabase
"""

import csv
import sys
import os
import logging
import re
from datetime import datetime
from typing import Optional, Dict, Any, List
from decimal import Decimal, InvalidOperation
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ingest.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class SupabaseCSVIngester:
    def __init__(self, supabase_url: str, supabase_key: str, user_email: str = None):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.user_email = user_email
        self.supabase: Client = None

        self.header_mappings = {
            'name': ['name'],
            'email': ['email'],
            'neighborhood': ['neighborhood'],
            'transport': ['transport'],
            'created_at': ['submission datetime', 'submission_datetime'],
            'csv_url': ['csv url', 'csv_url'],
            'has_csv': ['**has csv', 'has csv', 'has_csv'],
            'notes': ['notes'],
            'complete': ['complete', 'is_complete'],
            'has_probe_temp': ['**has temp', 'has temp', 'has_temp'],
            'has_lat_lng': ['has location', 'has_location'],
            'num_records': ['numrecords', 'num_records', 'records']
        }

        self.stats = {
            'total_rows': 0,
            'successful_inserts': 0,
            'failed_inserts': 0,
            'validation_errors': 0,
            'skipped_rows': 0
        }

    def connect_to_supabase(self) -> bool:
        try:
            self.supabase = create_client(self.supabase_url, self.supabase_key)
            logger.info("Supabase client initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Supabase client initialization failed: {e}")
            return False

    def normalize_header(self, header: str) -> str:
        return header.strip().lower().replace(' ', '_').replace('*', '').replace('?', '')

    def map_headers(self, csv_headers: List[str]) -> Dict[str, int]:
        header_mapping = {}
        normalized_headers = [self.normalize_header(h) for h in csv_headers]
        for db_col, possible_headers in self.header_mappings.items():
            for possible_header in possible_headers:
                norm = self.normalize_header(possible_header)
                if norm in normalized_headers:
                    header_mapping[db_col] = normalized_headers.index(norm)
                    break
        return header_mapping

    def validate_email(self, email: str) -> bool:
        if not email:
            return False
        return re.match(r'^[^@]+@[^@]+\\.[^@]+$', email) is not None

    def parse_datetime(self, value: str) -> Optional[str]:
        if not value or value.strip() == '':
            return None
        value = value.strip()
        formats = [
            '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S.%f',
            '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f',
            '%m/%d/%Y %H:%M:%S', '%Y-%m-%d'
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt).isoformat()
            except ValueError:
                continue
        logger.warning(f"Unparsable datetime: {value}")
        return None

    def parse_boolean(self, value: str) -> Optional[bool]:
        if not value:
            return None
        val = value.strip().lower().replace('**', '')
        if val in ['true', '1', 'yes', 'y', 'on']:
            return "TRUE"
        elif val in ['false', '0', 'no', 'n', 'off']:
            return "FALSE"
        return None

    def parse_integer(self, value: str) -> Optional[int]:
        if not value or value.strip() == '':
            return None
        try:
            return int(value.strip())
        except Exception:
            return None

    def clean_string(self, value: str) -> Optional[str]:
        return value.strip() if value and value.strip() else None

    def validate_row(self, data: Dict[str, Any]) -> bool:
        valid = True
        if not data.get("email") or not self.validate_email(data["email"]):
            valid = False
        if not data.get("created_at"):
            valid = False
        if not valid:
            self.stats["validation_errors"] += 1
        return valid

    def process_row(self, row: List[str], header_map: Dict[str, int]) -> Optional[Dict[str, Any]]:
        raw = {k: row[v] if v < len(row) else '' for k, v in header_map.items()}
        record = {
            'name': self.clean_string(raw.get('name')),
            'email': self.clean_string(raw.get('email')),
            'neighborhood': self.clean_string(raw.get('neighborhood')),
            'transport': self.clean_string(raw.get('transport')),
            'created_at': self.parse_datetime(raw.get('created_at')),
            'csv_url': self.clean_string(raw.get('csv_url')),
            'notes': self.clean_string(raw.get('notes')),
            'complete': self.parse_boolean(raw.get('complete')),
            'has_csv': self.parse_boolean(raw.get('has_csv')),
            'has_probe_temp': self.parse_boolean(raw.get('has_probe_temp')),
            'has_lat_lng': self.parse_boolean(raw.get('has_lat_lng')),
            'num_records': self.parse_integer(raw.get('num_records')),
        }
        return {k: v for k, v in record.items() if v is not None}

    def insert_batch(self, data: List[Dict[str, Any]]) -> int:
        try:
            res = self.supabase.table("csv_submissions").insert(data).execute()
            return len(res.data) if res.data else 0
        except Exception as e:
            logger.error(f"Batch insert failed: {e}")
            return self.insert_one_by_one(data)

    def insert_one_by_one(self, data: List[Dict[str, Any]]) -> int:
        success = 0
        for record in data:
            try:
                res = self.supabase.table("csv_submissions").insert(record).execute()
                if res.data:
                    success += 1
            except Exception as e:
                logger.error(f"Insert failed for record: {e}")
        return success

    def ingest_csv(self, path: str, batch_size: int = 100):
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader)
            header_map = self.map_headers(headers)
            batch, count = [], 0
            for row in reader:
                if not any(row): continue
                self.stats['total_rows'] += 1
                processed = self.process_row(row, header_map)
                if processed:
                    batch.append(processed)
                    if len(batch) >= batch_size:
                        success = self.insert_batch(batch)
                        self.stats['successful_inserts'] += success
                        self.stats['failed_inserts'] += len(batch) - success
                        batch = []
            if batch:
                success = self.insert_batch(batch)
                self.stats['successful_inserts'] += success
                self.stats['failed_inserts'] += len(batch) - success
        self.print_stats()

    def print_stats(self):
        logger.info("=== INGESTION STATS ===")
        for k, v in self.stats.items():
            logger.info(f"{k.replace('_', ' ').capitalize()}: {v}")

def main():
    SUPABASE_URL = "https://scpcfumxejgjoknxzxmf.supabase.co"
    SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcGNmdW14ZWpnam9rbnh6eG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyODg5NTAsImV4cCI6MjA2Mzg2NDk1MH0.PgHEzgKiI9pdmM0jEx_gTlI2e0M-EnBXhztgueqpcKg"
    CSV_FILE = "data/HistoricCSVSubmissions - Sheet1.csv"

    ingester = SupabaseCSVIngester(SUPABASE_URL, SUPABASE_KEY)
    if not ingester.connect_to_supabase():
        sys.exit(1)
    ingester.ingest_csv(CSV_FILE)

if __name__ == "__main__":
    main()
