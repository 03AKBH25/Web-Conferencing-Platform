/**
 * Formatting utilities for dates, times, and durations.
 */

export function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return dateString;
  }
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  return `${formatDate(dateString)} • ${formatTime(dateString)}`;
}

export function formatDuration(minutes?: number): string {
  if (!minutes) return '30 min';
  if (minutes < 60) return `${minutes} mins`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs} hr ${mins} mins` : `${hrs} ${hrs > 1 ? 'hrs' : 'hr'}`;
}

export function cleanMeetingId(input: string): string {
  // Strip http(s) protocols and slash prefixes if a URL was pasted
  let id = input.trim();
  if (id.includes('/')) {
    const parts = id.split('/');
    id = parts[parts.length - 1] || parts[parts.length - 2];
  }
  // Strip any query parameters e.g. ?demo_user=alex
  if (id.includes('?')) {
    id = id.split('?')[0];
  }
  return id;
}
