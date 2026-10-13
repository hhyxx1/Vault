"""Widen review_assignment.course_code for self-built / unlisted course labels.

Revision ID: 0016_review_course_code_width
Revises: 0015_server_verification
"""

import sqlalchemy as sa
from alembic import op

revision = "0016_review_course_code_width"
down_revision = "0015_server_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "review_assignment",
        "course_code",
        existing_type=sa.String(32),
        type_=sa.String(64),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "review_assignment",
        "course_code",
        existing_type=sa.String(64),
        type_=sa.String(32),
        existing_nullable=False,
    )
