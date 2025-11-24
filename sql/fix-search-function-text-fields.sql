-- Fix search_drawings function to use customer_name and project_name (TEXT fields)
-- instead of customer_id/project_id foreign keys

DROP FUNCTION IF EXISTS search_drawings(TEXT);

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
        d.customer_name,
        -- Calculate relevance score with custom weights
        (
            -- Exact part number match gets highest score (100)
            CASE WHEN LOWER(d.part_number) = LOWER(search_query) THEN 100.0
            -- Partial part number match gets high score (50)
            WHEN LOWER(d.part_number) LIKE '%' || LOWER(search_query) || '%' THEN 50.0
            ELSE 0.0 END
            +
            -- Title match gets good score (30)
            CASE WHEN LOWER(COALESCE(d.title, '')) LIKE '%' || LOWER(search_query) || '%' THEN 30.0
            ELSE 0.0 END
            +
            -- Customer name match gets good score (25)
            CASE WHEN LOWER(COALESCE(d.customer_name, '')) LIKE '%' || LOWER(search_query) || '%' THEN 25.0
            ELSE 0.0 END
            +
            -- Project name match gets good score (25)
            CASE WHEN LOWER(COALESCE(d.project_name, '')) LIKE '%' || LOWER(search_query) || '%' THEN 25.0
            ELSE 0.0 END
            +
            -- Description match gets medium score (15)
            CASE WHEN LOWER(COALESCE(d.description, '')) LIKE '%' || LOWER(search_query) || '%' THEN 15.0
            ELSE 0.0 END
            +
            -- AI description match gets medium score (15)
            CASE WHEN LOWER(COALESCE(d.ai_description, '')) LIKE '%' || LOWER(search_query) || '%' THEN 15.0
            ELSE 0.0 END
            +
            -- Full-text search as fallback (weighted)
            COALESCE(ts_rank(
                to_tsvector('english',
                    COALESCE(d.part_number, '') || ' ' ||
                    COALESCE(d.title, '') || ' ' ||
                    COALESCE(d.ai_description, '') || ' ' ||
                    COALESCE(d.description, '') || ' ' ||
                    COALESCE(d.customer_name, '') || ' ' ||
                    COALESCE(d.project_name, '')
                ),
                plainto_tsquery('english', search_query)
            ), 0.0) * 10.0  -- Scale FTS score, handle NULL
        )::REAL as relevance
    FROM drawings d
    WHERE
        d.status = 'active' AND
        (
            -- Match part number (case-insensitive)
            LOWER(d.part_number) LIKE '%' || LOWER(search_query) || '%'
            -- OR match title
            OR LOWER(COALESCE(d.title, '')) LIKE '%' || LOWER(search_query) || '%'
            -- OR match customer name (TEXT field, not foreign key)
            OR LOWER(COALESCE(d.customer_name, '')) LIKE '%' || LOWER(search_query) || '%'
            -- OR match project name (TEXT field, not foreign key)
            OR LOWER(COALESCE(d.project_name, '')) LIKE '%' || LOWER(search_query) || '%'
            -- OR match descriptions
            OR LOWER(COALESCE(d.description, '')) LIKE '%' || LOWER(search_query) || '%'
            OR LOWER(COALESCE(d.ai_description, '')) LIKE '%' || LOWER(search_query) || '%'
            -- OR full-text search match
            OR to_tsvector('english',
                COALESCE(d.part_number, '') || ' ' ||
                COALESCE(d.title, '') || ' ' ||
                COALESCE(d.ai_description, '') || ' ' ||
                COALESCE(d.description, '') || ' ' ||
                COALESCE(d.customer_name, '') || ' ' ||
                COALESCE(d.project_name, '')
            ) @@ plainto_tsquery('english', search_query)
        )
    ORDER BY relevance DESC, d.created_at DESC;
END;
$$ LANGUAGE plpgsql;
