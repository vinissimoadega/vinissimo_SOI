import { LoginForm } from "./login-form";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <main className="min-h-screen bg-[#fbf8f5] px-4 py-10 text-grafite">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="surface-muted flex flex-col justify-between p-8 lg:p-10">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-vinho-900/70">
                Viníssimo
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-grafite">
                SOI com acesso autenticado
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-black/60">
                Entre com seu email e senha para liberar o dashboard e os módulos
                operacionais já publicados no bootstrap inicial.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-black/5 bg-white/80 p-4">
                <p className="text-sm font-medium text-grafite">Privado</p>
                <p className="mt-2 text-xs text-black/55">
                  Stack mantida em bind local.
                </p>
              </div>
              <div className="rounded-2xl border border-black/5 bg-white/80 p-4">
                <p className="text-sm font-medium text-grafite">Papéis</p>
                <p className="mt-2 text-xs text-black/55">
                  Base pronta para autorização por função.
                </p>
              </div>
              <div className="rounded-2xl border border-black/5 bg-white/80 p-4">
                <p className="text-sm font-medium text-grafite">Bootstrap</p>
                <p className="mt-2 text-xs text-black/55">
                  Primeiro admin criado manualmente e de forma controlada.
                </p>
              </div>
            </div>
          </section>

          <section className="surface p-8 lg:p-10">
            <div className="mb-6">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-black/45">
                Login
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-grafite">
                Acessar o dashboard
              </h2>
              <p className="mt-2 text-sm text-black/55">
                Use um usuário válido do SOI para continuar.
              </p>
            </div>

            <LoginForm />
          </section>
        </div>
      </div>
    </main>
  );
}
