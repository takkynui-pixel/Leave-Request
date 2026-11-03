import { STATUS_CLASS, STATUS_LABEL, type LeaveStatus } from '@/lib/types';

export default function StatusBadge({ status }: { status: LeaveStatus }) {
  return <span className={`badge ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}
