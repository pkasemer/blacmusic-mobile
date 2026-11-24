export function timeAgo(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function greeting(date = new Date()): { text: string; kana: string } {
  const hour = date.getHours();
  if (hour < 5) return { text: 'Good night', kana: 'おやすみ' };
  if (hour < 12) return { text: 'Good morning', kana: 'おはよう' };
  if (hour < 18) return { text: 'Good afternoon', kana: 'こんにちは' };
  return { text: 'Good evening', kana: 'こんばんは' };
}
