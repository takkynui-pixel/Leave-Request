'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { login } from '@/app/actions/auth';
import SubmitButton from '@/components/SubmitButton';

export default function LoginForm() {
  const [state, action] = useFormState(login, undefined);
  // พนักงาน = เบอร์โทร + PIN (แป้นตัวเลข) / แอดมิน = อีเมล + รหัสผ่าน (แป้นตัวอักษรเต็ม)
  const [adminMode, setAdminMode] = useState(false);

  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="id">
          {adminMode ? 'อีเมล' : 'เบอร์โทรศัพท์'}
        </label>
        <input
          key={adminMode ? 'email' : 'phone'}
          id="id"
          name="id"
          className="input"
          type={adminMode ? 'email' : 'text'}
          inputMode={adminMode ? 'email' : 'tel'}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={adminMode ? 'name@company.com' : '08x-xxx-xxxx'}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="pin">
          {adminMode ? 'รหัสผ่าน' : 'PIN'}
        </label>
        <input
          key={adminMode ? 'pw' : 'pin'}
          id="pin"
          name="pin"
          type="password"
          className="input"
          inputMode={adminMode ? 'text' : 'numeric'}
          autoComplete="current-password"
          autoCapitalize="none"
          placeholder={adminMode ? '••••••••' : '••••••'}
          required
        />
      </div>
      {state?.error && <p className="alert-error">{state.error}</p>}
      <SubmitButton className="btn-primary w-full" pendingText="กำลังเข้าสู่ระบบ…">
        เข้าสู่ระบบ
      </SubmitButton>
      <button
        type="button"
        onClick={() => setAdminMode((v) => !v)}
        className="block w-full text-center text-sm font-medium text-brand-600 hover:underline"
      >
        {adminMode ? '← กลับไปเข้าสู่ระบบด้วยเบอร์โทร' : 'แอดมิน? เข้าสู่ระบบด้วยอีเมล'}
      </button>
    </form>
  );
}
