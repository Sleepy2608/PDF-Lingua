"""Create processing_histories table and enums (PDFL-159.2)

Revision ID: create_processing_histories
Revises:
Create Date: 2026-11-07 00:20:00

"""
from typing import Any, Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'create_processing_histories'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_NAME = 'processing_histories'
STATE_TABLE_NAME = '_alembic_migration_state'

VALID_ACTION_TYPES = ('EXTRACT', 'TRANSLATE', 'SUMMARIZE')
VALID_STATUSES = ('PENDING', 'SUCCESS', 'FAILED')

# Enum types definition
action_type_enum = sa.Enum(
    *VALID_ACTION_TYPES,
    name='processing_action_type',
)
status_enum = sa.Enum(
    *VALID_STATUSES,
    name='processing_status',
)

# Expected column specifications: (nullable, allowed_type_tokens)
EXPECTED_COLUMNS: dict[str, dict[str, Any]] = {
    'id': {
        'nullable': False,
        'type_tokens': ('INTEGER', 'INT'),
    },
    'user_id': {
        'nullable': False,
        'type_tokens': ('INTEGER', 'INT'),
    },
    'document_id': {
        'nullable': False,
        'type_tokens': ('INTEGER', 'INT'),
    },
    'action_type': {
        'nullable': False,
        'type_tokens': ('VARCHAR', 'CHAR', 'TEXT', 'ENUM', 'PROCESSING_ACTION_TYPE'),
    },
    'status': {
        'nullable': False,
        'type_tokens': ('VARCHAR', 'CHAR', 'TEXT', 'ENUM', 'PROCESSING_STATUS'),
        'server_default': 'PENDING',
    },
    'execution_time_ms': {
        'nullable': True,
        'type_tokens': ('INTEGER', 'INT'),
    },
    'error_message': {
        'nullable': True,
        'type_tokens': ('TEXT', 'VARCHAR', 'CLOB'),
    },
    'created_at': {
        'nullable': False,
        'type_tokens': ('DATETIME', 'TIMESTAMP', 'DATE'),
    },
    'updated_at': {
        'nullable': False,
        'type_tokens': ('DATETIME', 'TIMESTAMP', 'DATE'),
    },
}

EXPECTED_INDEXES: list[tuple[str, list[str]]] = [
    ('ix_processing_histories_id', ['id']),
    ('ix_processing_histories_user_id', ['user_id']),
    ('ix_processing_histories_document_id', ['document_id']),
    ('ix_processing_histories_action_type', ['action_type']),
    ('ix_processing_histories_status', ['status']),
    ('ix_processing_histories_created_at', ['created_at']),
]


def _ensure_prerequisite_tables(bind: sa.engine.Connection, inspector: sa.Inspector) -> None:
    """
    Ensure foundational tables (`users`, `documents`) exist on fresh environments
    where `init_db()` (`Base.metadata.create_all()`) has not yet been executed.
    Existing tables and data are never modified.
    """
    missing_prereqs = [
        tbl for tbl in ('users', 'documents') if not inspector.has_table(tbl)
    ]
    if missing_prereqs:
        from app.core.database import Base
        import app.models  # noqa: F401

        prereq_table_objs = [
            Base.metadata.tables[tbl]
            for tbl in ('users', 'documents')
            if tbl in Base.metadata.tables
        ]
        Base.metadata.create_all(bind=bind, tables=prereq_table_objs, checkfirst=True)


def _record_migration_ownership(
    bind: sa.engine.Connection,
    *,
    table_created: bool,
    created_indexes: list[str],
) -> None:
    """
    Persist ownership metadata so `downgrade()` knows whether `processing_histories`
    was created by this migration (`table_created=True`) or adopted from a prior
    `Base.metadata.create_all()` execution (`table_created=False`).
    """
    bind.execute(
        sa.text(
            f"CREATE TABLE IF NOT EXISTS {STATE_TABLE_NAME} ("
            "revision VARCHAR(64) PRIMARY KEY, "
            "table_created INTEGER NOT NULL, "
            "created_indexes TEXT NOT NULL"
            ")"
        )
    )
    bind.execute(
        sa.text(f"DELETE FROM {STATE_TABLE_NAME} WHERE revision = :rev"),
        {'rev': revision},
    )
    bind.execute(
        sa.text(
            f"INSERT INTO {STATE_TABLE_NAME} (revision, table_created, created_indexes) "
            "VALUES (:rev, :tc, :ci)"
        ),
        {
            'rev': revision,
            'tc': 1 if table_created else 0,
            'ci': ','.join(created_indexes),
        },
    )


def _get_migration_ownership(
    bind: sa.engine.Connection,
    inspector: sa.Inspector,
) -> tuple[bool, list[str]]:
    """
    Retrieve ownership metadata for this revision.
    If no state record exists, defaults to `(False, [])` so `downgrade()`
    never drops a table whose ownership is unconfirmed.
    """
    if not inspector.has_table(STATE_TABLE_NAME):
        return False, []

    row = bind.execute(
        sa.text(
            f"SELECT table_created, created_indexes FROM {STATE_TABLE_NAME} "
            "WHERE revision = :rev"
        ),
        {'rev': revision},
    ).fetchone()

    if row is None:
        return False, []

    table_created = bool(row[0])
    raw_indexes = row[1] or ''
    created_indexes = [idx for idx in raw_indexes.split(',') if idx]
    return table_created, created_indexes


def _cleanup_migration_ownership(
    bind: sa.engine.Connection,
    inspector: sa.Inspector,
) -> None:
    """Remove ownership entry for this revision and drop state table if empty."""
    if not inspector.has_table(STATE_TABLE_NAME):
        return

    bind.execute(
        sa.text(f"DELETE FROM {STATE_TABLE_NAME} WHERE revision = :rev"),
        {'rev': revision},
    )
    remaining = (
        bind.execute(sa.text(f"SELECT COUNT(*) FROM {STATE_TABLE_NAME}")).scalar()
        or 0
    )
    if remaining == 0:
        op.drop_table(STATE_TABLE_NAME)


def _verify_and_reconcile_existing_table(
    bind: sa.engine.Connection,
    inspector: sa.Inspector,
) -> list[str]:
    """
    Validate schema integrity when `processing_histories` was pre-created by
    `Base.metadata.create_all()`.

    Verifies:
    - Required columns, data types, nullability, and server defaults.
    - Primary key constraint on `id`.
    - Foreign keys to `users.id` and `documents.id` including `ondelete='CASCADE'`.
    - Enum domain validity for existing records (`action_type`, `status`).
    - Index definitions (`column_names` and `unique=False`), creating any missing indexes.

    Returns the list of index names created during reconciliation.
    """
    # 1. Verify columns, data types, nullability, and server_default
    existing_cols = {
        col['name']: col for col in inspector.get_columns(TABLE_NAME)
    }
    missing_cols = [col for col in EXPECTED_COLUMNS if col not in existing_cols]
    if missing_cols:
        raise RuntimeError(
            f"Existing table '{TABLE_NAME}' is missing required columns: {missing_cols}"
        )

    for col_name, spec in EXPECTED_COLUMNS.items():
        col_info = existing_cols[col_name]

        # Check nullable
        expected_nullable = spec['nullable']
        actual_nullable = bool(col_info.get('nullable', True))
        if actual_nullable != expected_nullable:
            raise RuntimeError(
                f"Column '{TABLE_NAME}.{col_name}' nullable mismatch: "
                f"expected={expected_nullable}, actual={actual_nullable}"
            )

        # Check data type compatibility
        col_type_str = str(col_info.get('type', '')).upper()
        allowed_tokens = spec['type_tokens']
        if not any(token in col_type_str for token in allowed_tokens):
            raise RuntimeError(
                f"Column '{TABLE_NAME}.{col_name}' type mismatch: "
                f"expected one of {allowed_tokens}, got '{col_type_str}'"
            )

        # Check server_default if required by spec
        if 'server_default' in spec:
            expected_default = spec['server_default']
            raw_default = col_info.get('default')
            if raw_default is None:
                raise RuntimeError(
                    f"Column '{TABLE_NAME}.{col_name}' is missing server_default "
                    f"(expected '{expected_default}')"
                )
            normalized_default = str(raw_default).strip().strip("'\"").upper()
            if expected_default.upper() not in normalized_default:
                raise RuntimeError(
                    f"Column '{TABLE_NAME}.{col_name}' server_default mismatch: "
                    f"expected '{expected_default}', got '{raw_default}'"
                )

    # 2. Verify Primary Key
    pk_constraint = inspector.get_pk_constraint(TABLE_NAME) or {}
    pk_cols = pk_constraint.get('constrained_columns') or []
    if pk_cols != ['id']:
        raise RuntimeError(
            f"Primary key mismatch on '{TABLE_NAME}': expected ['id'], got {pk_cols}"
        )

    # 3. Verify Foreign Keys to users.id and documents.id and ON DELETE CASCADE
    fks = inspector.get_foreign_keys(TABLE_NAME)
    fk_map: dict[tuple[tuple[str, ...], str, tuple[str, ...]], str] = {}
    for fk in fks:
        key = (
            tuple(fk.get('constrained_columns') or ()),
            str(fk.get('referred_table') or ''),
            tuple(fk.get('referred_columns') or ()),
        )
        options = fk.get('options') or {}
        ondelete_val = str(options.get('ondelete') or fk.get('ondelete') or '').upper()
        fk_map[key] = ondelete_val

    required_fks = {
        (('user_id',), 'users', ('id',)),
        (('document_id',), 'documents', ('id',)),
    }
    missing_fks = required_fks - set(fk_map.keys())
    if missing_fks:
        raise RuntimeError(
            f"Foreign key mismatch on '{TABLE_NAME}': missing {missing_fks}"
        )

    for fk_key in required_fks:
        if fk_map[fk_key] != 'CASCADE':
            raise RuntimeError(
                f"Foreign key {fk_key} on '{TABLE_NAME}' ondelete mismatch: "
                f"expected 'CASCADE', got '{fk_map[fk_key] or None}'"
            )

    # 4. Verify Enum values on existing records (prevent corrupt pre-existing data)
    invalid_actions = bind.execute(
        sa.text(
            f"SELECT DISTINCT action_type FROM {TABLE_NAME} "
            "WHERE action_type NOT IN ('EXTRACT', 'TRANSLATE', 'SUMMARIZE') "
            "OR action_type IS NULL"
        )
    ).fetchall()
    if invalid_actions:
        raise RuntimeError(
            f"Existing table '{TABLE_NAME}' contains invalid action_type values: "
            f"{[r[0] for r in invalid_actions]}"
        )

    invalid_statuses = bind.execute(
        sa.text(
            f"SELECT DISTINCT status FROM {TABLE_NAME} "
            "WHERE status NOT IN ('PENDING', 'SUCCESS', 'FAILED') "
            "OR status IS NULL"
        )
    ).fetchall()
    if invalid_statuses:
        raise RuntimeError(
            f"Existing table '{TABLE_NAME}' contains invalid status values: "
            f"{[r[0] for r in invalid_statuses]}"
        )

    # 5. Verify and reconcile Indexes
    existing_indexes = {
        idx['name']: idx for idx in inspector.get_indexes(TABLE_NAME)
    }
    reconciled_indexes: list[str] = []
    for idx_name, expected_idx_cols in EXPECTED_INDEXES:
        if idx_name not in existing_indexes:
            op.create_index(idx_name, TABLE_NAME, expected_idx_cols, unique=False)
            reconciled_indexes.append(idx_name)
        else:
            idx_info = existing_indexes[idx_name]
            actual_cols = idx_info.get('column_names') or []
            if actual_cols != expected_idx_cols:
                raise RuntimeError(
                    f"Index '{idx_name}' on '{TABLE_NAME}' column mismatch: "
                    f"expected {expected_idx_cols}, got {actual_cols}"
                )
            if bool(idx_info.get('unique', False)) is True:
                raise RuntimeError(
                    f"Index '{idx_name}' on '{TABLE_NAME}' unique mismatch: "
                    "expected unique=False, got unique=True"
                )

    return reconciled_indexes


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Ensure prerequisite tables exist on clean installs
    _ensure_prerequisite_tables(bind, inspector)

    if not inspector.has_table(TABLE_NAME):
        # Create processing_histories table (SQLAlchemy creates Enum types if needed)
        op.create_table(
            TABLE_NAME,
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column(
                'user_id',
                sa.Integer(),
                nullable=False,
                comment='Owner user ID who initiated the processing action.',
            ),
            sa.Column(
                'document_id',
                sa.Integer(),
                nullable=False,
                comment='Target document ID on which the action was performed.',
            ),
            sa.Column(
                'action_type',
                action_type_enum,
                nullable=False,
                comment='Operation type: EXTRACT | TRANSLATE | SUMMARIZE.',
            ),
            sa.Column(
                'status',
                status_enum,
                server_default='PENDING',
                nullable=False,
                comment='Current execution status: PENDING | SUCCESS | FAILED.',
            ),
            sa.Column(
                'execution_time_ms',
                sa.Integer(),
                nullable=True,
                comment='Total processing time in milliseconds.',
            ),
            sa.Column(
                'error_message',
                sa.Text(),
                nullable=True,
                comment='Failure reason or error trace if processing failed.',
            ),
            sa.Column(
                'created_at',
                sa.DateTime(timezone=True),
                nullable=False,
                comment='UTC timestamp when processing was initiated.',
            ),
            sa.Column(
                'updated_at',
                sa.DateTime(timezone=True),
                nullable=False,
                comment='UTC timestamp when this record was last updated.',
            ),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )

        created_idx_names: list[str] = []
        for idx_name, idx_cols in EXPECTED_INDEXES:
            op.create_index(idx_name, TABLE_NAME, idx_cols, unique=False)
            created_idx_names.append(idx_name)

        _record_migration_ownership(
            bind,
            table_created=True,
            created_indexes=created_idx_names,
        )
    else:
        # Table was pre-created by Base.metadata.create_all(); verify & reconcile
        reconciled_idx_names = _verify_and_reconcile_existing_table(bind, inspector)
        _record_migration_ownership(
            bind,
            table_created=False,
            created_indexes=reconciled_idx_names,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    table_created_by_migration, created_indexes = _get_migration_ownership(
        bind, inspector
    )

    if inspector.has_table(TABLE_NAME):
        existing_indexes = {
            idx['name'] for idx in inspector.get_indexes(TABLE_NAME)
        }

        if table_created_by_migration:
            # Protect against accidental data loss even when table was created by migration
            row_count = (
                bind.execute(
                    sa.text(f"SELECT COUNT(*) FROM {TABLE_NAME}")
                ).scalar()
                or 0
            )
            if row_count > 0:
                raise RuntimeError(
                    f"Refusing to drop table '{TABLE_NAME}' during downgrade because "
                    f"it contains {row_count} existing record(s)."
                )

            for idx_name, _ in reversed(EXPECTED_INDEXES):
                if idx_name in existing_indexes:
                    op.drop_index(idx_name, table_name=TABLE_NAME)

            op.drop_table(TABLE_NAME)

            if bind.dialect.name == 'postgresql':
                status_enum.drop(bind, checkfirst=True)
                action_type_enum.drop(bind, checkfirst=True)
        else:
            # Table existed prior to migration (adopted from create_all):
            # Only drop indexes that were created during migration reconciliation;
            # never drop pre-existing table, pre-existing indexes, or user data.
            for idx_name in reversed(created_indexes):
                if idx_name in existing_indexes:
                    op.drop_index(idx_name, table_name=TABLE_NAME)

    _cleanup_migration_ownership(bind, inspector)

