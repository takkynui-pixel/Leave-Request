'use client';

/** <select> ในฟอร์ม GET ที่ส่งฟอร์มทันทีเมื่อเลือกค่า (ไม่ต้องกดปุ่มค้นหา) */
export default function AutoSubmitSelect({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {children}
    </select>
  );
}
