import { BackLink } from "@/components/ui/Buttons";
import { Header } from "@/components/layout/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="page" className="flex min-h-dvh flex-col justify-center px-4 lg:px-6">
        <p className="t-display text-[clamp(4rem,18vw,16rem)]">Offside.</p>
        <div className="gradient-fill my-6 h-[5px] w-full" />
        <BackLink className="max-w-fit" />
      </main>
    </>
  );
}
