export interface Note {
  id: string;
  type: 'gen' | 'upd' | 'ai';
  title?: string;
  text: string;
  ts: string;
  done?: boolean;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  va: string;
  start: string;
  status: string;
  li: string;
  ert: string;
  ertTime: string;
  attendees: number;
  registered: number;
  message: string;
  targeting: string;
  flag: string;
  redzone: boolean;
  notes: Note[];
}

export interface Task {
  id: string;
  text: string;
  done: boolean;
  dueDate: string;
  priority: 'normal' | 'important' | 'urgent';
  ts: string;
}

export interface ActivityRow {
  clientName: string;
  date: string;
  activityDate: string;
  va: string;
  ertDate: string;
  connReqSent: number;
  liEventInvites: number;
  inmailSent: number;
  connectionsMade: number;
}

export interface RoundtableEvent {
  clientName: string;
  date: string;
  rtTime: string;
  attendees: number | null;
  registered: number | null;
  calendarConfirmed: number | null;
}

export interface MeetingActionItem {
  id: string;
  text: string;
  done: boolean;
}

export interface MeetingDraft {
  clientId: string;
  clientName: string;
  notes: string;
  actionItems: MeetingActionItem[];
  updatedAt: string;
}

export interface AttendanceEntry {
  id: string;
  va: string;
  date: string;
  late: boolean;
  absent: boolean;
  ooz: boolean;
  notes: string;
  shortNotice?: boolean;
  submittedPHT?: string;
}

export interface ActivityLog {
  id: string;
  date: string;
  va: string;
  clientId: string;
  clientName: string;
  pmName: string;
  connReqSent: number;
  inmailsSent: number;
  liEventInvites: number;
  interested: number;
  registeredErt: number;
  ts: string;
}