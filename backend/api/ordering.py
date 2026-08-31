"""
Shared list ordering — LAURA.

One rule, applied at the data layer: every list in the project comes back
newest-first (creation date descending). Lists must not each invent their own
order, and components must not re-sort what the API already ordered.

Use `newest_first(query, Model)` on any query that feeds a list. Where a list
offers the user an explicit sort (the folder page's Newest / Budget, the Past
Campaigns sort menu), newest-first is the DEFAULT branch, not the only one.

Threads are the one exception, and `thread_order` handles it: comment *threads*
are newest-first, but replies inside a thread stay chronological — otherwise a
reply renders above the comment it answers.
"""

from sqlalchemy import desc, asc


def created_col(model):
    """
    The column that means "when did this row come into existence".

    Models disagree on the name (`created_at`, `imported_at`, `sent_at`), so
    resolve it once here rather than at every call site.
    """
    for name in ("created_at", "imported_at", "sent_at", "submitted_at"):
        col = getattr(model, name, None)
        if col is not None:
            return col
    raise AttributeError(f"{model.__name__} has no creation-date column")


def newest_first(query, model, *tiebreakers):
    """
    Order a query newest-first.

    `nullslast()` keeps rows with no creation date (legacy imports) at the
    bottom instead of letting Postgres float them to the top. `id` is the final
    tiebreaker so pagination stays stable when timestamps collide — bulk imports
    stamp hundreds of rows in the same second.
    """
    col = created_col(model)
    order = [desc(col).nullslast(), *tiebreakers]
    pk = getattr(model, "id", None)
    if pk is not None:
        order.append(desc(pk))
    return query.order_by(*order)


def thread_order(query, model, root_col="parent_comment_id"):
    """
    Order comments so threads read correctly: newest thread at the top, replies
    inside each thread in the order they were written.

    The group key is the ROOT comment's timestamp, resolved through a correlated
    subquery on the parent. Grouping on `COALESCE(parent_id, id)` looks simpler
    but is wrong here — ids are UUIDs, so it sorts threads at random rather than
    by date.
    """
    from sqlalchemy import func as sql_func, select
    from sqlalchemy.orm import aliased

    col = created_col(model)
    parent = getattr(model, root_col, None)
    pk = getattr(model, "id", None)
    if parent is None or pk is None:
        return newest_first(query, model)

    root = aliased(model)
    root_created = (
        select(created_col(root))
        .where(root.id == parent)
        .correlate(model)
        .scalar_subquery()
    )
    # Root's date orders the threads; the comment's own date orders within one.
    group = sql_func.coalesce(root_created, col)
    return query.order_by(desc(group).nullslast(), asc(col), asc(pk))


def sort_newest_first(rows, *, key="created_at"):
    """
    In-memory fallback for lists assembled in Python rather than SQL (grouped
    dicts, merged sources). Prefer `newest_first` on the query where possible.
    """
    def sort_key(row):
        val = row.get(key) if isinstance(row, dict) else getattr(row, key, None)
        return (val is not None, val)
    return sorted(rows, key=sort_key, reverse=True)
