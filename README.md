# @torquedev/bundle-kanban-app

Consolidated Kanban application -- workspaces, boards, lists, cards, labels, and checklists.

## What It Provides

- **Workspaces** -- create, update, delete workspaces; manage members and invitations
- **Boards** -- per-workspace boards with visibility, background color, and member management
- **Board Snapshots** -- full board state in a single request (board, lists, cards, labels)
- **Lists** -- ordered lists within boards with reorder support
- **Cards** -- full card lifecycle with description, due dates, positioning, archiving, and move operations
- **Card Members** -- assign/remove users on individual cards
- **Labels** -- board-scoped labels with color; attach/detach from cards
- **Checklists & Check Items** -- nested checklists on cards with assignee and due date per item
- **UI Pages** -- workspace list, dashboard, board view, board members, board report, card detail

### API Routes

| Area | Endpoints |
|------|-----------|
| Workspaces | CRUD on `/api/workspaces`, members, invites, summary |
| Boards | CRUD on `/api/workspaces/:id/boards`, `/api/boards/:id`, member management |
| Snapshots | `GET /api/boards/:boardId/snapshot` |
| Lists | CRUD on `/api/boards/:id/lists`, reorder |
| Cards | CRUD on `/api/cards`, move, member and label assignment |
| Labels | CRUD on `/api/boards/:id/labels` |
| Checklists | Create/delete checklists, create/update check items |

### Cross-Bundle Interfaces

`getWorkspace`, `listUserWorkspaces`, `isMember`, `listByWorkspace`, `getBoard`, `authorizeBoardAccess`, `listBoardMembers`, `getCard`, `getBoardSnapshot`

## Installation

```
npm install @torquedev/bundle-kanban-app
```

Or as a git dependency in your mount plan:

```yaml
source: "git+https://github.com/torque-framework/torque-bundle-kanban-app.git@main"
```

## Usage

Add to your mount plan. No hard dependencies -- optionally integrates with the `iam` bundle for authentication.

## License

MIT -- see [LICENSE](./LICENSE)
