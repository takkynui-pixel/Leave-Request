'use client';

import { useFormState } from 'react-dom';
import { login } from '@/app/actions/auth';
import SubmitButton from '@/components/SubmitButton';

export default function LoginForm() {
  const [state, action] = useFormState(login, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="id">
          เบอร์โทรศัพท์
        </label>
        <input
          id="id"
          name="id"
          className="input"
          inputMode="tel"
          autoComplete="username"
          placeholder="08x-xxx-xxxx"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="pin">
          PIN
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          className="input"
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="••••••"
          required
        />
      </div>
      {state?.error && <p className="alert-error">{state.error}</p>}
      <SubmitButton className="btn-primary w-full" pendingText="กำลังเข้าสู่ระบบ…">
        เข้าสู่ระบบ
      </SubmitButton>
    </form>
  );
}
