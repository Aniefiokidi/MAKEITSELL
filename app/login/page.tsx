import LoginForm from "@/components/auth/LoginForm"
import Footer from "@/components/Footer"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
      {/* <Footer /> */}
    </div>
  )
}
