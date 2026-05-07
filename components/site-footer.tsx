import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#3B2F2F]/8 bg-[#FCF6F1]/90 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2 text-xs text-[#3B2F2F]/70">
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
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-base font-semibold text-[#241B1B]">Little Smiles</p>
            <p className="mt-1 text-sm text-[#3B2F2F]/65">
              Premium baby essentials for families in Pakistan.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#3B2F2F]/72">
            <Link href="/shop" className="hover:text-[#2E2323]">
              Shop
            </Link>
            <Link href="/best-sellers" className="hover:text-[#2E2323]">
              Best Sellers
            </Link>
            <Link href="/blog" className="hover:text-[#2E2323]">
              Blog
            </Link>
            <Link href="/reviews" className="hover:text-[#2E2323]">
              Reviews
            </Link>
            <Link href="/contact" className="hover:text-[#2E2323]">
              Contact
            </Link>
            <Link href="/shipping-policy" className="hover:text-[#2E2323]">
              Shipping Policy
            </Link>
            <Link href="/return-refund-policy" className="hover:text-[#2E2323]">
              Return & Refund
            </Link>
            <Link href="/privacy-policy" className="hover:text-[#2E2323]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-[#2E2323]">
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
