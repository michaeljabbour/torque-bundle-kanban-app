import {
  Stack, Text, Button, TextField, Spinner, Form, Badge, Divider, Icon,
  KanbanBoard, KanbanList, KanbanCard, FilterDropdown,
} from './ui-kit.js';

export default function BoardView({ data, actions }) {
  if (!data) return Spinner({});

  const snapshot = data[0] || {};
  const board = snapshot.board || {};
  const lists = Array.isArray(snapshot.lists) ? snapshot.lists : [];
  const cards = Array.isArray(snapshot.cards) ? snapshot.cards : [];
  const labels = Array.isArray(snapshot.labels) ? snapshot.labels : [];

  const boardId = actions.params?.boardId || board.id;
  const boardName = board.name || 'Board';

  // ── filter state (label filter) ──────────────────────────
  // The FilterDropdown emits an onChange with selected label IDs.
  // We store the filter in a closure; the runtime re-renders on actions.refresh().

  let activeLabelFilter = [];

  function setLabelFilter(selectedIds) {
    activeLabelFilter = selectedIds || [];
    actions.refresh();
  }

  // ── helpers ──────────────────────────────────────────────

  function labelsForCard(card) {
    const cardLabelIds = (card.card_labels || card.labels || []).map(cl => cl.label_id || cl.id);
    if (cardLabelIds.length === 0) return [];
    return labels.filter(l => cardLabelIds.includes(l.id));
  }

  function cardsInList(listId) {
    let listCards = cards.filter(c => c.list_id === listId);

    // Apply label filter
    if (activeLabelFilter.length > 0) {
      listCards = listCards.filter(c => {
        const cardLabelIds = (c.card_labels || c.labels || []).map(cl => cl.label_id || cl.id);
        return activeLabelFilter.some(id => cardLabelIds.includes(id));
      });
    }

    return listCards.sort((a, b) => a.pos - b.pos);
  }

  function checklistProgress(card) {
    const checklists = card.checklists || [];
    if (checklists.length === 0) return null;
    let total = 0;
    let done = 0;
    for (const cl of checklists) {
      const items = cl.checkitems || cl.items || [];
      total += items.length;
      done += items.filter(i => i.checked).length;
    }
    return total > 0 ? { done, total } : null;
  }

  function commentCount(card) {
    return card.comment_count || (card.comments || []).length || 0;
  }

  // ── mutations ───────────────────────────────────────────

  async function handleCardMove(cardId, fromListId, toListId) {
    await actions.api(`/api/cards/${cardId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toListId }),
    });
    actions.refresh();
  }

  async function handleAddCard(listId, name) {
    if (!name) return;
    await actions.api('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId, boardId, name }),
    });
    actions.refresh();
  }

  async function handleCreateList(e) {
    const name = e.target.elements.name?.value;
    if (!name) return;
    await actions.api(`/api/boards/${boardId}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    e.target.reset();
    actions.refresh();
  }

  // ── derived stats ───────────────────────────────────────

  const sortedLists = [...lists].sort((a, b) => a.pos - b.pos);
  const totalCards = cards.length;
  const doneListIds = lists
    .filter(l => /^(done|shipped|complete)$/i.test(l.name))
    .map(l => l.id);
  const doneCards = cards.filter(c => doneListIds.includes(c.list_id)).length;

  const now = new Date();
  const overdueCards = cards.filter(c =>
    c.due_date && new Date(c.due_date) < now && !c.due_complete
  ).length;

  // ── label filter options ────────────────────────────────

  const labelOptions = labels.map(l => ({
    id: l.id,
    label: l.name || l.color,
    color: l.color,
  }));

  // ── build descriptor tree ───────────────────────────────

  return Stack({ spacing: 0, sx: { height: '100%', display: 'flex', flexDirection: 'column' } }, [

    // ── Header bar ─────────────────────────────────────────
    Stack({ direction: 'row', spacing: 2, sx: { p: 2, alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 } }, [
      Button({ label: '\u2190 Back', variant: 'text', onClick: () => actions.navigate(-1) }),
      Text({ variant: 'h5', content: boardName }),
      Text({
        variant: 'body2',
        content: `${totalCards} cards \u00B7 ${doneCards} done${overdueCards > 0 ? ` \u00B7 ${overdueCards} overdue` : ''}`,
        sx: { color: 'text.secondary' },
      }),
      Stack({ sx: { flex: 1 } }, []),

      // Label filter
      labels.length > 0
        ? FilterDropdown({
            label: 'Filter by Label',
            options: labelOptions,
            onChange: setLabelFilter,
          })
        : null,

      Button({
        label: 'Dashboard',
        variant: 'outlined',
        size: 'small',
        onClick: () => actions.navigate(`/boards/${boardId}/report`),
      }),
      Button({
        label: 'Members',
        variant: 'outlined',
        size: 'small',
        onClick: () => actions.navigate(`/boards/${boardId}/members`),
      }),
    ]),

    // ── Kanban board ──────────────────────────────────────
    KanbanBoard({ onCardMove: handleCardMove }, [
      ...sortedLists.map(list =>
        KanbanList(
          {
            listId: list.id,
            title: list.name,
            cardCount: cardsInList(list.id).length,
            onAddCard: handleAddCard,
          },
          cardsInList(list.id).map(card => {
            const cardLabels = labelsForCard(card);
            const memberCount = (card.card_members || card.members || []).length;
            const clProgress = checklistProgress(card);
            const comments = commentCount(card);

            return KanbanCard({
              cardId: card.id,
              title: card.name,
              labels: cardLabels.map(l => ({
                name: l.name || '',
                color: l.color,
              })),
              memberCount,
              dueDate: card.due_date
                ? new Date(card.due_date).toLocaleDateString()
                : null,
              dueDone: !!card.due_complete,
              dueOverdue: card.due_date && new Date(card.due_date) < now && !card.due_complete,
              checklistProgress: clProgress
                ? `${clProgress.done}/${clProgress.total}`
                : null,
              commentCount: comments,
              onClick: () => actions.navigate(`/cards/${card.id}`),
            });
          })
        )
      ),

      // Add list column
      Stack({ sx: { minWidth: 280, maxWidth: 280, flexShrink: 0 } }, [
        Form({ onSubmit: handleCreateList }, [
          Stack({ spacing: 1, sx: { p: 1.5 } }, [
            TextField({ name: 'name', placeholder: 'Add list...', size: 'small' }),
            Button({
              label: '+ Add List',
              variant: 'contained',
              type: 'submit',
              size: 'small',
              fullWidth: true,
            }),
          ]),
        ]),
      ]),
    ]),
  ].filter(Boolean));
}
