import RegisterForm from '@/components/register-form';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold mb-2">机构注册</h1>
        <p className="text-gray-600 mb-6">创建您的机构账号，开始使用 AI 获客工具</p>
        <RegisterForm />
      </div>
    </div>
  );
}
