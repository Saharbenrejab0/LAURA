"""Sprint 2: Add role/permission system and refactor LOA status enum

Revision ID: sprint2_rolepermissions
Revises: a691d6968278
Create Date: 2026-06-10

What this migration does:

1. Creates 3 new tables:
   - role: defines all roles in LAURA (France Marketer, EMEA PS Editor, etc.)
   - permission: defines the 4 permission types (view, edit, comment, validate)
   - role_permission: the matrix - for each (role, loa_status), which permission applies

2. Adds role_id foreign key to users table (keeps old role string column
   for backward compatibility during transition).

3. Adds new values to LOA status enum (the 11 real workflow statuses):
   - local_prep, country_review, global_review, corporate_review,
     ceo_validation, locked
   Old values (draft, submitted, brand_review, cmo_review, cfo_review,
   approved, rejected) are kept and stay valid.

4. Migrates existing LOA rows from old status names to new ones:
   - submitted -> country_review
   - brand_review -> global_review
   (Others stay the same.)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'sprint2_rolepermissions'
down_revision = 'a691d6968278'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── 1. Create permission table ────────────────────────────────────
    op.create_table(
        'permission',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(20), nullable=False, unique=True),
        sa.Column('display_name', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('hierarchy_level', sa.Integer(), nullable=False, default=0),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_permission_code', 'permission', ['code'])

    # ─── 2. Create role table ──────────────────────────────────────────
    op.create_table(
        'role',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(50), nullable=False, unique=True),
        sa.Column('display_name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('scope_type', sa.String(20), nullable=False),
        # scope_type values: 'all', 'cluster', 'brand', 'function', 'author_only'
        sa.Column('scope_value', sa.JSON(), nullable=True),
        sa.Column('can_override_lock', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_role_code', 'role', ['code'])
    op.create_index('ix_role_scope_type', 'role', ['scope_type'])

    # ─── 3. Create role_permission matrix table ────────────────────────
    op.create_table(
        'role_permission',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('role.id', ondelete='CASCADE'), nullable=False),
        sa.Column('loa_status', sa.String(50), nullable=False),
        sa.Column('permission_id', sa.Integer(), sa.ForeignKey('permission.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint('role_id', 'loa_status', name='uq_role_status'),
    )
    op.create_index('ix_role_permission_lookup', 'role_permission', ['role_id', 'loa_status'])

    # ─── 4. Add role_id to users table (nullable for migration safety) ─
    op.add_column('users',
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('role.id'), nullable=True)
    )
    op.create_index('ix_users_role_id', 'users', ['role_id'])

    # ─── 5. Migrate existing LOA statuses to new values ───────────────
    # The PostgreSQL enum 'loastatus' is extended via ALTER TYPE ADD VALUE
    # which cannot run inside a transaction. We use commit() between statements.

    conn = op.get_bind()

    # Add new enum values one by one (each must be in its own transaction)
    new_status_values = [
        'local_prep',
        'country_review',
        'global_review',
        'corporate_review',
        'ceo_validation',
        'locked',
    ]
    for value in new_status_values:
        conn.execute(sa.text(f"ALTER TYPE loastatus ADD VALUE IF NOT EXISTS '{value}'"))
        conn.commit()

    # Now migrate existing rows.
    # Table name is 'loas' (plural) in this project.
    conn.execute(sa.text("""
        UPDATE loas
        SET status = 'country_review'
        WHERE status = 'submitted'
    """))
    conn.execute(sa.text("""
        UPDATE loas
        SET status = 'global_review'
        WHERE status = 'brand_review'
    """))


def downgrade() -> None:
    # Reverse migration: drop new tables, drop role_id column.
    # Note: cannot remove enum values in PostgreSQL — they remain harmless.

    op.drop_index('ix_users_role_id', 'users')
    op.drop_column('users', 'role_id')

    op.drop_index('ix_role_permission_lookup', 'role_permission')
    op.drop_table('role_permission')

    op.drop_index('ix_role_scope_type', 'role')
    op.drop_index('ix_role_code', 'role')
    op.drop_table('role')

    op.drop_index('ix_permission_code', 'permission')
    op.drop_table('permission')

    # Revert LOA status changes
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE loas
        SET status = 'submitted'
        WHERE status = 'country_review'
    """))
    conn.execute(sa.text("""
        UPDATE loas
        SET status = 'brand_review'
        WHERE status = 'global_review'
    """))