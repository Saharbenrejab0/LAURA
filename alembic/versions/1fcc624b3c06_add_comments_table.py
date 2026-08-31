"""add comments table

Revision ID: 1fcc624b3c06
Revises: wf2_status_v2
Create Date: 2026-06-23 12:06:00.452416

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects import postgresql
# revision identifiers, used by Alembic.
revision: str = '1fcc624b3c06'
down_revision: Union[str, None] = 'wf2_status_v2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the comments table
    op.create_table(
        'comments',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('loa_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('author_email', sa.String(), nullable=False),
        sa.Column('author_name', sa.String(), nullable=False),
        sa.Column('author_role', sa.String(), nullable=False),
        sa.Column('section', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('written_at_status', sa.String(), nullable=False),
        sa.Column('resolved', sa.Boolean(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['loa_id'], ['loas.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_comments_loa_id', 'comments', ['loa_id'])
    op.create_index('ix_comments_author_email', 'comments', ['author_email'])


def downgrade() -> None:
    op.drop_index('ix_comments_author_email', table_name='comments')
    op.drop_index('ix_comments_loa_id', table_name='comments')
    op.drop_table('comments') ### end Alembic commands ###
