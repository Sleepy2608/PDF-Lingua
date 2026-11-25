#!/usr/bin/env python3
"""
Database Backup & Disaster Recovery Automation Utility
------------------------------------------------------
Automates online hot backups, integrity validation, retention pruning,
and disaster recovery restoration for the PDF-Lingua database.

Features:
- Non-blocking online hot backup using SQLite Online Backup API (zero lockups during active writes).
- Automatic timestamped snapshot generation (format: backup_YYYYMMDD_HHMMSS.db).
- Full database integrity verification using PRAGMA integrity_check.
- Automatic retention policy enforcement (prunes backups older than N days).
- Disaster recovery restore mechanism with pre-restore safety checkpoints.
"""

import argparse
import logging
import os
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path so config can be loaded if available
_script_dir = Path(__file__).resolve().parent
_backend_dir = _script_dir.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

try:
    from app.core.config import settings
    DEFAULT_DB_URL = settings.DATABASE_URL
    DEFAULT_STORAGE = Path(settings.STORAGE_DIR).parent / "backups"
except Exception:
    DEFAULT_DB_URL = os.getenv("DATABASE_URL", "sqlite:///./pdf_lingua.db")
    DEFAULT_STORAGE = Path("storage/backups")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("DatabaseBackup")


def resolve_sqlite_path(db_url: str) -> Path:
    """Extract physical filesystem path from a sqlite:/// URI."""
    if db_url.startswith("sqlite:///"):
        raw_path = db_url[len("sqlite:///") :]
        p = Path(raw_path)
        if not p.is_absolute():
            p = (_backend_dir / p).resolve()
        return p
    return Path(db_url).resolve()


def check_sqlite_integrity(db_path: Path) -> tuple[bool, str]:
    """Execute PRAGMA integrity_check on the specified SQLite database file."""
    if not db_path.exists():
        return False, f"File does not exist: {db_path}"

    try:
        conn = sqlite3.connect(db_path.as_posix(), timeout=10.0)
        cursor = conn.cursor()
        cursor.execute("PRAGMA integrity_check;")
        rows = cursor.fetchall()
        conn.close()

        if rows and len(rows) == 1 and rows[0][0] == "ok":
            return True, "ok"
        detail = "; ".join(r[0] for r in rows) if rows else "No result"
        return False, detail
    except Exception as exc:
        return False, str(exc)


def perform_online_backup(source_path: Path, dest_path: Path) -> bool:
    """
    Perform a live hot backup using SQLite Online Backup API.
    Guarantees ACID transaction consistency without locking out concurrent writers.
    """
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    if not source_path.exists():
        logger.error(f"Source database not found at: {source_path}")
        return False

    logger.info(f"Initiating online hot backup: {source_path.name} -> {dest_path.name}")
    start_time = time.time()

    src_conn = None
    dest_conn = None
    try:
        src_conn = sqlite3.connect(source_path.as_posix(), timeout=30.0)
        dest_conn = sqlite3.connect(dest_path.as_posix(), timeout=30.0)

        # Uses native C-level sqlite3_backup to stream pages safely
        src_conn.backup(dest_conn, pages=-1)

        duration = time.time() - start_time
        size_kb = dest_path.stat().st_size / 1024
        logger.info(
            f"Backup completed in {duration:.2f}s. Size: {size_kb:.1f} KB. Saved to: {dest_path}"
        )

        # Validate integrity of newly generated backup
        is_valid, msg = check_sqlite_integrity(dest_path)
        if not is_valid:
            logger.error(f"Integrity check failed for backup snapshot: {msg}")
            return False

        logger.info("Backup snapshot integrity check: PASSED (ok).")
        return True
    except Exception as exc:
        logger.error(f"Backup operation failed: {exc}")
        if dest_path.exists():
            try:
                dest_path.unlink()
            except OSError:
                pass
        return False
    finally:
        if dest_conn:
            dest_conn.close()
        if src_conn:
            src_conn.close()


def prune_old_backups(backup_dir: Path, retention_days: int) -> int:
    """Prune backup files older than retention_days days from the backup directory."""
    if not backup_dir.exists():
        return 0

    now = time.time()
    cutoff_seconds = retention_days * 86400
    pruned_count = 0

    for file_path in backup_dir.glob("backup_*.db"):
        try:
            mtime = file_path.stat().st_mtime
            if (now - mtime) > cutoff_seconds:
                file_path.unlink()
                pruned_count += 1
                logger.info(f"Pruned expired backup: {file_path.name}")
        except Exception as exc:
            logger.warning(f"Could not remove {file_path.name}: {exc}")

    if pruned_count > 0:
        logger.info(f"Retention policy ({retention_days} days): pruned {pruned_count} expired backups.")
    return pruned_count


def restore_from_backup(backup_path: Path, target_db_path: Path) -> bool:
    """
    Restore the database from a backup snapshot.
    Generates a pre-restore safety copy of current target before overwriting.
    """
    if not backup_path.exists():
        logger.error(f"Restore source file not found: {backup_path}")
        return False

    # 1. Verify backup integrity before touching active database
    is_valid, msg = check_sqlite_integrity(backup_path)
    if not is_valid:
        logger.error(f"Refusing restore: backup file failed integrity check ({msg}).")
        return False

    # 2. Safety copy of current database if present
    if target_db_path.exists():
        safety_name = f"pre_restore_safety_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.db"
        safety_path = target_db_path.parent / safety_name
        logger.info(f"Creating pre-restore safety checkpoint at: {safety_path.name}")
        if not perform_online_backup(target_db_path, safety_path):
            logger.error("Could not create pre-restore safety checkpoint. Aborting restore.")
            return False

    # 3. Restore using online backup API to stream clean pages into target
    logger.info(f"Restoring database from {backup_path.name} into {target_db_path.name}...")
    success = perform_online_backup(backup_path, target_db_path)
    if success:
        logger.info("Database restoration completed successfully.")
    else:
        logger.error("Database restoration encountered an error.")
    return success


def parse_args():
    parser = argparse.ArgumentParser(
        description="PDF-Lingua Database Backup & Disaster Recovery Utility",
    )
    parser.add_argument(
        "--db-url",
        default=DEFAULT_DB_URL,
        help="Target database URL or file path (defaults to config DATABASE_URL)",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_STORAGE),
        help="Directory where backup snapshots are stored (defaults to storage/backups)",
    )
    parser.add_argument(
        "--retention-days",
        type=int,
        default=30,
        help="Retention period in days for historical backup files (default: 30)",
    )
    parser.add_argument(
        "--check-integrity",
        action="store_true",
        help="Run PRAGMA integrity_check on the active database without performing backup",
    )
    parser.add_argument(
        "--restore",
        type=str,
        default=None,
        help="Path to an existing backup snapshot to restore from",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    db_path = resolve_sqlite_path(args.db_url)
    backup_dir = Path(args.output_dir).resolve()

    if args.check_integrity:
        logger.info(f"Checking database integrity for: {db_path}")
        valid, msg = check_sqlite_integrity(db_path)
        if valid:
            logger.info("Database integrity check: PASSED (ok).")
            sys.exit(0)
        else:
            logger.error(f"Database integrity check: FAILED ({msg}).")
            sys.exit(1)

    if args.restore:
        restore_file = Path(args.restore).resolve()
        ok = restore_from_backup(restore_file, db_path)
        sys.exit(0 if ok else 1)

    # Standard Backup Flow
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    dest_file = backup_dir / f"backup_{timestamp_str}.db"

    success = perform_online_backup(db_path, dest_file)
    if success:
        prune_old_backups(backup_dir, args.retention_days)
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
