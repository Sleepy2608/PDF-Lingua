"""Add result_path column to processing_histories (PDFL-165.1)

Revision ID: add_result_path_histories
Revises: add_composite_index_histories
Create Date: 2026-11-08 10:40:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_result_path_histories'
down_revision: Union[str, None] = 'add_composite_index_histories'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_NAME = 'processing_histories'
COLUMN_NAME = 'result_path'


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table(TABLE_NAME):
        return

    columns = [col['name'] for col in inspector.get_columns(TABLE_NAME)]
    if COLUMN_NAME not in columns:
        op.add_column(
            TABLE_NAME,
            sa.Column(
                COLUMN_NAME,
                sa.String(500),
                nullable=True,
                comment="Relative path from storage root to the persistent result JSON file.",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table(TABLE_NAME):
        return

    columns = [col['name'] for col in inspector.get_columns(TABLE_NAME)]
    if COLUMN_NAME in columns:
        op.drop_column(TABLE_NAME, COLUMN_NAME)

