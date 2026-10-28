// Показ чисел и времени для интерфейса (фича 001, data-model §5).
// Чистые функции: без DOM, часов и хранилища, поэтому проверяются в node.

const scoreFormat = new Intl.NumberFormat("ru-RU");

const pad2 = (n) => String(n).padStart(2, "0");

export function formatScore(n) {
  return scoreFormat.format(n);
}

// Спринт: «м:сс,сс», от часа «ч:мм:сс,сс». Сотые отбрасываются (Р-8).
export function formatSprintTime(ms) {
  const centis = Math.floor(ms / 10);
  const hundredths = centis % 100;
  const totalSeconds = Math.floor(centis / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const tail = `${pad2(seconds)},${pad2(hundredths)}`;
  if (totalMinutes < 60) return `${totalMinutes}:${tail}`;
  return `${Math.floor(totalMinutes / 60)}:${pad2(totalMinutes % 60)}:${tail}`;
}

// Ультра: остаток «м:сс» с округлением вверх; меньше 10 с — с десятыми,
// тоже вверх, чтобы «0:00» появлялось только в момент конца.
export function formatUltraTime(ms) {
  if (ms > 0 && ms < 10000) {
    const tenths = Math.ceil(ms / 100);
    return `0:${pad2(Math.floor(tenths / 10))},${tenths % 10}`;
  }
  const totalSeconds = Math.ceil(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${pad2(totalSeconds % 60)}`;
}
