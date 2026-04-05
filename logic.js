const POS_GAP = 65536;

export default class KanbanApp {
  constructor({ data, events, config, coordinator }) {
    this.data = data;
    this.events = events;
    this.config = config;
    this.coordinator = coordinator;
  }

  // ── Helpers ──────────────────────────────────────────────

  _nextPos(table, filters) {
    const items = this.data.query(table, filters, { order: 'pos DESC', limit: 1 });
    return items.length > 0 ? items[0].pos + POS_GAP : POS_GAP;
  }

  async _enrichCard(card) {
    if (!card) return null;

    // Members — internal query, resolve names via iam (optional dep)
    const rawMembers = this.data.query('card_members', { card_id: card.id });
    const members = [];
    for (const m of rawMembers) {
      let name = m.user_id;
      let email = '';
      try {
        const user = await this.coordinator.call('iam', 'getUser', { userId: m.user_id });
        if (user) { name = user.name || user.email; email = user.email || ''; }
      } catch { /* iam not available */ }
      members.push({ ...m, name, email });
    }

    // Labels — internal query (same bundle)
    const cardLabels = this.data.query('card_labels', { card_id: card.id });
    const labels = cardLabels.map((cl) => this.data.find('labels', cl.label_id)).filter(Boolean);

    // Checklists + checkitems — internal query (same bundle)
    const checklists = this.data.query('checklists', { card_id: card.id }, { order: 'pos ASC' });
    const enrichedChecklists = checklists.map((cl) => ({
      ...cl,
      checkitems: this.data.query('checkitems', { checklist_id: cl.id }, { order: 'pos ASC' }),
    }));

    return { ...card, members, labels, checklists: enrichedChecklists };
  }

  // ── Interfaces ───────────────────────────────────────────

  interfaces() {
    return {
      // Workspace interfaces
      getWorkspace: ({ workspaceId }) => this.data.find('workspaces', workspaceId),

      listUserWorkspaces: ({ userId }) => {
        const memberships = this.data.query('workspace_memberships', { user_id: userId });
        return memberships
          .map((m) => {
            const w = this.data.find('workspaces', m.workspace_id);
            if (!w || w.status !== 'active') return null;
            return { id: w.id, name: w.name, role: m.role };
          })
          .filter(Boolean);
      },

      isMember: ({ workspaceId, userId }) => {
        const memberships = this.data.query('workspace_memberships', {
          workspace_id: workspaceId,
          user_id: userId,
        });
        return memberships.length > 0;
      },

      // Board interfaces
      getBoard: ({ boardId }) => this.data.find('boards', boardId),

      listByWorkspace: ({ workspaceId }) => {
        return this.data.query('boards', { workspace_id: workspaceId, status: 'active' });
      },

      authorizeBoardAccess: ({ boardId, userId }) => {
        const memberships = this.data.query('board_memberships', {
          board_id: boardId,
          user_id: userId,
        });
        return memberships.length > 0;
      },

      listBoardMembers: ({ boardId }) => {
        return this.data.query('board_memberships', { board_id: boardId });
      },

      // Kanban interfaces
      getCard: async ({ cardId }) => {
        const card = this.data.find('cards', cardId);
        return await this._enrichCard(card);
      },

      getBoardSnapshot: async ({ boardId }) => {
        const board = this.data.find('boards', boardId);
        const lists = this.data.query('lists', { board_id: boardId, archived: 0 }, { order: 'pos ASC' });
        const rawCards = this.data.query('cards', { board_id: boardId, archived: 0 }, { order: 'pos ASC' });
        const cards = [];
        for (const card of rawCards) {
          cards.push(await this._enrichCard(card));
        }
        const labels = this.data.query('labels', { board_id: boardId });
        return { board, lists, cards, labels };
      },
    };
  }

  // ── Routes ───────────────────────────────────────────────

  routes() {
    return {
      // ── Workspaces ─────────────────────────────────────

      list: (ctx) => {
        const userId = ctx.currentUser.id;
        const memberships = this.data.query('workspace_memberships', { user_id: userId });
        const workspaces = memberships
          .map((m) => {
            const w = this.data.find('workspaces', m.workspace_id);
            if (!w || w.status !== 'active') return null;
            return w;
          })
          .filter(Boolean);
        return { status: 200, data: workspaces };
      },

      // Workspace summary with board counts, card counts, member counts
      workspaceSummary: (ctx) => {
        const userId = ctx.currentUser.id;
        const memberships = this.data.query('workspace_memberships', { user_id: userId });
        const workspaces = memberships
          .map((m) => {
            const w = this.data.find('workspaces', m.workspace_id);
            if (!w || w.status !== 'active') return null;
            const boards = this.data.query('boards', { workspace_id: w.id, status: 'active' });
            const members = this.data.query('workspace_memberships', { workspace_id: w.id });
            let totalCards = 0, doneCards = 0;
            const boardSummaries = boards.map(b => {
              const cards = this.data.query('cards', { board_id: b.id, archived: 0 });
              const lists = this.data.query('lists', { board_id: b.id, archived: 0 });
              const doneLists = lists.filter(l => /done/i.test(l.name));
              const doneCardCount = doneLists.reduce((s, l) => s + cards.filter(c => c.list_id === l.id).length, 0);
              totalCards += cards.length;
              doneCards += doneCardCount;
              return { ...b, cardCount: cards.length, doneCount: doneCardCount, listCount: lists.length };
            });
            return { ...w, boards: boardSummaries, memberCount: members.length, totalCards, doneCards };
          })
          .filter(Boolean);
        return { status: 200, data: workspaces };
      },

      create: (ctx) => {
        const { name, description } = ctx.body;

        const workspace = this.data.insert('workspaces', {
          name,
          description: description || '',
          owner_id: ctx.currentUser.id,
          status: 'active',
        });

        this.data.insert('workspace_memberships', {
          workspace_id: workspace.id,
          user_id: ctx.currentUser.id,
          role: 'admin',
        });

        this.events.publish('kanban-app.workspace.created', {
          workspace_id: workspace.id,
          name: workspace.name,
          owner_id: ctx.currentUser.id,
        }, { publisher: 'kanban-app' });

        return { status: 201, data: workspace };
      },

      show: (ctx) => {
        const workspace = this.data.find('workspaces', ctx.params.workspaceId);
        if (!workspace || workspace.status === 'archived') {
          return { status: 404, data: { error: 'Workspace not found' } };
        }
        return { status: 200, data: workspace };
      },

      update: (ctx) => {
        const workspace = this.data.find('workspaces', ctx.params.workspaceId);
        if (!workspace || workspace.status === 'archived') {
          return { status: 404, data: { error: 'Workspace not found' } };
        }
        const updated = this.data.update('workspaces', workspace.id, ctx.body);
        return { status: 200, data: updated };
      },

      remove: (ctx) => {
        const workspace = this.data.find('workspaces', ctx.params.workspaceId);
        if (!workspace) return { status: 404, data: { error: 'Workspace not found' } };
        const archived = this.data.update('workspaces', workspace.id, { status: 'archived' });
        return { status: 200, data: archived };
      },

      listMembers: (ctx) => {
        const memberships = this.data.query('workspace_memberships', {
          workspace_id: ctx.params.workspaceId,
        });
        return { status: 200, data: memberships };
      },

      invite: (ctx) => {
        const { email } = ctx.body;

        const invite = this.data.insert('workspace_invites', {
          workspace_id: ctx.params.workspaceId,
          email,
          invited_by: ctx.currentUser.id,
          status: 'pending',
        });

        this.events.publish('kanban-app.member.invited', {
          workspace_id: ctx.params.workspaceId,
          email,
          invited_by: ctx.currentUser.id,
        }, { publisher: 'kanban-app' });

        return { status: 201, data: invite };
      },

      // ── Boards ─────────────────────────────────────────

      listByWorkspace: (ctx) => {
        const boards = this.data.query('boards', {
          workspace_id: ctx.params.workspaceId,
          status: 'active',
        });
        return { status: 200, data: boards };
      },

      createBoard: (ctx) => {
        const { name, description, visibility, background } = ctx.body;

        const board = this.data.insert('boards', {
          workspace_id: ctx.params.workspaceId,
          name,
          description: description || '',
          visibility: visibility || 'workspace',
          background: background || '#0079BF',
          status: 'active',
        });

        this.data.insert('board_memberships', {
          board_id: board.id,
          user_id: ctx.currentUser.id,
          role: 'admin',
        });

        this.events.publish('kanban-app.board.created', {
          board_id: board.id,
          workspace_id: ctx.params.workspaceId,
          name: board.name,
        }, { publisher: 'kanban-app' });

        return { status: 201, data: board };
      },

      showBoard: (ctx) => {
        const board = this.data.find('boards', ctx.params.boardId);
        if (!board || board.status !== 'active') {
          return { status: 404, data: { error: 'Board not found' } };
        }
        return { status: 200, data: board };
      },

      updateBoard: (ctx) => {
        const board = this.data.find('boards', ctx.params.boardId);
        if (!board || board.status !== 'active') {
          return { status: 404, data: { error: 'Board not found' } };
        }
        const updated = this.data.update('boards', board.id, ctx.body);
        this.events.publish('kanban-app.board.updated', {
          board_id: board.id,
          changes: ctx.body,
        }, { publisher: 'kanban-app' });
        return { status: 200, data: updated };
      },

      addMember: (ctx) => {
        const { userId, role } = ctx.body;

        const existing = this.data.query('board_memberships', {
          board_id: ctx.params.boardId,
          user_id: userId,
        });
        if (existing.length > 0) {
          return { status: 409, data: { error: 'User is already a member' } };
        }

        const membership = this.data.insert('board_memberships', {
          board_id: ctx.params.boardId,
          user_id: userId,
          role: role || 'member',
        });

        this.events.publish('kanban-app.board.member.added', {
          board_id: ctx.params.boardId,
          user_id: userId,
          role: membership.role,
        }, { publisher: 'kanban-app' });

        return { status: 201, data: membership };
      },

      removeMember: (ctx) => {
        const memberships = this.data.query('board_memberships', {
          board_id: ctx.params.boardId,
          user_id: ctx.params.userId,
        });
        if (memberships.length === 0) {
          return { status: 404, data: { error: 'Membership not found' } };
        }
        this.data.delete('board_memberships', memberships[0].id);
        return { status: 200, data: { success: true } };
      },

      // ── Snapshot ───────────────────────────────────────

      snapshot: async (ctx) => {
        const board = this.data.find('boards', ctx.params.boardId);
        if (!board || board.status !== 'active') {
          return { status: 404, data: { error: 'Board not found' } };
        }
        const lists = this.data.query('lists', { board_id: board.id, archived: 0 }, { order: 'pos ASC' });
        const rawCards = this.data.query('cards', { board_id: board.id, archived: 0 }, { order: 'pos ASC' });
        const cards = [];
        for (const card of rawCards) {
          cards.push(await this._enrichCard(card));
        }
        const labels = this.data.query('labels', { board_id: board.id });
        return { status: 200, data: { board, lists, cards, labels } };
      },

      // ── Kanban (Lists) ────────────────────────────────

      listLists: (ctx) => {
        const lists = this.data.query('lists', { board_id: ctx.params.boardId, archived: 0 }, { order: 'pos ASC' });
        return { status: 200, data: lists };
      },

      createList: (ctx) => {
        const { name } = ctx.body;
        const pos = this._nextPos('lists', { board_id: ctx.params.boardId, archived: 0 });
        const list = this.data.insert('lists', {
          board_id: ctx.params.boardId,
          name,
          pos,
          archived: 0,
        });
        this.events.publish('kanban-app.list.created', {
          list_id: list.id,
          board_id: ctx.params.boardId,
          name,
        }, { publisher: 'kanban-app' });
        return { status: 201, data: list };
      },

      updateList: (ctx) => {
        const list = this.data.find('lists', ctx.params.listId);
        if (!list) return { status: 404, data: { error: 'List not found' } };
        const updated = this.data.update('lists', list.id, ctx.body);
        return { status: 200, data: updated };
      },

      archiveList: (ctx) => {
        const list = this.data.find('lists', ctx.params.listId);
        if (!list) return { status: 404, data: { error: 'List not found' } };
        const archived = this.data.update('lists', list.id, { archived: 1 });
        return { status: 200, data: archived };
      },

      reorderList: (ctx) => {
        const list = this.data.find('lists', ctx.params.listId);
        if (!list) return { status: 404, data: { error: 'List not found' } };
        const { pos } = ctx.body;
        const updated = this.data.update('lists', list.id, { pos });
        this.events.publish('kanban-app.list.reordered', {
          list_id: list.id,
          board_id: list.board_id,
          pos,
        }, { publisher: 'kanban-app' });
        return { status: 200, data: updated };
      },

      // ── Cards ──────────────────────────────────────────

      listCards: (ctx) => {
        const cards = this.data.query('cards', { board_id: ctx.params.boardId, archived: 0 }, { order: 'pos ASC' });
        return { status: 200, data: cards };
      },

      createCard: (ctx) => {
        const listId = ctx.body.listId || ctx.body.list_id;
        const { name, description } = ctx.body;
        const list = this.data.find('lists', listId);
        if (!list) return { status: 404, data: { error: 'List not found' } };
        const pos = this._nextPos('cards', { list_id: listId, archived: 0 });
        const card = this.data.insert('cards', {
          list_id: listId,
          board_id: list.board_id,
          name,
          description: description || '',
          pos,
          due_complete: 0,
          archived: 0,
          version: 1,
          created_by: ctx.currentUser.id,
        });
        this.events.publish('kanban-app.card.created', {
          card_id: card.id,
          board_id: card.board_id,
          list_id: card.list_id,
          name: card.name,
          created_by: card.created_by,
        }, { publisher: 'kanban-app' });
        return { status: 201, data: card };
      },

      showCard: async (ctx) => {
        const card = this.data.find('cards', ctx.params.cardId);
        if (!card || card.archived === 1) {
          return { status: 404, data: { error: 'Card not found' } };
        }
        return { status: 200, data: await this._enrichCard(card) };
      },

      updateCard: (ctx) => {
        const card = this.data.find('cards', ctx.params.cardId);
        if (!card) return { status: 404, data: { error: 'Card not found' } };
        const updated = this.data.update('cards', card.id, {
          ...ctx.body,
          version: card.version + 1,
        });
        this.events.publish('kanban-app.card.updated', {
          card_id: card.id,
          board_id: card.board_id,
          changes: ctx.body,
        }, { publisher: 'kanban-app' });
        return { status: 200, data: updated };
      },

      archiveCard: (ctx) => {
        const card = this.data.find('cards', ctx.params.cardId);
        if (!card) return { status: 404, data: { error: 'Card not found' } };
        const archived = this.data.update('cards', card.id, { archived: 1 });
        return { status: 200, data: archived };
      },

      moveCard: (ctx) => {
        const card = this.data.find('cards', ctx.params.cardId);
        if (!card) return { status: 404, data: { error: 'Card not found' } };

        const toListId = ctx.body.toListId || ctx.body.list_id;
        const pos = ctx.body.pos;
        const expectedVersion = ctx.body.expectedVersion;

        if (expectedVersion !== undefined && expectedVersion !== card.version) {
          return { status: 409, data: { error: 'Version conflict', current: card } };
        }

        const fromListId = card.list_id;
        const updates = { list_id: toListId, version: card.version + 1 };
        if (pos !== undefined) updates.pos = pos;

        const updated = this.data.update('cards', card.id, updates);
        this.events.publish('kanban-app.card.moved', {
          card_id: card.id,
          board_id: card.board_id,
          from_list_id: fromListId,
          to_list_id: toListId,
          pos: updated.pos,
        }, { publisher: 'kanban-app' });
        return { status: 200, data: { card: updated, activity: { type: 'card.moved', cardId: card.id, fromListId, toListId } } };
      },

      // ── Card Members ──────────────────────────────────

      addCardMember: (ctx) => {
        const { userId } = ctx.body;
        const existing = this.data.query('card_members', { card_id: ctx.params.cardId, user_id: userId });
        if (existing.length > 0) return { status: 409, data: { error: 'Already a member' } };
        const member = this.data.insert('card_members', {
          card_id: ctx.params.cardId,
          user_id: userId,
        });
        return { status: 201, data: member };
      },

      removeCardMember: (ctx) => {
        const members = this.data.query('card_members', {
          card_id: ctx.params.cardId,
          user_id: ctx.params.userId,
        });
        if (members.length === 0) return { status: 404, data: { error: 'Member not found' } };
        this.data.delete('card_members', members[0].id);
        return { status: 200, data: { success: true } };
      },

      // ── Labels ─────────────────────────────────────────

      listLabels: (ctx) => {
        const labels = this.data.query('labels', { board_id: ctx.params.boardId });
        return { status: 200, data: labels };
      },

      createLabel: (ctx) => {
        const { name, color } = ctx.body;
        const label = this.data.insert('labels', {
          board_id: ctx.params.boardId,
          name: name || '',
          color,
        });
        this.events.publish('kanban-app.label.created', {
          label_id: label.id,
          board_id: ctx.params.boardId,
          name: label.name,
          color,
        }, { publisher: 'kanban-app' });
        return { status: 201, data: label };
      },

      updateLabel: (ctx) => {
        const label = this.data.find('labels', ctx.params.labelId);
        if (!label) return { status: 404, data: { error: 'Label not found' } };
        const updated = this.data.update('labels', label.id, ctx.body);
        return { status: 200, data: updated };
      },

      deleteLabel: (ctx) => {
        const label = this.data.find('labels', ctx.params.labelId);
        if (!label) return { status: 404, data: { error: 'Label not found' } };
        this.data.delete('labels', label.id);
        return { status: 200, data: { success: true } };
      },

      addCardLabel: (ctx) => {
        const labelId = ctx.params.labelId || ctx.body.labelId;
        const existing = this.data.query('card_labels', { card_id: ctx.params.cardId, label_id: labelId });
        if (existing.length > 0) return { status: 409, data: { error: 'Label already added' } };
        const cardLabel = this.data.insert('card_labels', {
          card_id: ctx.params.cardId,
          label_id: labelId,
        });
        return { status: 201, data: cardLabel };
      },

      removeCardLabel: (ctx) => {
        const cardLabels = this.data.query('card_labels', {
          card_id: ctx.params.cardId,
          label_id: ctx.params.labelId,
        });
        if (cardLabels.length === 0) return { status: 404, data: { error: 'Card label not found' } };
        this.data.delete('card_labels', cardLabels[0].id);
        return { status: 200, data: { success: true } };
      },

      // ── Checklists ────────────────────────────────────

      createChecklist: (ctx) => {
        const { name } = ctx.body;
        const pos = this._nextPos('checklists', { card_id: ctx.params.cardId });
        const checklist = this.data.insert('checklists', {
          card_id: ctx.params.cardId,
          name,
          pos,
        });
        return { status: 201, data: checklist };
      },

      deleteChecklist: (ctx) => {
        const checklist = this.data.find('checklists', ctx.params.checklistId);
        if (!checklist) return { status: 404, data: { error: 'Checklist not found' } };
        const items = this.data.query('checkitems', { checklist_id: checklist.id });
        items.forEach((item) => this.data.delete('checkitems', item.id));
        this.data.delete('checklists', checklist.id);
        return { status: 200, data: { success: true } };
      },

      // ── Checkitems ────────────────────────────────────

      createCheckitem: (ctx) => {
        const { name, due_date, assigned_to } = ctx.body;
        const pos = this._nextPos('checkitems', { checklist_id: ctx.params.checklistId });
        const item = this.data.insert('checkitems', {
          checklist_id: ctx.params.checklistId,
          name,
          checked: 0,
          pos,
          due_date: due_date || null,
          assigned_to: assigned_to || null,
        });
        return { status: 201, data: item };
      },

      updateCheckitem: (ctx) => {
        const item = this.data.find('checkitems', ctx.params.checkitemId);
        if (!item) return { status: 404, data: { error: 'Checkitem not found' } };
        const wasChecked = item.checked;
        const updated = this.data.update('checkitems', item.id, ctx.body);
        if (ctx.body.checked !== undefined && ctx.body.checked !== wasChecked) {
          const checklist = this.data.find('checklists', item.checklist_id);
          this.events.publish('kanban-app.checkitem.toggled', {
            checkitem_id: item.id,
            card_id: checklist ? checklist.card_id : null,
            checked: ctx.body.checked,
          }, { publisher: 'kanban-app' });
        }
        return { status: 200, data: updated };
      },
    };
  }

  setupSubscriptions(eventBus) {
    // No subscriptions for kanban-app bundle
  }
}
