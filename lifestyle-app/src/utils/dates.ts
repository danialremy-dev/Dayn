import { format } from 'date-fns';

export function dayKeyLocal(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function weekKeyLocal(date: Date) {
  return format(date, 'yyyy-ww');
}

