// @trachex/storage-sqlite
//
// Phase 1 implements the domain repository contract over SQLite here:
// connection manager (WAL, foreign keys, busy timeout), versioned migrations,
// repositories for every domain aggregate, FTS5 indexing, and archive
// export/import. SQLite-specific types never leak into @trachex/domain.
