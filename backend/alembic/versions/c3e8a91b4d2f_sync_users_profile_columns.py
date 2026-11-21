"""sync users profile columns and employee departments

Revision ID: c3e8a91b4d2f
Revises: f0c2b5c69eca
Create Date: 2026-11-21 02:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c3e8a91b4d2f"
down_revision: Union[str, None] = "f0c2b5c69eca"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(table: str) -> set[str]:
    bind = op.get_bind()
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def _has_table(table: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table)


def upgrade() -> None:
    users_columns = _columns("users")

    if "updated_at" not in users_columns:
        op.add_column("users", sa.Column("updated_at", sa.DateTime(), nullable=True))
        op.execute("UPDATE users SET updated_at = created_at WHERE updated_at IS NULL")
        op.alter_column("users", "updated_at", nullable=False)

    if "phone" not in users_columns:
        op.add_column("users", sa.Column("phone", sa.String(length=50), nullable=True))
    if "avatar_url" not in users_columns:
        op.add_column("users", sa.Column("avatar_url", sa.String(length=500), nullable=True))
    if "telegram" not in users_columns:
        op.add_column("users", sa.Column("telegram", sa.String(length=100), nullable=True))
    if "city" not in users_columns:
        op.add_column("users", sa.Column("city", sa.String(length=100), nullable=True))
    if "about" not in users_columns:
        op.add_column("users", sa.Column("about", sa.Text(), nullable=True))
    if "notify_by_email" not in users_columns:
        op.add_column(
            "users",
            sa.Column(
                "notify_by_email",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            ),
        )
        op.alter_column("users", "notify_by_email", server_default=None)

    employee_columns = _columns("employees")
    if "department_id" in employee_columns:
        op.alter_column("employees", "department_id", nullable=True)

    if not _has_table("employee_departments"):
        op.create_table(
            "employee_departments",
            sa.Column("employee_id", sa.Uuid(), nullable=False),
            sa.Column("department_id", sa.Uuid(), nullable=False),
            sa.ForeignKeyConstraint(["department_id"], ["departments.id"]),
            sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
            sa.PrimaryKeyConstraint("employee_id", "department_id"),
        )
        if "department_id" in employee_columns:
            op.execute(
                """
                INSERT INTO employee_departments (employee_id, department_id)
                SELECT id, department_id
                FROM employees
                WHERE department_id IS NOT NULL
                ON CONFLICT DO NOTHING
                """
            )

    if not _has_table("surveys"):
        op.create_table(
            "surveys",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("company_id", sa.Uuid(), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("category", sa.String(length=100), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_by", sa.Uuid(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _has_table("survey_questions"):
        op.create_table(
            "survey_questions",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("survey_id", sa.Uuid(), nullable=False),
            sa.Column("question_text", sa.Text(), nullable=True),
            sa.Column(
                "question_type",
                sa.Enum("slider", "checkbox", "text", "radio", name="questiontype"),
                nullable=True,
            ),
            sa.Column("order_index", sa.Integer(), nullable=True),
            sa.Column("is_required", sa.Boolean(), nullable=False),
            sa.Column("options_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _has_table("survey_sessions"):
        op.create_table(
            "survey_sessions",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("survey_id", sa.Uuid(), nullable=False),
            sa.Column("company_id", sa.Uuid(), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=True),
            sa.Column("start_date", sa.DateTime(), nullable=True),
            sa.Column("end_date", sa.DateTime(), nullable=True),
            sa.Column(
                "status",
                sa.Enum("draft", "active", "completed", name="sessionstatus"),
                nullable=True,
            ),
            sa.Column("created_by", sa.Uuid(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _has_table("survey_assignments"):
        op.create_table(
            "survey_assignments",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("session_id", sa.Uuid(), nullable=False),
            sa.Column("respondent_id", sa.Uuid(), nullable=False),
            sa.Column("target_id", sa.Uuid(), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=False),
            sa.Column("notified_at", sa.DateTime(), nullable=True),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["respondent_id"], ["employees.id"]),
            sa.ForeignKeyConstraint(["session_id"], ["survey_sessions.id"]),
            sa.ForeignKeyConstraint(["target_id"], ["employees.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "session_id",
                "respondent_id",
                "target_id",
                name="uq_session_respondent_target",
            ),
        )

    if not _has_table("survey_results"):
        op.create_table(
            "survey_results",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("session_id", sa.Uuid(), nullable=False),
            sa.Column("target_id", sa.Uuid(), nullable=False),
            sa.Column("average_score", sa.Float(), nullable=True),
            sa.Column("total_respondents", sa.Integer(), nullable=False),
            sa.Column("completed_respondents", sa.Integer(), nullable=False),
            sa.Column(
                "category_scores",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
            ),
            sa.Column("is_anonymous_safe", sa.Boolean(), nullable=False),
            sa.Column("calculated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["session_id"], ["survey_sessions.id"]),
            sa.ForeignKeyConstraint(["target_id"], ["employees.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _has_table("survey_answers"):
        op.create_table(
            "survey_answers",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("assignment_id", sa.Uuid(), nullable=False),
            sa.Column("question_id", sa.Uuid(), nullable=False),
            sa.Column("numeric_value", sa.Float(), nullable=True),
            sa.Column("text_value", sa.Text(), nullable=True),
            sa.Column("boolean_value", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["assignment_id"], ["survey_assignments.id"]),
            sa.ForeignKeyConstraint(["question_id"], ["survey_questions.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "assignment_id",
                "question_id",
                name="uq_assignment_question",
            ),
        )


def downgrade() -> None:
    pass
