export default function RootLoading() {
  return (
    <main className="min-h-screen bg-[#F9F5F1]" aria-hidden>
      <section className="relative mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 sm:pb-18 sm:pt-9 lg:px-8 lg:pb-24 lg:pt-12">
        <div className="grid items-center gap-6 sm:gap-9 lg:grid-cols-2 lg:gap-14">
          <div className="max-w-xl space-y-5">
            <div className="h-3 w-24 animate-pulse rounded-full bg-[#3B2F2F]/12" />
            <div className="space-y-3">
              <div className="h-12 w-full animate-pulse rounded-2xl bg-[#3B2F2F]/10 sm:h-16" />
              <div className="h-12 w-3/4 animate-pulse rounded-2xl bg-[#3B2F2F]/10 sm:h-16" />
            </div>
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-[#3B2F2F]/8" />
            <div className="flex flex-wrap gap-3 pt-2">
              <div className="h-12 w-44 animate-pulse rounded-full bg-[#3B2F2F]/12" />
              <div className="h-12 w-44 animate-pulse rounded-full bg-[#3B2F2F]/8" />
            </div>
            <div className="flex flex-wrap gap-2.5 pt-2">
              <div className="h-9 w-28 animate-pulse rounded-2xl bg-white/70" />
              <div className="h-9 w-32 animate-pulse rounded-2xl bg-white/70" />
              <div className="h-9 w-32 animate-pulse rounded-2xl bg-white/70" />
            </div>
          </div>
          <div className="relative mx-auto grid h-[320px] w-full max-w-[30rem] grid-cols-10 grid-rows-10 gap-2.5 sm:h-[430px] sm:gap-4 lg:mx-0 lg:h-[540px] lg:max-w-xl">
            <div className="col-span-7 row-span-7 animate-pulse rounded-3xl bg-[#FBF7F3]/96 ring-1 ring-[#2C2523]/8" />
            <div className="col-span-5 row-span-4 -translate-x-2 animate-pulse rounded-3xl bg-[#F4EFEB]/96 ring-1 ring-[#2C2523]/8" />
            <div className="col-span-5 row-span-5 -translate-x-6 translate-y-2 animate-pulse rounded-3xl bg-[#FEFAF6]/95 ring-1 ring-[#2C2523]/8" />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[#3B2F2F]/8 bg-white/56 p-4 backdrop-blur-sm sm:p-5">
          <div className="h-3 w-32 animate-pulse rounded-full bg-[#3B2F2F]/12" />
          <div className="mt-3 flex flex-wrap gap-2.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-9 w-28 animate-pulse rounded-full bg-white/70" />
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-3xl border border-[#3B2F2F]/9 bg-[#FCF8F4]/94 shadow-[0_24px_52px_-34px_rgba(59,47,47,0.36)]"
            >
              <div className="m-3.5 h-52 animate-pulse rounded-3xl bg-[#F7F0EA] sm:m-4 sm:h-56" />
              <div className="space-y-3 px-4 pb-5 sm:px-5">
                <div className="h-4 w-3/4 animate-pulse rounded-md bg-[#3B2F2F]/10" />
                <div className="h-3 w-full animate-pulse rounded-md bg-[#3B2F2F]/8" />
                <div className="h-10 w-full animate-pulse rounded-full bg-[#3B2F2F]/12" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
