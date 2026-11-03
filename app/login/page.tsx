import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[36px] bg-[#f6f8fc] p-4 sm:p-6">
        <div className="card !p-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/vta-logo.png" alt="VTA Service" className="mx-auto h-14 w-auto" />
          <h1 className="mt-6 text-center text-2xl font-bold text-brand-600">เข้าสู่ระบบแจ้งลา</h1>
          <p className="mt-1 text-center text-sm text-slate-500">ใช้เบอร์โทรศัพท์และ PIN 6 หลักของคุณ</p>
          <LoginForm />
          <p className="mt-6 text-center text-xs text-slate-400">
            ลืม PIN หรือยังไม่มีบัญชี? ติดต่อฝ่ายบุคคล บริษัท วีทีเอ เซอร์วิส จำกัด
          </p>
        </div>
      </div>
    </div>
  );
}
