import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#3B2F2F]/8 bg-[#FCF6F1]/90 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2.5 text-xs text-[#3B2F2F]/70 sm:gap-2">
          <span className="rounded-full border border-[#3B2F2F]/12 bg-white/55 px-3 py-1">
            Dispatch: 24-48 hours
          </span>
          <span className="rounded-full border border-[#3B2F2F]/12 bg-white/55 px-3 py-1">
            Delivery: 2-5 business days
          </span>
          <span className="rounded-full border border-[#3B2F2F]/12 bg-white/55 px-3 py-1">
            Return support: within 48 hours
          </span>
          <span className="rounded-full border border-[#3B2F2F]/12 bg-white/55 px-3 py-1">
            WhatsApp replies: 10am-10pm PKT
          </span>
        </div>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-base font-semibold text-[#241B1B]">Little Smiles</p>
            <p className="mt-1 text-sm text-[#3B2F2F]/65">
              Premium baby essentials for families in Pakistan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-sm text-[#3B2F2F]/72 sm:justify-end">
            <Link href="/shop" className="inline-flex min-h-10 items-center rounded-md px-1 hover:text-[#2E2323]">
              Shop
            </Link>
            <Link href="/best-sellers" className="inline-flex min-h-10 items-center rounded-md px-1 hover:text-[#2E2323]">
              Best Sellers
            </Link>
            <Link href="/blog" className="inline-flex min-h-10 items-center rounded-md px-1 hover:text-[#2E2323]">
              Blog
            </Link>
            <Link href="/reviews" className="inline-flex min-h-10 items-center rounded-md px-1 hover:text-[#2E2323]">
              Reviews
            </Link>
            <Link href="/contact" className="inline-flex min-h-10 items-center rounded-md px-1 hover:text-[#2E2323]">
              Contact
            </Link>
            <Link href="/shipping-policy" className="inline-flex min-h-10 items-center rounded-md px-1 hover:text-[#2E2323]">
              Shipping Policy
            </Link>
            <Link href="/return-refund-policy" className="inline-flex min-h-10 items-center rounded-md px-1 hover:text-[#2E2323]">
              Return & Refund
            </Link>
            <Link href="/privacy-policy" className="inline-flex min-h-10 items-center rounded-md px-1 hover:text-[#2E2323]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="inline-flex min-h-10 items-center rounded-md px-1 hover:text-[#2E2323]">
              Terms
            </Link>
          </div>
        </div>
        <p className="text-xs text-[#3B2F2F]/55">
          © {new Date().getFullYear()} Little Smiles. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
