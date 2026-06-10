import LoginForm from './LoginForm'

// This page is a Server Component with force-dynamic to enable server actions
// The form itself is a Client Component (LoginForm)
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return <LoginForm />
}
