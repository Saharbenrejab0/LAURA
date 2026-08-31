"""rock5 - comment pin coordinates (anchor_x, anchor_y)

Adds optional relative pin coordinates so reviewers can drop a marker
anywhere on the PPT slide. Both nullable - existing comments stay valid.
Coordinates are fractions of the slide box (0.0-1.0 each axis).
"""
from alembic import op
import sqlalchemy as sa

revision = 'rock5_comment_pins'
down_revision = 'rock2_fix_constraint'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('comments', sa.Column('anchor_x', sa.Float(), nullable=True))
    op.add_column('comments', sa.Column('anchor_y', sa.Float(), nullable=True))


def downgrade():
    op.drop_column('comments', 'anchor_y')
    op.drop_column('comments', 'anchor_x')
