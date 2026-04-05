import {
  Stack, Grid, Text, TextField, Button, Form, Icon, Spinner, Alert, Divider,
  WorkspaceCard, BoardCard, ProgressBar,
} from './ui-kit.js';

export default function WorkspaceList({ data, actions }) {
  if (!data) return Spinner({});

  const workspaces = Array.isArray(data[0]) ? data[0] : (Array.isArray(data) ? data : []);

  // ── helpers ──────────────────────────────────────────────

  function api(url, opts) {
    return actions.api(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...opts?.headers },
    });
  }

  async function createWorkspace(e) {
    const name = e.target.elements.name?.value;
    const description = e.target.elements.description?.value;
    if (!name) return;
    await api('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
    e.target.reset();
    actions.refresh();
  }

  async function createBoard(workspaceId, e) {
    const name = e.target.elements.boardName?.value;
    if (!name) return;
    await api(`/api/workspaces/${workspaceId}/boards`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    e.target.reset();
    actions.refresh();
  }

  // ── per-workspace board data ────────────────────────────
  // data[0] contains workspaces; each workspace may already include boards
  // from the API, or we render them from ws.boards if present.

  function boardsForWorkspace(ws) {
    return Array.isArray(ws.boards) ? ws.boards : [];
  }

  function workspaceProgress(ws) {
    if (ws.totalCards > 0) return Math.round((ws.doneCards / ws.totalCards) * 100);
    const boards = boardsForWorkspace(ws);
    if (boards.length === 0) return 0;
    const totalCards = boards.reduce((s, b) => s + (b.cardCount || b.card_count || 0), 0);
    const doneCards = boards.reduce((s, b) => s + (b.doneCount || b.done_count || 0), 0);
    return totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0;
  }

  // ── build descriptor tree ───────────────────────────────

  return Stack({ spacing: 3, sx: { p: 2, maxWidth: 1100, mx: 'auto' } }, [

    // Header
    Stack({ direction: 'row', spacing: 2, sx: { alignItems: 'center', justifyContent: 'space-between' } }, [
      Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
        Icon({ name: 'folder', sx: { color: 'primary.main' } }),
        Text({ variant: 'h4', content: 'Workspaces' }),
      ]),
      Text({
        variant: 'body2',
        content: `${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}`,
        sx: { color: 'text.secondary' },
      }),
    ]),

    // Create workspace form
    Form({ onSubmit: createWorkspace }, [
      Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'flex-end' } }, [
        TextField({ name: 'name', placeholder: 'New workspace name', size: 'small', sx: { flex: 1 } }),
        TextField({ name: 'description', placeholder: 'Description (optional)', size: 'small', sx: { flex: 1 } }),
        Button({ label: 'New Workspace', variant: 'contained', type: 'submit', size: 'small' }),
      ]),
    ]),

    Divider(),

    // Workspace list
    workspaces.length > 0
      ? Stack({ spacing: 3 },
          workspaces.map(ws => {
            const boards = boardsForWorkspace(ws);
            const progress = workspaceProgress(ws);
            const memberCount = ws.member_count || ws.memberCount || 0;

            return WorkspaceCard({
              sx: { p: 0 },
              onClick: () => actions.navigate(`/workspaces/${ws.id}/boards`),
            }, [
              Stack({ spacing: 2, sx: { p: 2 } }, [

                // Workspace header
                Stack({ direction: 'row', spacing: 2, sx: { alignItems: 'center', justifyContent: 'space-between' } }, [
                  Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
                    Text({ variant: 'h5', content: ws.emoji || '\uD83D\uDCC1' }),
                    Text({ variant: 'h6', content: ws.name, sx: { fontWeight: 600 } }),
                  ]),
                  Stack({ direction: 'row', spacing: 2, sx: { alignItems: 'center' } }, [
                    Text({
                      variant: 'caption',
                      content: `${memberCount} member${memberCount !== 1 ? 's' : ''}`,
                      sx: { color: 'text.secondary' },
                    }),
                    Text({
                      variant: 'caption',
                      content: `${boards.length} board${boards.length !== 1 ? 's' : ''}`,
                      sx: { color: 'text.secondary' },
                    }),
                  ]),
                ]),

                // Description
                ws.description
                  ? Text({ variant: 'body2', content: ws.description, sx: { color: 'text.secondary' } })
                  : null,

                // Progress bar
                progress > 0
                  ? ProgressBar({ value: progress, max: 100, label: `${progress}% complete` })
                  : null,

                // Boards grid
                boards.length > 0
                  ? Grid({ columns: 'repeat(auto-fill, minmax(260px, 1fr))', spacing: 1.5 },
                      boards.map(board => {
                        const cardCount = board.cardCount || board.card_count || 0;
                        const doneCount = board.doneCount || board.done_count || 0;
                        const boardProgress = cardCount > 0 ? Math.round((doneCount / cardCount) * 100) : 0;

                        return BoardCard({
                          sx: {
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                            transition: 'background-color 0.15s',
                          },
                          onClick: (e) => {
                            e.stopPropagation();
                            actions.navigate(`/boards/${board.id}`);
                          },
                        }, [
                          Stack({ spacing: 1 }, [
                            Text({ variant: 'subtitle1', content: board.name, sx: { fontWeight: 600 } }),
                            Stack({ direction: 'row', spacing: 2, sx: { alignItems: 'center' } }, [
                              Text({
                                variant: 'caption',
                                content: `${cardCount} card${cardCount !== 1 ? 's' : ''}`,
                                sx: { color: 'text.secondary' },
                              }),
                              Text({
                                variant: 'caption',
                                content: `${doneCount} done`,
                                sx: { color: 'text.secondary' },
                              }),
                            ]),
                            ProgressBar({ value: doneCount, max: cardCount || 1, label: `${boardProgress}%` }),
                          ]),
                        ]);
                      })
                    )
                  : Text({ variant: 'body2', content: 'No boards yet', sx: { color: 'text.secondary' } }),

                // Add board form (inline)
                Form({ onSubmit: (e) => { e.stopPropagation(); createBoard(ws.id, e); } }, [
                  Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
                    TextField({ name: 'boardName', placeholder: 'New board name', size: 'small', sx: { flex: 1 } }),
                    Button({ label: 'New Board', variant: 'outlined', type: 'submit', size: 'small' }),
                  ]),
                ]),

              ]),
            ]);
          })
        )
      : Alert({ severity: 'info', content: 'No workspaces yet. Create one above.' }),

  ].filter(Boolean));
}
