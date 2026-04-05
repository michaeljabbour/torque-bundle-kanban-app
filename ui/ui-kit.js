function el(type, props = {}, children = null) {
  return { type, props, children };
}

// Layout
export const Stack = (props, children) => el('stack', props, children);
export const Grid = (props, children) => el('grid', props, children);

// Typography & inputs
export const Text = (props) => el('text', props);
export const TextField = (props) => el('text-field', props);
export const InlineEdit = (props) => el('inline-edit', props);

// Actions
export const Button = (props) => el('button', props);
export const Form = (props, children) => el('form', props, children);

// Containers
export const Card = (props, children) => el('card', props, children);
export const Modal = (props, children) => el('modal', props, children);

// Feedback
export const Alert = (props) => el('alert', props);
export const Spinner = (props) => el('spinner', props || {});
export const Badge = (props) => el('badge', props);
export const Divider = (props) => el('divider', props || {});
export const Icon = (props) => el('icon', props);

// Navigation
export const TabBar = (props) => el('tab-bar', props);

// Kanban-specific
export const KanbanBoard = (props, children) => el('kanban-board', props, children);
export const KanbanList = (props, children) => el('kanban-list', props, children);
export const KanbanCard = (props) => el('kanban-card', props);
export const CardModal = (props, children) => el('card-modal', props, children);

// Workspace & board cards
export const WorkspaceCard = (props, children) => el('workspace-card', props, children);
export const BoardCard = (props, children) => el('board-card', props, children);

// Data display
export const Avatar = (props) => el('avatar', props);
export const AvatarStack = (props) => el('avatar-stack', props);
export const ProgressBar = (props) => el('progress-bar', props);
export const StatCard = (props) => el('stat-card', props);
export const MiniBar = (props) => el('mini-bar', props);
export const Sparkline = (props) => el('sparkline', props);

// Interactive
export const Checklist = (props, children) => el('checklist', props, children);
export const FilterDropdown = (props) => el('filter-dropdown', props);
