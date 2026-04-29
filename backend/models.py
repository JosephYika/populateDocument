"""
SQLAlchemy ORM models for the KG Construction client database.

Three entities with a hierarchy:
  ManagementCompany → PropertyManager → Client

Each model uses soft-delete via a 'status' column ('active' / 'archived')
rather than physical deletion, so historical estimate references remain valid.
All models include to_dict() for JSON serialization in the API layer.
"""

import os
from datetime import datetime, timezone
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Boolean,
    ForeignKey, DateTime, Index
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()


def utcnow():
    """Timezone-aware UTC timestamp for created_at / updated_at defaults."""
    return datetime.now(timezone.utc)


class ManagementCompany(Base):
    """A property management company that oversees one or more client properties."""
    __tablename__ = 'management_companies'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    default_email = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default='active')
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    managers = relationship('PropertyManager', back_populates='company')
    clients = relationship('Client', back_populates='company')

    __table_args__ = (
        Index('ix_company_name', 'name'),
        Index('ix_company_status', 'status'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'phone': self.phone,
            'default_email': self.default_email,
            'notes': self.notes,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class PropertyManager(Base):
    """A contact person at a management company who receives estimates."""
    __tablename__ = 'property_managers'

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey('management_companies.id'), nullable=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    role = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default='active')
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    company = relationship('ManagementCompany', back_populates='managers')
    clients = relationship('Client', back_populates='manager')

    __table_args__ = (
        Index('ix_manager_name', 'name'),
        Index('ix_manager_email', 'email'),
        Index('ix_manager_company', 'company_id'),
        Index('ix_manager_status', 'status'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'company_id': self.company_id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'role': self.role,
            'notes': self.notes,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Client(Base):
    """A property/client site where work is performed.

    Links to a default company and manager so the estimate form can
    auto-fill contact info when a client address is selected.
    """
    __tablename__ = 'clients'

    id = Column(Integer, primary_key=True)
    address = Column(String(500), nullable=False)
    unit = Column(String(50), nullable=True)
    building_name = Column(String(255), nullable=True)
    owner_name = Column(String(255), nullable=True)
    default_company_id = Column(Integer, ForeignKey('management_companies.id'), nullable=True)
    default_manager_id = Column(Integer, ForeignKey('property_managers.id'), nullable=True)
    # When True, estimate goes directly to the owner rather than through a manager.
    send_directly_to_client = Column(Boolean, nullable=False, default=False)
    client_email = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default='active')
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    company = relationship('ManagementCompany', back_populates='clients')
    manager = relationship('PropertyManager', back_populates='clients')

    __table_args__ = (
        Index('ix_client_address', 'address'),
        Index('ix_client_unit', 'unit'),
        Index('ix_client_building', 'building_name'),
        Index('ix_client_owner', 'owner_name'),
        Index('ix_client_company', 'default_company_id'),
        Index('ix_client_status', 'status'),
    )

    def to_dict(self, include_relations=True):
        """Serialize to dict. Nests company/manager data for cascading auto-fill."""
        d = {
            'id': self.id,
            'address': self.address,
            'unit': self.unit,
            'building_name': self.building_name,
            'owner_name': self.owner_name,
            'default_company_id': self.default_company_id,
            'default_manager_id': self.default_manager_id,
            'send_directly_to_client': self.send_directly_to_client,
            'client_email': self.client_email,
            'notes': self.notes,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_relations:
            d['company'] = self.company.to_dict() if self.company else None
            d['manager'] = self.manager.to_dict() if self.manager else None
        return d


# ── Database connection ─────────────────────────────────────────
# SQLite file lives alongside server.py. Session is imported by
# server.py and the import script to open short-lived connections.

DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'kg_construction.db')
DATABASE_URL = f'sqlite:///{DATABASE_PATH}'

engine = create_engine(DATABASE_URL, echo=False)
Session = sessionmaker(bind=engine)
