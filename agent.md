# Kanban-App Bundle

Consolidated bundle that merges workspace, boards, and kanban functionality into a single unit. Manages the full lifecycle: workspaces and memberships, boards and board members, lists, cards (with members, labels, checklists, and checkitems). Provides a board snapshot endpoint that returns the complete board state in one call. Uses `coordinator.call('iam', 'getUser')` as an optional dependency for resolving user display names on card members. All other data (labels, checklists, memberships) is resolved internally since it lives in the same bundle.
