import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import KanbanApp from '../logic.js';
import { createMockData, createMockEvents, createMockCoordinator } from './helpers.js';

describe('KanbanApp bundle', () => {
  let kanban, data, events;

  beforeEach(() => {
    data = createMockData();
    events = createMockEvents();
    kanban = new KanbanApp({
      data,
      events,
      config: { config: {} },
      coordinator: createMockCoordinator(),
    });
  });

  describe('constructor', () => {
    it('creates an instance', () => {
      assert.ok(kanban);
    });
  });

  describe('routes()', () => {
    it('returns an object with route handlers', () => {
      const routes = kanban.routes();
      assert.equal(typeof routes, 'object');
      assert.ok(Object.keys(routes).length > 0);
    });

    it('exposes workspace routes', () => {
      const routes = kanban.routes();
      assert.equal(typeof routes.list, 'function');
      assert.equal(typeof routes.create, 'function');
      assert.equal(typeof routes.show, 'function');
    });

    it('exposes board routes', () => {
      const routes = kanban.routes();
      assert.equal(typeof routes.listByWorkspace, 'function');
      assert.equal(typeof routes.createBoard, 'function');
      assert.equal(typeof routes.showBoard, 'function');
    });

    it('exposes list routes', () => {
      const routes = kanban.routes();
      assert.equal(typeof routes.listLists, 'function');
      assert.equal(typeof routes.createList, 'function');
    });

    it('exposes card routes', () => {
      const routes = kanban.routes();
      assert.equal(typeof routes.listCards, 'function');
      assert.equal(typeof routes.createCard, 'function');
      assert.equal(typeof routes.moveCard, 'function');
    });

    it('exposes label routes', () => {
      const routes = kanban.routes();
      assert.equal(typeof routes.listLabels, 'function');
      assert.equal(typeof routes.createLabel, 'function');
    });

    it('exposes checklist routes', () => {
      const routes = kanban.routes();
      assert.equal(typeof routes.createChecklist, 'function');
      assert.equal(typeof routes.createCheckitem, 'function');
    });
  });

  describe('interfaces()', () => {
    it('returns an object with interface handlers', () => {
      const ifaces = kanban.interfaces();
      assert.equal(typeof ifaces, 'object');
    });

    it('exposes getWorkspace interface', () => {
      assert.equal(typeof kanban.interfaces().getWorkspace, 'function');
    });

    it('exposes listUserWorkspaces interface', () => {
      assert.equal(typeof kanban.interfaces().listUserWorkspaces, 'function');
    });

    it('exposes isMember interface', () => {
      assert.equal(typeof kanban.interfaces().isMember, 'function');
    });

    it('exposes getBoard interface', () => {
      assert.equal(typeof kanban.interfaces().getBoard, 'function');
    });

    it('exposes listByWorkspace interface', () => {
      assert.equal(typeof kanban.interfaces().listByWorkspace, 'function');
    });

    it('exposes getCard interface', () => {
      assert.equal(typeof kanban.interfaces().getCard, 'function');
    });

    it('exposes getBoardSnapshot interface', () => {
      assert.equal(typeof kanban.interfaces().getBoardSnapshot, 'function');
    });
  });

  describe('workspace routes', () => {
    it('create workspace returns 201', () => {
      const result = kanban.routes().create({
        body: { name: 'My Workspace' },
        currentUser: { id: 'user-1' },
      });
      assert.equal(result.status, 201);
      assert.equal(result.data.name, 'My Workspace');
      assert.equal(result.data.status, 'active');
    });

    it('create workspace auto-adds membership', () => {
      const result = kanban.routes().create({
        body: { name: 'My Workspace' },
        currentUser: { id: 'user-1' },
      });
      const memberships = data.query('workspace_memberships', { workspace_id: result.data.id });
      assert.equal(memberships.length, 1);
      assert.equal(memberships[0].role, 'admin');
    });

    it('create workspace publishes event', () => {
      kanban.routes().create({
        body: { name: 'WS' },
        currentUser: { id: 'user-1' },
      });
      const event = events._published.find((e) => e.name === 'kanban-app.workspace.created');
      assert.ok(event);
    });

    it('create workspace rejects missing name', () => {
      const result = kanban.routes().create({
        body: {},
        currentUser: { id: 'user-1' },
      });
      assert.equal(result.status, 400);
    });

    it('show returns 404 for nonexistent workspace', () => {
      const result = kanban.routes().show({
        params: { workspaceId: 'nonexistent' },
      });
      assert.equal(result.status, 404);
    });
  });

  describe('board routes', () => {
    it('createBoard returns 201', () => {
      const result = kanban.routes().createBoard({
        body: { name: 'Sprint Board' },
        params: { workspaceId: 'ws-1' },
        currentUser: { id: 'user-1' },
      });
      assert.equal(result.status, 201);
      assert.equal(result.data.name, 'Sprint Board');
      assert.equal(result.data.status, 'active');
    });

    it('createBoard rejects missing name', () => {
      const result = kanban.routes().createBoard({
        body: {},
        params: { workspaceId: 'ws-1' },
        currentUser: { id: 'user-1' },
      });
      assert.equal(result.status, 400);
    });

    it('showBoard returns 404 for nonexistent board', () => {
      const result = kanban.routes().showBoard({
        params: { boardId: 'nonexistent' },
      });
      assert.equal(result.status, 404);
    });
  });

  describe('list routes', () => {
    it('createList returns 201', () => {
      const result = kanban.routes().createList({
        body: { name: 'To Do' },
        params: { boardId: 'board-1' },
      });
      assert.equal(result.status, 201);
      assert.equal(result.data.name, 'To Do');
      assert.ok(result.data.pos > 0);
    });

    it('createList rejects missing name', () => {
      const result = kanban.routes().createList({
        body: {},
        params: { boardId: 'board-1' },
      });
      assert.equal(result.status, 400);
    });
  });

  describe('card routes', () => {
    let listId;

    beforeEach(() => {
      const list = data.insert('lists', { board_id: 'board-1', name: 'To Do', pos: 65536, archived: 0 });
      listId = list.id;
    });

    it('createCard returns 201', () => {
      const result = kanban.routes().createCard({
        body: { name: 'Fix bug', listId },
        currentUser: { id: 'user-1' },
      });
      assert.equal(result.status, 201);
      assert.equal(result.data.name, 'Fix bug');
    });

    it('createCard rejects missing name', () => {
      const result = kanban.routes().createCard({
        body: { listId },
        currentUser: { id: 'user-1' },
      });
      assert.equal(result.status, 422);
    });

    it('createCard rejects missing listId', () => {
      const result = kanban.routes().createCard({
        body: { name: 'No list' },
        currentUser: { id: 'user-1' },
      });
      assert.equal(result.status, 422);
    });

    it('moveCard changes list_id', () => {
      const card = data.insert('cards', {
        list_id: listId, board_id: 'board-1', name: 'Movable',
        pos: 65536, archived: 0, version: 1,
      });
      const list2 = data.insert('lists', { board_id: 'board-1', name: 'Done', pos: 131072, archived: 0 });
      const result = kanban.routes().moveCard({
        params: { cardId: card.id },
        body: { toListId: list2.id },
      });
      assert.equal(result.status, 200);
      assert.equal(result.data.card.list_id, list2.id);
    });
  });

  describe('setupSubscriptions', () => {
    it('is a function (no-op)', () => {
      assert.equal(typeof kanban.setupSubscriptions, 'function');
      // Should not throw
      kanban.setupSubscriptions({ subscribe() {} });
    });
  });
});
