CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  logo_data TEXT,
  logo_mime_type VARCHAR(50),
  phone VARCHAR(20),
  wechat_qr_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE organization_classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  classroom_id VARCHAR(50) NOT NULL,
  share_token VARCHAR(20) UNIQUE NOT NULL,
  subject VARCHAR(50),
  grade VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_organization_classrooms_org ON organization_classrooms(organization_id);
CREATE INDEX idx_organization_classrooms_token ON organization_classrooms(share_token);

CREATE TABLE classroom_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_classroom_id UUID NOT NULL REFERENCES organization_classrooms(id),
  session_id VARCHAR(100) NOT NULL,
  completed BOOLEAN DEFAULT false,
  duration_seconds INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (organization_classroom_id, session_id)
);

CREATE INDEX idx_classroom_views_org_class ON classroom_views(organization_classroom_id);

CREATE TABLE classroom_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_classroom_id UUID NOT NULL REFERENCES organization_classrooms(id),
  phone VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (organization_classroom_id, phone)
);

CREATE INDEX idx_classroom_conversions_org_class ON classroom_conversions(organization_classroom_id);
