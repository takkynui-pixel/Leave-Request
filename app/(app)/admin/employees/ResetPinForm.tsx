'use client';

import { useFormState } from 'react-dom';
import { resetPin } from '@/app/actions/admin';
import SubmitButton from '@/components/SubmitButton';

export default function ResetPinForm({ employeeId }: { employeeId: string }) {
  const [state, action] = useFormState(resetPin, undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="employee_id" value={employeeId} />
      <input
        name="pin"
        inputMode="numeric"
        maxLength={6}
        pattern="\d{6}"
        placeholder="PIN ใหม่"
        className="input !w-28 !py-1.5 text-xs"
        required
      />
      <SubmitButton className="btn-outline btn-sm" pendingText="…">
        ตั้งค่า
      </SubmitButton>
      {state?.ok && <span className="text-xs text-emerald-600">✓</span>}
      {state?.error && <span className="text-xs text-rose-600">{state.error}</span>}
    </form>
  );
}
