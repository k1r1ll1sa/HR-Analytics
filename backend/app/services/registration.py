from uuid import UUID
from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.user import User
from app.models.company import Company, Employee, Department, EmployeeDepartment
from app.core.security import get_password_hash


class RegistrationService:
    @staticmethod
    async def register_company_with_owner(db: AsyncSession, company_data: dict, user_data: dict):
        try:
            user = User(
                full_name=user_data['full_name'],
                email=user_data['email'],
                hashed_password=get_password_hash(user_data['password']),
                role='owner',
                is_active=True
            )
            db.add(user)
            await db.flush()

            company = Company(
                **company_data,
                owner_id = user.id,
                is_active=True
            )

            db.add(company)
            await db.flush()

            management_dept = Department(
                company_id=company.id,
                name='руководство',
                description='Административный отдел'
            )

            db.add(management_dept)
            await db.flush()

            owner_employee = Employee(
                company_id=company.id,
                user_id=user.id,
                role='owner',
                hire_date=date.today(),
                is_active=True
            )

            db.add(owner_employee)
            await db.flush()

            emp_dept_link = EmployeeDepartment(
                employee_id=owner_employee.id,
                department_id=management_dept.id
            )

            db.add(emp_dept_link)
            await db.commit()

            await db.refresh(company)
            await db.refresh(user)

            return {'user': user, 'company': company}

        except IntegrityError as e:
            await db.rollback()
            if 'users.email' in str(e.orig) or 'ix_users_email' in str(e.orig):
                raise ValueError('Пользователь с таким email уже существует')
            raise ValueError(f'Ошибка базы данных: {str(e)}')


    @staticmethod
    async def register_employee(db: AsyncSession, user_data: dict, company_id: UUID, department_id: UUID = None):
        try:
            company_stmt = select(Company).where(Company.id == company_id)
            company_result = await db.execute(company_stmt)
            company = company_result.scalar_one_or_none()

            if not company:
                raise ValueError('Компания не найдена')

            if department_id:
                dept_stmt = select(Department).where(
                    Department.id == department_id,
                    Department.company_id == company_id
                )
                dept_result = await db.execute(dept_stmt)
                dept = dept_result.scalar_one_or_none()

                if not dept:
                    raise ValueError('Отдел не найден или не принадлежит этой компании')

            user = User(
                full_name=user_data['full_name'],
                email=user_data['email'],
                hashed_password=get_password_hash(user_data['password']),
                role='employee',
                is_active=True
            )
            db.add(user)
            await db.flush()

            employee_record = Employee(
                company_id=company_id,
                user_id=user.id,
                role='employee',
                hire_date=date.today(),
                is_active=True
            )
            db.add(employee_record)
            await db.flush()

            emp_dept_link = EmployeeDepartment(
                employee_id=employee_record.id,
                department_id=department_id
            )
            db.add(emp_dept_link)

            await db.commit()
            await db.refresh(user)

            return {'user': user, 'company': company}

        except IntegrityError as e:
            await db.rollback()
            if 'users.email' in str(e.orig) or 'ix_users_email' in str(e.orig):
                raise ValueError('Пользователь с таким email уже существует')
            raise ValueError(f'Ошибка базы данных: {str(e)}')