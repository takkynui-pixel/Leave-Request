'use client';

import { useFormState } from 'react-dom';
import { changePin } from '@/app/actions/auth';
import SubmitButton from '@/components/SubmitButton';

export default function PinForm() {
  const [state, action] = useFormState(changePin, undefined);
  return (
    <form action={action} className="mt-4 grid gap-4 sm:max-w-sm">
      <div>
        <label className="label" htmlFor="pin">
          PIN ใหม่ (6 หลักขึ้นไป)
        </label>
        <input id="pin" name="pin" type="password" inputMode="numeric" className="input" autoComplete="new-password" required />
      </div>
      <div>
        <label className="label" htmlFor="confirm">
          ยืนยัน PIN ใหม่
        </label>
        <input id="confirm" name="confirm" type="password" inputMode="numeric" className="input" autoComplete="new-password" required />
      </div>
      {state?.error && <p className="alert-error">{state.error}</p>}
      {state?.ok && <p className="alert-ok">{state.ok}</p>}
      <div>
        <SubmitButton>บันทึก PIN ใหม่</SubmitButton>
      </div>
    </form>
  );
}
