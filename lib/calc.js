export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const z = (n) => String(n).padStart(2, '0');
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

const r2 = (n) => Math.round(n * 100) / 100;

export function summarize(list) {
  let income = 0, expense = 0;
  for (const t of list) (t.type === 'income' ? (income += t.amount) : (expense += t.amount));
  income = r2(income); expense = r2(expense);
  return { income, expense, net: r2(income - expense) };
}

export function monthlyBreakdown(yearList) {
  return MONTHS.map((name, i) => ({
    name,
    key: z(i + 1),
    ...summarize(yearList.filter((t) => t.date.slice(5, 7) === z(i + 1))),
  }));
}

export function categoryTotals(list, type = 'expense') {
  const map = new Map();
  for (const t of list) if (t.type === type) map.set(t.category, (map.get(t.category) || 0) + t.amount);
  return [...map].map(([name, total]) => ({ name, total: r2(total) })).sort((a, b) => b.total - a.total);
}

export const money = (n) =>
  (n < 0 ? '-' : '') + '৳' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
