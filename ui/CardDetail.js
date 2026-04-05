import {
  Stack, Text, TextField, Button, Badge, Divider, Spinner, Form,
  InlineEdit, ProgressBar, Avatar, AvatarStack, Icon, Checklist, CardModal,
} from './ui-kit.js';

export default function CardDetail({ data, actions }) {
  if (!data) return Spinner({});

  const card = data[0] || (Array.isArray(data) ? data : {});
  const cardActions = Array.isArray(data[1]) ? data[1] : [];
  const checklists = card.checklists || [];
  const cardLabels = card.labels || [];
  const members = card.members || [];

  // ── helpers ──────────────────────────────────────────────

  function api(url, opts) {
    return actions.api(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...opts?.headers },
    });
  }

  async function updateField(field, value) {
    await api(`/api/cards/${card.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value }),
    });
    actions.refresh();
  }

  // ── label mutations ──────────────────────────────────────

  async function detachLabel(labelId) {
    await api(`/api/cards/${card.id}/labels/${labelId}`, { method: 'DELETE' });
    actions.refresh();
  }

  async function createAndAttachLabel(e) {
    const name = e.target.elements.labelName?.value;
    const color = e.target.elements.labelColor?.value || 'blue';
    if (!name) return;
    const newLabel = await api(`/api/boards/${card.board_id}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
    const labelId = newLabel?.id || newLabel?.label_id;
    if (labelId) {
      await api(`/api/cards/${card.id}/labels/${labelId}`, { method: 'POST' });
    }
    e.target.reset();
    actions.refresh();
  }

  // ── member mutations ─────────────────────────────────────

  async function addMember(e) {
    const userId = e.target.elements.userId?.value;
    if (!userId) return;
    await api(`/api/cards/${card.id}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    e.target.reset();
    actions.refresh();
  }

  async function removeMember(userId) {
    await api(`/api/cards/${card.id}/members/${userId}`, { method: 'DELETE' });
    actions.refresh();
  }

  // ── checklist mutations ──────────────────────────────────

  async function addChecklist(e) {
    const name = e.target.elements.checklistName?.value;
    if (!name) return;
    await api(`/api/cards/${card.id}/checklists`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    e.target.reset();
    actions.refresh();
  }

  async function deleteChecklist(checklistId) {
    await api(`/api/checklists/${checklistId}`, { method: 'DELETE' });
    actions.refresh();
  }

  async function addCheckitem(checklistId, e) {
    const name = e.target.elements.itemName?.value;
    if (!name) return;
    await api(`/api/checklists/${checklistId}/checkitems`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    e.target.reset();
    actions.refresh();
  }

  async function toggleCheckitem(itemId, currentChecked) {
    await api(`/api/checkitems/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ checked: !currentChecked }),
    });
    actions.refresh();
  }

  async function deleteCheckitem(itemId) {
    await api(`/api/checkitems/${itemId}`, { method: 'DELETE' });
    actions.refresh();
  }

  // ── comment mutations ────────────────────────────────────

  async function addComment(e) {
    const text = e.target.elements.text?.value;
    if (!text) return;
    await api(`/api/cards/${card.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    e.target.reset();
    actions.refresh();
  }

  async function deleteComment(commentId) {
    await api(`/api/comments/${commentId}`, { method: 'DELETE' });
    actions.refresh();
  }

  // ── due-date helpers ─────────────────────────────────────

  async function setDueDate(e) {
    const value = e.target.elements.dueDate?.value;
    if (!value) return;
    await updateField('due_date', value);
  }

  async function toggleDueComplete() {
    await updateField('due_complete', !card.due_complete);
  }

  // ── parse comment data ───────────────────────────────────

  function parseActionText(a) {
    if (!a.data) return '';
    try {
      return typeof a.data === 'string' ? JSON.parse(a.data).text : (a.data.text || '');
    } catch {
      return String(a.data);
    }
  }

  // ── split actions ────────────────────────────────────────

  const comments = cardActions.filter(a => a.type === 'comment.added');
  const activity = cardActions.filter(a => a.type !== 'comment.added');

  // ── due date status ──────────────────────────────────────

  const now = new Date();
  const isOverdue = card.due_date && new Date(card.due_date) < now && !card.due_complete;

  // ── build descriptor tree ────────────────────────────────

  return CardModal({ title: card.name, onClose: () => actions.navigate(-1) }, [
    Stack({ direction: 'row', spacing: 3, sx: { p: 2 } }, [

      // ── Main content column ─────────────────────────────
      Stack({ spacing: 2, sx: { flex: 1 } }, [

        // Card name (inline editable)
        InlineEdit({
          value: card.name,
          onSave: (v) => updateField('name', v),
          variant: 'h5',
        }),

        // Labels
        Stack({ spacing: 1 }, [
          Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
            Icon({ name: 'label', size: 'small' }),
            Text({ variant: 'subtitle2', content: 'Labels' }),
          ]),
          cardLabels.length > 0
            ? Stack({ direction: 'row', spacing: 1, sx: { flexWrap: 'wrap' } },
                cardLabels.map(l =>
                  Stack({ direction: 'row', spacing: 0.5, sx: { alignItems: 'center' } }, [
                    Badge({ text: l.name || 'label', color: l.color || 'primary' }),
                    Button({
                      label: '\u00D7',
                      variant: 'text',
                      size: 'small',
                      sx: { minWidth: 'auto', p: 0, fontSize: '0.8rem' },
                      onClick: () => detachLabel(l.label_id || l.id),
                    }),
                  ])
                )
              )
            : Text({ variant: 'body2', content: 'No labels', sx: { color: 'text.secondary' } }),
          Form({ onSubmit: createAndAttachLabel }, [
            Stack({ spacing: 1 }, [
              Stack({ direction: 'row', spacing: 0.5, sx: { flexWrap: 'wrap' } }, [
                ...['red', 'blue', 'green', 'orange', 'purple'].map(c =>
                  Button({
                    label: c,
                    variant: 'outlined',
                    size: 'small',
                    sx: { minWidth: 'auto', px: 1, bgcolor: c, color: '#fff', border: 'none', fontSize: '0.7rem' },
                    onClick: (e) => {
                      const form = e.target.closest('form');
                      if (form) form.elements.labelColor.value = c;
                    },
                  })
                ),
              ]),
              Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
                TextField({ name: 'labelName', placeholder: 'Label name', size: 'small' }),
                TextField({ name: 'labelColor', placeholder: 'Color', size: 'small', defaultValue: 'blue', sx: { width: 80 } }),
                Button({ label: 'Add Label', variant: 'contained', type: 'submit', size: 'small' }),
              ]),
            ]),
          ]),
        ]),

        Divider({}),

        // Description
        Stack({ spacing: 1 }, [
          Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
            Icon({ name: 'description', size: 'small' }),
            Text({ variant: 'subtitle2', content: 'Description' }),
          ]),
          InlineEdit({
            value: card.description || '',
            onSave: (v) => updateField('description', v),
            variant: 'body1',
            placeholder: 'Click to add description...',
            multiline: true,
          }),
        ]),

        Divider({}),

        // Checklists
        Stack({ spacing: 2 }, [
          Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
            Icon({ name: 'checklist', size: 'small' }),
            Text({ variant: 'subtitle2', content: 'Checklists' }),
          ]),

          ...checklists.map(cl => {
            const items = cl.checkitems || cl.items || [];
            const doneCount = items.filter(i => i.checked).length;
            const totalCount = items.length;

            return Checklist({
              title: cl.name,
              progress: { done: doneCount, total: totalCount },
              onDelete: () => deleteChecklist(cl.id),
            }, [
              Stack({ spacing: 0.5 }, [
                ProgressBar({ value: doneCount, max: totalCount || 1, label: `${doneCount}/${totalCount}` }),

                ...items.map(item =>
                  Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
                    Button({
                      label: item.checked ? '\u2611' : '\u2610',
                      variant: 'text',
                      size: 'small',
                      sx: { minWidth: 'auto', p: 0 },
                      onClick: () => toggleCheckitem(item.id, item.checked),
                    }),
                    Text({
                      content: item.name,
                      variant: 'body2',
                      sx: item.checked
                        ? { textDecoration: 'line-through', color: 'text.secondary' }
                        : {},
                    }),
                    Button({
                      label: '\u00D7',
                      variant: 'text',
                      size: 'small',
                      sx: { minWidth: 'auto', p: 0, color: 'error.main' },
                      onClick: () => deleteCheckitem(item.id),
                    }),
                  ])
                ),

                Form({ onSubmit: (e) => addCheckitem(cl.id, e) }, [
                  Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center', mt: 0.5 } }, [
                    TextField({ name: 'itemName', placeholder: 'Add an item...', size: 'small', sx: { flex: 1 } }),
                    Button({ label: 'Add', variant: 'contained', type: 'submit', size: 'small' }),
                  ]),
                ]),
              ]),
            ]);
          }),

          Form({ onSubmit: addChecklist }, [
            Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
              TextField({ name: 'checklistName', placeholder: 'New checklist name...', size: 'small', sx: { flex: 1 } }),
              Button({ label: 'Add Checklist', variant: 'contained', type: 'submit', size: 'small' }),
            ]),
          ]),
        ]),

        Divider({}),

        // Comments
        Stack({ spacing: 2 }, [
          Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
            Icon({ name: 'comment', size: 'small' }),
            Text({ variant: 'subtitle2', content: 'Comments' }),
          ]),

          Form({ onSubmit: addComment }, [
            Stack({ spacing: 1 }, [
              TextField({ name: 'text', placeholder: 'Write a comment...', multiline: true, size: 'small' }),
              Button({ label: 'Comment', variant: 'contained', type: 'submit', size: 'small' }),
            ]),
          ]),

          ...comments.map(a => {
            const commentText = parseActionText(a);
            return Stack({
              spacing: 0.5,
              sx: { pl: 1.5, borderLeft: '3px solid', borderColor: 'divider', mb: 1 },
            }, [
              Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
                Avatar({ name: a.user_name || 'User', size: 'small' }),
                Text({
                  variant: 'caption',
                  content: new Date(a.created_at).toLocaleString(),
                  sx: { color: 'text.secondary' },
                }),
              ]),
              Text({ variant: 'body2', content: commentText }),
              Button({
                label: 'Delete',
                variant: 'text',
                size: 'small',
                sx: { color: 'error.main', alignSelf: 'flex-start' },
                onClick: () => deleteComment(a.id),
              }),
            ]);
          }),
        ]),

        Divider({}),

        // Activity log
        Stack({ spacing: 1 }, [
          Text({ variant: 'subtitle2', content: 'Activity' }),
          activity.length > 0
            ? Stack({ spacing: 0.5 },
                activity.map(a =>
                  Stack({
                    spacing: 0.5,
                    sx: { pl: 1, borderLeft: '2px solid', borderColor: 'divider', mb: 0.5 },
                  }, [
                    Text({
                      variant: 'caption',
                      content: `${a.type} \u2014 ${new Date(a.created_at).toLocaleString()}`,
                      sx: { color: 'text.secondary' },
                    }),
                  ])
                )
              )
            : Text({ variant: 'body2', content: 'No activity yet', sx: { color: 'text.secondary' } }),
        ]),
      ]),

      // ── Sidebar column ──────────────────────────────────
      Stack({ spacing: 2, sx: { minWidth: 200, maxWidth: 240 } }, [

        // Due date
        Stack({ spacing: 1 }, [
          Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
            Icon({ name: 'calendar', size: 'small' }),
            Text({ variant: 'subtitle2', content: 'Due Date' }),
          ]),
          card.due_date
            ? Stack({ spacing: 0.5 }, [
                Badge({
                  text: new Date(card.due_date).toLocaleDateString(),
                  color: card.due_complete ? 'success' : (isOverdue ? 'error' : 'warning'),
                }),
                Button({
                  label: card.due_complete ? 'Mark incomplete' : 'Mark complete',
                  variant: 'text',
                  size: 'small',
                  onClick: toggleDueComplete,
                }),
              ])
            : Text({ variant: 'body2', content: 'No due date', sx: { color: 'text.secondary' } }),
          Form({ onSubmit: setDueDate }, [
            Stack({ spacing: 0.5 }, [
              TextField({ name: 'dueDate', type: 'date', size: 'small', fullWidth: true }),
              Button({ label: 'Set Date', variant: 'contained', type: 'submit', size: 'small', fullWidth: true }),
            ]),
          ]),
        ]),

        Divider({}),

        // Assignees
        Stack({ spacing: 1 }, [
          Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
            Icon({ name: 'people', size: 'small' }),
            Text({ variant: 'subtitle2', content: 'Assignees' }),
          ]),
          members.length > 0
            ? Stack({ spacing: 0.5 }, [
                AvatarStack({
                  users: members.map(m => ({
                    name: m.name || m.username || m.user_name || m.id,
                  })),
                }),
                ...members.map(m =>
                  Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center', justifyContent: 'space-between' } }, [
                    Text({
                      variant: 'body2',
                      content: m.name || m.username || m.user_name || m.id,
                      sx: { fontSize: '0.85rem' },
                    }),
                    Button({
                      label: '\u00D7',
                      variant: 'text',
                      size: 'small',
                      sx: { minWidth: 'auto', p: 0, color: 'error.main' },
                      onClick: () => removeMember(m.id || m.user_id),
                    }),
                  ])
                ),
              ])
            : Text({ variant: 'body2', content: 'No assignees', sx: { color: 'text.secondary' } }),
          Form({ onSubmit: addMember }, [
            Stack({ spacing: 0.5 }, [
              TextField({ name: 'userId', placeholder: 'User ID', size: 'small', fullWidth: true }),
              Button({ label: 'Add Member', variant: 'outlined', type: 'submit', size: 'small', fullWidth: true }),
            ]),
          ]),
        ]),

        Divider({}),

        // Quick actions
        Stack({ spacing: 1 }, [
          Text({ variant: 'subtitle2', content: 'Actions' }),
          Button({
            label: 'Go to Board',
            variant: 'outlined',
            size: 'small',
            fullWidth: true,
            onClick: () => actions.navigate(`/boards/${card.board_id}`),
          }),
          Button({
            label: card.archived ? 'Unarchive' : 'Archive',
            variant: 'outlined',
            size: 'small',
            color: 'error',
            fullWidth: true,
            onClick: () => updateField('archived', card.archived ? 0 : 1),
          }),
        ]),
      ]),
    ]),
  ].filter(Boolean));
}
