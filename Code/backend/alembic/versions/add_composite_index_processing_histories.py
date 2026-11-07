"""Add composite index (user_id, created_at, id) on processing_histories (AUDIT-06)

Revision ID: add_composite_index_histories
Revises: create_processing_histories
Create Date: 2026-11-07 16:35:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_composite_index_histories'
down_revision: Union[str, None] = 'create_processing_histories'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_NAME = 'processing_histories'
INDEX_NAME = 'ix_processing_histories_user_created_id'
INDEX_COLUMNS = ['user_id', 'created_at', 'id']


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table(TABLE_NAME):
        return

    existing_indexes = {
        idx['name']: idx for idx in inspector.get_indexes(TABLE_NAME)
    }
    if INDEX_NAME not in existing_indexes:
        op.create_index(
            INDEX_NAME,
            TABLE_NAME,
            INDEX_COLUMNS,
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table(TABLE_NAME):
        return

    existing_indexes = {
        idx['name'] for idx in inspector.get_indexes(TABLE_NAME)
    }
    if INDEX_NAME in existing_indexes:
        op.drop_index(INDEX_NAME, table_name=TABLE_NAME)

