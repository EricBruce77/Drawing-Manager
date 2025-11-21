-- ARO Technologies Drawing Management System
-- Database Schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================
-- USERS & AUTHENTICATION
-- ====================================

-- User roles enum
CREATE TYPE user_role AS ENUM ('admin', 'engineer', 'viewer');

-- Extended user profiles table
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role DEFAULT 'viewer',
    department TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ====================================
-- CUSTOMERS & PROJECTS
-- ====================================

-- Customers table
CREATE TABLE customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    code TEXT UNIQUE, -- Optional customer code/abbreviation
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers" ON customers
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Engineers and admins can create customers" ON customers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('engineer', 'admin')
        )
    );

CREATE POLICY "Engineers and admins can update customers" ON customers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('engineer', 'admin')
        )
    );

-- Projects table (optional organizational level)
CREATE TABLE projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    project_number TEXT, -- e.g., "25179"
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view projects" ON projects
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Engineers and admins can create projects" ON projects
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('engineer', 'admin')
        )
    );

CREATE POLICY "Engineers and admins can update projects" ON projects
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('engineer', 'admin')
        )
    );

-- ====================================
-- DRAWINGS
-- ====================================

-- Drawing status enum
CREATE TYPE drawing_status AS ENUM ('processing', 'active', 'archived', 'failed');

-- Main drawings table
CREATE TABLE drawings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Identification
    part_number TEXT NOT NULL, -- e.g., "25179-001"
    revision TEXT DEFAULT 'A', -- Drawing revision
    title TEXT,

    -- Organization
    customer_id UUID REFERENCES customers(id),
    project_id UUID REFERENCES projects(id),

    -- File information
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'dwg', 'pdf', 'dxf', 'png', etc.
    file_size BIGINT, -- in bytes
    file_url TEXT NOT NULL, -- Supabase Storage URL
    thumbnail_url TEXT, -- Preview thumbnail

    -- AI Analysis
    ai_description TEXT, -- AI-generated description of drawing contents
    ai_tags TEXT[], -- AI-generated tags for searchability
    analyzed_at TIMESTAMPTZ,

    -- Metadata
    description TEXT,
    notes TEXT,
    status drawing_status DEFAULT 'active',

    -- Version control
    is_latest_version BOOLEAN DEFAULT true,
    parent_drawing_id UUID REFERENCES drawings(id), -- Link to previous version
    version_number INTEGER DEFAULT 1,

    -- Tracking
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster searches
CREATE INDEX idx_drawings_part_number ON drawings(part_number);
CREATE INDEX idx_drawings_customer ON drawings(customer_id);
CREATE INDEX idx_drawings_project ON drawings(project_id);
CREATE INDEX idx_drawings_status ON drawings(status);
CREATE INDEX idx_drawings_ai_description ON drawings USING gin(to_tsvector('english', ai_description));

ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active drawings" ON drawings
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND status = 'active'
    );

CREATE POLICY "Engineers and admins can upload drawings" ON drawings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('engineer', 'admin')
        )
    );

CREATE POLICY "Engineers and admins can update drawings" ON drawings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('engineer', 'admin')
        )
    );

CREATE POLICY "Admins can delete drawings" ON drawings
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ====================================
-- TAGS & CATEGORIZATION
-- ====================================

-- Tags table for manual categorization
CREATE TABLE tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#3b82f6', -- hex color for UI
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drawing-tag junction table
CREATE TABLE drawing_tags (
    drawing_id UUID REFERENCES drawings(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (drawing_id, tag_id)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tags" ON tags
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Engineers and admins can manage tags" ON tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('engineer', 'admin')
        )
    );

CREATE POLICY "Authenticated users can view drawing tags" ON drawing_tags
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Engineers and admins can manage drawing tags" ON drawing_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('engineer', 'admin')
        )
    );

-- ====================================
-- ACTIVITY LOG
-- ====================================

-- Activity types enum
CREATE TYPE activity_type AS ENUM (
    'upload',
    'download',
    'edit',
    'delete',
    'view',
    'share'
);

-- Activity log for audit trail
CREATE TABLE activity_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    drawing_id UUID REFERENCES drawings(id),
    activity activity_type NOT NULL,
    details JSONB, -- Additional context
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_drawing ON activity_log(drawing_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity" ON activity_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity" ON activity_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ====================================
-- FUNCTIONS & TRIGGERS
-- ====================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drawings_updated_at BEFORE UPDATE ON drawings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log activity automatically
CREATE OR REPLACE FUNCTION log_drawing_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_log (user_id, drawing_id, activity, details)
        VALUES (NEW.uploaded_by, NEW.id, 'upload', jsonb_build_object('file_name', NEW.file_name));
    ELSIF TG_OP = 'UPDATE' AND OLD.file_url != NEW.file_url THEN
        INSERT INTO activity_log (user_id, drawing_id, activity, details)
        VALUES (NEW.uploaded_by, NEW.id, 'edit', jsonb_build_object('old_version', OLD.version_number, 'new_version', NEW.version_number));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO activity_log (user_id, drawing_id, activity, details)
        VALUES (auth.uid(), OLD.id, 'delete', jsonb_build_object('file_name', OLD.file_name));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_drawing_activity_trigger
AFTER INSERT OR UPDATE OR DELETE ON drawings
FOR EACH ROW EXECUTE FUNCTION log_drawing_activity();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'viewer' -- Default role
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ====================================
-- SEARCH FUNCTION
-- ====================================

-- Full-text search function
CREATE OR REPLACE FUNCTION search_drawings(search_query TEXT)
RETURNS TABLE (
    id UUID,
    part_number TEXT,
    title TEXT,
    file_name TEXT,
    customer_name TEXT,
    relevance REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.part_number,
        d.title,
        d.file_name,
        c.name as customer_name,
        ts_rank(
            to_tsvector('english',
                COALESCE(d.part_number, '') || ' ' ||
                COALESCE(d.title, '') || ' ' ||
                COALESCE(d.ai_description, '') || ' ' ||
                COALESCE(d.description, '')
            ),
            plainto_tsquery('english', search_query)
        ) as relevance
    FROM drawings d
    LEFT JOIN customers c ON d.customer_id = c.id
    WHERE
        d.status = 'active' AND
        (
            to_tsvector('english',
                COALESCE(d.part_number, '') || ' ' ||
                COALESCE(d.title, '') || ' ' ||
                COALESCE(d.ai_description, '') || ' ' ||
                COALESCE(d.description, '')
            ) @@ plainto_tsquery('english', search_query)
            OR d.part_number ILIKE '%' || search_query || '%'
        )
    ORDER BY relevance DESC;
END;
$$ LANGUAGE plpgsql;