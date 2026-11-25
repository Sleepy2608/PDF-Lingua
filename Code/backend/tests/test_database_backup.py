"""
Unit Tests for Database Backup & Disaster Recovery Automation
-------------------------------------------------------------
Verifies live hot backup generation, integrity validation,
retention pruning, and disaster recovery restore operations.
"""

import sqlite3
import time
from pathlib import Path

import pytest

from scripts.backup_db import (
    check_sqlite_integrity,
    perform_online_backup,
    prune_old_backups,
    restore_from_backup,
)


@pytest.fixture
def sample_database(tmp_path: Path):
    """Create a temporary populated SQLite database."""
    db_file = tmp_path / "test_source.db"
    conn = sqlite3.connect(db_file.as_posix())
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, role TEXT);")
    cursor.execute("INSERT INTO users (email, role) VALUES ('admin@example.com', 'admin');")
    cursor.execute("INSERT INTO users (email, role) VALUES ('user@example.com', 'free');")
    conn.commit()
    conn.close()
    return db_file


def test_backup_creates_valid_snapshot(sample_database: Path, tmp_path: Path):
    """Verify that perform_online_backup creates an exact, healthy backup snapshot."""
    backup_file = tmp_path / "backups" / "backup_20261125_000000.db"

    success = perform_online_backup(sample_database, backup_file)
    assert success is True
    assert backup_file.exists()
    assert backup_file.stat().st_size > 0

    # Validate integrity
    is_valid, msg = check_sqlite_integrity(backup_file)
    assert is_valid is True
    assert msg == "ok"

    # Validate data inside snapshot
    conn = sqlite3.connect(backup_file.as_posix())
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) FROM users;")
    count = cursor.fetchone()[0]
    conn.close()
    assert count == 2


def test_integrity_check_detects_corrupt_file(tmp_path: Path):
    """Verify that check_sqlite_integrity flags non-database and corrupted files."""
    corrupt_file = tmp_path / "corrupt.db"
    corrupt_file.write_text("THIS IS NOT A VALID SQLITE DATABASE", encoding="utf-8")

    is_valid, msg = check_sqlite_integrity(corrupt_file)
    assert is_valid is False
    assert "file is not a database" in msg.lower() or "error" in msg.lower()


def test_retention_prune_removes_old_backups(tmp_path: Path):
    """Verify that prune_old_backups only deletes files exceeding retention period."""
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    old_file = backup_dir / "backup_20200101_120000.db"
    new_file = backup_dir / "backup_20261125_120000.db"
    other_file = backup_dir / "unrelated_notes.txt"

    old_file.write_text("old", encoding="utf-8")
    new_file.write_text("new", encoding="utf-8")
    other_file.write_text("keep", encoding="utf-8")

    # Artificially age the old file by 40 days
    forty_days_ago = time.time() - (40 * 86400)
    os_utime = getattr(time, "time")
    import os
    os.utime(old_file.as_posix(), (forty_days_ago, forty_days_ago))

    pruned = prune_old_backups(backup_dir, retention_days=30)
    assert pruned == 1
    assert not old_file.exists()
    assert new_file.exists()
    assert other_file.exists()


def test_restore_recovers_database_state(sample_database: Path, tmp_path: Path):
    """Verify that restore_from_backup recovers the database to the snapshot state."""
    backup_file = tmp_path / "good_backup.db"
    perform_online_backup(sample_database, backup_file)

    # Mutate source database (simulate accidental data loss or corruption)
    conn = sqlite3.connect(sample_database.as_posix())
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users;")
    cursor.execute("INSERT INTO users (email, role) VALUES ('bad_actor@hack.com', 'guest');")
    conn.commit()
    conn.close()

    # Verify degraded state
    conn = sqlite3.connect(sample_database.as_posix())
    cursor = conn.cursor()
    cursor.execute("SELECT email FROM users;")
    emails = [r[0] for r in cursor.fetchall()]
    conn.close()
    assert emails == ["bad_actor@hack.com"]

    # Execute restore
    restore_success = restore_from_backup(backup_file, sample_database)
    assert restore_success is True

    # Verify original state recovered
    conn = sqlite3.connect(sample_database.as_posix())
    cursor = conn.cursor()
    cursor.execute("SELECT email FROM users ORDER BY id;")
    recovered_emails = [r[0] for r in cursor.fetchall()]
    conn.close()
    assert recovered_emails == ["admin@example.com", "user@example.com"]
