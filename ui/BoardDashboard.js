import {
  Stack, Grid, Text, Button, Card, Divider, Spinner, Badge,
  StatCard, MiniBar, Sparkline, Avatar, ProgressBar,
} from './ui-kit.js';

export default function BoardDashboard({ data, actions }) {
  if (!data) return Spinner({});

  const snapshot = data[0] || {};
  const board = snapshot.board || {};
  const lists = Array.isArray(snapshot.lists) ? snapshot.lists : [];
  const cards = Array.isArray(snapshot.cards) ? snapshot.cards : [];
  const labels = Array.isArray(snapshot.labels) ? snapshot.labels : [];

  const boardId = actions.params?.boardId || board.id;
  const boardName = board.name || 'Board';

  // ── derived stats ───────────────────────────────────────

  const totalCards = cards.length;

  // Completed cards (in Done/Shipped/Complete lists)
  const doneListIds = lists
    .filter(l => /^(done|shipped|complete)$/i.test(l.name))
    .map(l => l.id);
  const completedCards = cards.filter(c => doneListIds.includes(c.list_id)).length;
  const completionPct = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

  // Overdue & due soon
  const now = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(now.getDate() + 3);

  let overdueCount = 0;
  let dueSoonCount = 0;

  for (const card of cards) {
    if (!card.due_date || card.due_complete) continue;
    const d = new Date(card.due_date);
    if (d < now) {
      overdueCount++;
    } else if (d <= threeDaysFromNow) {
      dueSoonCount++;
    }
  }

  // Cards per list (for mini bar chart)
  const cardsPerList = lists
    .sort((a, b) => a.pos - b.pos)
    .map(list => ({
      label: list.name,
      value: cards.filter(c => c.list_id === list.id).length,
    }));

  // Velocity sparkline data — cards completed per week (simulated from created_at)
  // Group completed cards by week
  const velocityData = [];
  const completedCardsArr = cards.filter(c => doneListIds.includes(c.list_id));
  if (completedCardsArr.length > 0) {
    // Build weekly buckets for last 8 weeks
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date();
      weekStart.setDate(now.getDate() - (w * 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const count = completedCardsArr.filter(c => {
        const d = new Date(c.updated_at || c.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      velocityData.push(count);
    }
  }

  // Team workload — cards per member
  const memberMap = {};
  for (const card of cards) {
    const members = card.card_members || card.members || [];
    for (const m of members) {
      const userId = m.user_id || m.id;
      const name = m.user_name || m.name || m.username || userId;
      if (!memberMap[userId]) {
        memberMap[userId] = { id: userId, name, total: 0, done: 0 };
      }
      memberMap[userId].total++;
      if (doneListIds.includes(card.list_id)) {
        memberMap[userId].done++;
      }
    }
  }
  const teamWorkload = Object.values(memberMap).sort((a, b) => b.total - a.total);

  // Labels breakdown
  const labelCounts = labels.map(label => {
    const count = cards.filter(c =>
      (c.card_labels || c.labels || []).some(cl => (cl.label_id || cl.id) === label.id)
    ).length;
    return { name: label.name || label.color, color: label.color, count };
  }).filter(l => l.count > 0);

  // ── build descriptor tree ───────────────────────────────

  return Stack({ spacing: 3, sx: { p: 2, maxWidth: 1000, mx: 'auto' } }, [

    // Header
    Stack({ direction: 'row', spacing: 2, sx: { alignItems: 'center' } }, [
      Button({ label: '\u2190 Back to Board', variant: 'text', onClick: () => actions.navigate(`/boards/${boardId}`) }),
      Text({ variant: 'h5', content: `${boardName} \u2014 Dashboard` }),
    ]),

    Divider({}),

    // ── Stat cards row ────────────────────────────────────
    Grid({ columns: 'repeat(auto-fill, minmax(180px, 1fr))', spacing: 2 }, [
      StatCard({
        value: String(totalCards),
        label: 'Total Cards',
        color: '#1976d2',
      }),
      StatCard({
        value: String(completedCards),
        label: 'Completed',
        color: '#66bb6a',
      }),
      StatCard({
        value: String(overdueCount),
        label: 'Overdue',
        color: overdueCount > 0 ? '#ef5350' : '#9e9e9e',
      }),
      StatCard({
        value: String(dueSoonCount),
        label: 'Due Soon',
        color: dueSoonCount > 0 ? '#ffa726' : '#9e9e9e',
      }),
    ]),

    // ── Cards by status (mini bar chart) ──────────────────
    Card({ sx: { p: 2 } }, [
      Text({ variant: 'h6', content: 'Cards by Status' }),
      Stack({ sx: { mt: 1 } }, [
        MiniBar({
          data: cardsPerList,
          height: 32,
        }),
      ]),
    ]),

    // ── Velocity sparkline ────────────────────────────────
    Card({ sx: { p: 2 } }, [
      Text({ variant: 'h6', content: 'Velocity (cards completed per week)' }),
      Stack({ sx: { mt: 1 } }, [
        velocityData.length > 0
          ? Sparkline({
              data: velocityData,
              height: 60,
              color: '#66bb6a',
              label: 'Last 8 weeks',
            })
          : Text({ variant: 'body2', content: 'No velocity data yet', sx: { color: 'text.secondary' } }),
      ]),
    ]),

    // ── Completion progress ───────────────────────────────
    Card({ sx: { p: 2 } }, [
      Text({ variant: 'h6', content: 'Completion' }),
      Stack({ spacing: 1, sx: { mt: 1 } }, [
        ProgressBar({ value: completedCards, max: totalCards || 1, label: `${completionPct}%` }),
        Text({
          variant: 'body2',
          content: `${completedCards} of ${totalCards} cards in Done/Shipped/Complete lists`,
          sx: { color: 'text.secondary' },
        }),
      ]),
    ]),

    // ── Team workload ─────────────────────────────────────
    Card({ sx: { p: 2 } }, [
      Text({ variant: 'h6', content: 'Team Workload' }),
      teamWorkload.length > 0
        ? Stack({ spacing: 1.5, sx: { mt: 1 } },
            teamWorkload.map(member =>
              Stack({ direction: 'row', spacing: 2, sx: { alignItems: 'center' } }, [
                Avatar({ name: member.name, size: 'small' }),
                Text({ variant: 'body2', content: member.name, sx: { minWidth: 120, fontWeight: 500 } }),
                Stack({ sx: { flex: 1 } }, [
                  ProgressBar({
                    value: member.done,
                    max: member.total || 1,
                    label: `${member.done}/${member.total}`,
                  }),
                ]),
                Text({
                  variant: 'caption',
                  content: `${member.total} card${member.total !== 1 ? 's' : ''}`,
                  sx: { color: 'text.secondary', minWidth: 60 },
                }),
              ])
            )
          )
        : Text({ variant: 'body2', content: 'No assigned cards', sx: { color: 'text.secondary', mt: 1 } }),
    ]),

    // ── Labels breakdown ──────────────────────────────────
    labelCounts.length > 0
      ? Card({ sx: { p: 2 } }, [
          Text({ variant: 'h6', content: 'Cards by Label' }),
          Stack({ direction: 'row', spacing: 1, sx: { mt: 1, flexWrap: 'wrap' } },
            labelCounts.map(l =>
              Stack({
                spacing: 0.5,
                sx: { alignItems: 'center', p: 1, borderRadius: 1, bgcolor: 'action.hover', minWidth: 80 },
              }, [
                Badge({ text: l.name, color: l.color }),
                Text({ variant: 'h6', content: String(l.count) }),
              ])
            )
          ),
        ])
      : null,

  ].filter(Boolean));
}
