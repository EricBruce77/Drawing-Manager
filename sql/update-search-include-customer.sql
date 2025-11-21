-- Migration: Update search_drawings function with advanced relevance ordering
-- This allows searching by customer name and prioritizes exact/partial matches

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
            CASE WHEN LOWER(COALESCE(c.name, '')) LIKE '%' || LOWER(search_query) || '%' THEN 25.0
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
            ts_rank(
                to_tsvector('english',
                    COALESCE(d.part_number, '') || ' ' ||
                    COALESCE(d.title, '') || ' ' ||
                    COALESCE(d.ai_description, '') || ' ' ||
                    COALESCE(d.description, '') || ' ' ||
                    COALESCE(c.name, '')
                ),
                plainto_tsquery('english', search_query)
            ) * 10.0  -- Scale FTS score
        ) as relevance
    FROM drawings d
    LEFT JOIN customers c ON d.customer_id = c.id
    WHERE
        d.status = 'active' AND
        (
            -- Match part number (case-insensitive)
            LOWER(d.part_number) LIKE '%' || LOWER(search_query) || '%'
            -- OR match title
            OR LOWER(COALESCE(d.title, '')) LIKE '%' || LOWER(search_query) || '%'
            -- OR match customer name
            OR LOWER(COALESCE(c.name, '')) LIKE '%' || LOWER(search_query) || '%'
            -- OR match descriptions
            OR LOWER(COALESCE(d.description, '')) LIKE '%' || LOWER(search_query) || '%'
            OR LOWER(COALESCE(d.ai_description, '')) LIKE '%' || LOWER(search_query) || '%'
            -- OR full-text search match
            OR to_tsvector('english',
                COALESCE(d.part_number, '') || ' ' ||
                COALESCE(d.title, '') || ' ' ||
                COALESCE(d.ai_description, '') || ' ' ||
                COALESCE(d.description, '') || ' ' ||
                COALESCE(c.name, '')
            ) @@ plainto_tsquery('english', search_query)
        )
    ORDER BY relevance DESC, d.created_at DESC;  -- Order by relevance first, then by date
END;
$$ LANGUAGE plpgsql;
