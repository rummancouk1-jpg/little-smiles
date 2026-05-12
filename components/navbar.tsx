"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, MessageCircle, ShoppingBag } from "lucide-react";

import { useCart } from "@/components/cart-provider";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { trackAndOpenWhatsapp } from "@/lib/order-intent-client";
import { whatsappBaseUrl } from "@/lib/products";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Blog", href: "/blog" },
  { label: "Best Sellers", href: "/best-sellers" },
  { label: "Reviews", href: "/reviews" },
  { label: "Track Order", href: "/track-order" },
  { label: "Contact", href: "/contact" },
] as const;

export function Navbar() {
  const { totalQuantity, isCartReady } = useCart();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-transparent transition-[background-color,box-shadow,border-color] duration-300",
        "bg-[#F9F5F1]/72 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl",
        isScrolled &&
          "border-[#3B2F2F]/12 bg-[#F9F5F1]/88 shadow-[0_20px_44px_-26px_rgba(59,47,47,0.4)]"
      )}
    >
      <div className="mx-auto flex h-18 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 lg:gap-4 lg:px-8">
        <Link
          href="/"
          aria-label="Go to homepage"
          className="inline-flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E2323]/30"
        >
          <Image
            src="/products/logo.png"
            alt="Little Smiles logo"
            width={100}
            height={40}
            priority
            className="h-auto w-[95px] opacity-95 sm:w-[114px] lg:w-[136px]"
          />
        </Link>

        <nav className="hidden items-center gap-8 xl:gap-10 lg:flex">
          {navLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm font-medium tracking-[0.03em] text-[#3B2F2F]/76 transition-colors duration-200 hover:text-[#2E2323]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/cart"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#3B2F2F]/14 bg-white/66 text-[#2E2323] shadow-[0_10px_28px_-22px_rgba(59,47,47,0.46)] backdrop-blur-sm transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#3B2F2F]/26 hover:bg-[#F2EAE4]"
            aria-label={
              totalQuantity > 0 ? `Cart, ${totalQuantity} items` : "View shopping cart"
            }
          >
            <ShoppingBag className="size-[1.2rem]" aria-hidden />
            {isCartReady && totalQuantity > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2F2624] px-1 text-[10px] font-semibold tabular-nums text-[#F6F1EC]">
                {totalQuantity > 99 ? "99+" : totalQuantity}
              </span>
            ) : null}
          </Link>
          <Button
            asChild
            className="h-11 rounded-full border-transparent bg-[#2F2624] px-5 text-sm font-medium text-[#F6F1EC] shadow-[0_12px_30px_-20px_rgba(47,38,36,0.5)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-[#251E1D] hover:shadow-[0_18px_36px_-22px_rgba(47,38,36,0.6)]"
          >
            <Link
              href={whatsappBaseUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) =>
                void trackAndOpenWhatsapp(event, {
                  whatsappUrl: whatsappBaseUrl,
                  sourcePage: "desktop_navbar",
                })
              }
              className="inline-flex items-center gap-2"
            >
              <MessageCircle className="size-4" strokeWidth={2} aria-hidden />
              Order on WhatsApp
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href={whatsappBaseUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) =>
              void trackAndOpenWhatsapp(event, {
                whatsappUrl: whatsappBaseUrl,
                sourcePage: "mobile_navbar",
              })
            }
            aria-label="Order on WhatsApp"
            className="inline-flex size-11 items-center justify-center rounded-full border border-transparent bg-[#2F2624] text-[#F6F1EC] shadow-[0_10px_24px_-16px_rgba(47,38,36,0.55)] transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-[#251E1D] hover:shadow-[0_14px_28px_-18px_rgba(47,38,36,0.65)]"
          >
            <MessageCircle className="size-[1.15rem]" strokeWidth={2} aria-hidden />
          </Link>
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-full border-[#3B2F2F]/14 bg-white/66 text-[#2E2323] shadow-[0_10px_28px_-22px_rgba(59,47,47,0.46)] backdrop-blur-sm transition-[background-color,border-color] duration-200 hover:border-[#3B2F2F]/24 hover:bg-[#F2EAE4]"
              >
                <Menu className="size-[1.1rem]" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[86%] border-l-[#3B2F2F]/12 bg-[#FAF6F2]/96 px-5 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] backdrop-blur-xl sm:max-w-xs"
            >
              <SheetHeader className="px-0 pb-4">
                <SheetTitle className="text-[#2E2323]">Little Smiles</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2">
                {navLinks.map((item) => (
                  <SheetClose asChild key={item.label}>
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="min-h-12 rounded-xl px-3.5 py-3 text-[1.02rem] font-medium text-[#3B2F2F]/82 transition-colors hover:bg-[#F2EAE4] hover:text-[#2E2323]"
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <Link
                    href="/cart"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-[1.02rem] font-medium text-[#3B2F2F]/82 transition-colors hover:bg-[#F2EAE4] hover:text-[#2E2323]"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <ShoppingBag
                        className="size-[1.05rem] shrink-0 text-[#3B2F2F]/72"
                        aria-hidden
                      />
                      Cart
                    </span>
                    {isCartReady && totalQuantity > 0 ? (
                      <span className="rounded-full bg-[#2F2624] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#F6F1EC]">
                        {totalQuantity > 99 ? "99+" : totalQuantity}
                      </span>
                    ) : null}
                  </Link>
                </SheetClose>
              </nav>
              <div className="mt-5 space-y-3">
                <SheetClose asChild>
                  <Button
                    asChild
                    className="h-12 w-full rounded-full bg-[#2F2624] px-5 text-[0.95rem] font-medium text-[#F6F1EC] shadow-[0_14px_34px_-20px_rgba(47,38,36,0.56)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-[#251E1D] hover:shadow-[0_18px_40px_-22px_rgba(47,38,36,0.66)]"
                  >
                    <Link
                      href="/cart"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="inline-flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="size-4" aria-hidden />
                      View cart
                      {isCartReady && totalQuantity > 0 ? (
                        <span className="rounded-full bg-[#F6F1EC]/15 px-2 py-0.5 text-xs font-semibold tabular-nums">
                          {totalQuantity > 99 ? "99+" : totalQuantity}
                        </span>
                      ) : null}
                    </Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button
                    asChild
                    variant="outline"
                    className="h-11 w-full rounded-full border-[#2E2323]/16 bg-white/62 px-5 text-[0.95rem] font-medium text-[#2E2323]"
                  >
                    <Link
                      href={whatsappBaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center"
                      onClick={(event) => {
                        setIsMobileMenuOpen(false);
                        void trackAndOpenWhatsapp(event, {
                          whatsappUrl: whatsappBaseUrl,
                          sourcePage: "mobile_navbar",
                        });
                      }}
                    >
                      WhatsApp Order
                    </Link>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
