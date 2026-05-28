function getDiffDays(date: Date) {
  return Math.floor(
    (Date.now() - new Date(date).getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

export function groupItemsByDate(items: any[],keyToReturn:string ='notifications') {
  const map = new Map<string, any[]>();

  const now = new Date();

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const diffDays = (date: Date) =>
    Math.floor(
      (startOfDay(now).getTime() -
        startOfDay(new Date(date)).getTime()) /
        (1000 * 60 * 60 * 24),
    );

  const getWeekNumber = (date: Date) => {
    const temp = new Date(date.getTime());
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
    const week1 = new Date(temp.getFullYear(), 0, 4);
    return (
      1 +
      Math.round(
        ((temp.getTime() - week1.getTime()) /
          86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7,
      )
    );
  };

  const currentWeek = getWeekNumber(now);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  for (const item of items) {
    const date = new Date(item.createdAt);
    const diff = diffDays(date);

    const week = getWeekNumber(date);
    const month = date.getMonth();
    const year = date.getFullYear();

    let label: string;

    // 🟢 Today
    if (diff === 0) {
      label = 'Today';
    }

    // 🟡 Yesterday
    else if (diff === 1) {
      label = 'Yesterday';
    }

    // 🔵 This Week
    else if (year === currentYear && week === currentWeek) {
      label = 'This Week';
    }

    // 🟣 Last Week
    else if (year === currentYear && week === currentWeek - 1) {
      label = 'Last Week';
    }

    // 🟠 This Month
    else if (year === currentYear && month === currentMonth) {
      label = 'This Month';
    }

    // 🟤 Last Month
    else if (
      year === currentYear &&
      month === currentMonth - 1
    ) {
      label = 'Last Month';
    }

    // 📅 Month grouping (Instagram style)
    else if (year === currentYear) {
      label = date.toLocaleString('default', {
        month: 'long',
      });
    }

    // 📆 Older years
    else {
      label = year.toString();
    }

    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(item);
  }

  return Array.from(map.entries()).map(([title, itms]) => ({
    title,
    [keyToReturn]: itms,
  }));
}