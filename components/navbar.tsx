"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { whatsappBaseUrl } from "@/lib/products";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Blog", href: "/blog" },
  { label: "Best Sellers", href: "/best-sellers" },
  { label: "Reviews", href: "/reviews" },
  { label: "Contact", href: "/contact" },
] as const;

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);

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
        "bg-[#F9F5F1]/72 backdrop-blur-xl",
        isScrolled &&
          "border-[#3B2F2F]/12 bg-[#F9F5F1]/88 shadow-[0_20px_44px_-26px_rgba(59,47,47,0.4)]"
      )}
    >
      <div className="mx-auto flex h-18 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:h-20 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center">
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

        <div className="hidden items-center lg:flex">
          <Button
            asChild
            className="h-11 rounded-full bg-[#2F2624] px-6 text-sm font-medium text-[#F6F1EC] shadow-[0_14px_34px_-20px_rgba(47,38,36,0.56)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-[#251E1D] hover:shadow-[0_18px_40px_-22px_rgba(47,38,36,0.66)]"
          >
            <Link
              href={whatsappBaseUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                posthog.capture("whatsapp_order_clicked", {
                  source: "desktop_navbar",
                })
              }
            >
              WhatsApp Order
            </Link>
          </Button>
        </div>

        <div className="lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-[#3B2F2F]/14 bg-white/66 text-[#2E2323] shadow-[0_10px_28px_-22px_rgba(59,47,47,0.46)] backdrop-blur-sm hover:bg-white/88"
              >
                <Menu className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[82%] border-l-[#3B2F2F]/12 bg-[#FAF6F2]/96 px-6 py-6 backdrop-blur-xl sm:max-w-xs"
            >
              <SheetHeader className="px-0 pb-4">
                <SheetTitle className="text-[#2E2323]">Little Smiles</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2.5">
                {navLinks.map((item) => (
                  <SheetClose asChild key={item.label}>
                    <Link
                      href={item.href}
                      className="rounded-xl px-3 py-2 text-base font-medium text-[#3B2F2F]/82 transition-colors hover:bg-[#F2EAE4] hover:text-[#2E2323]"
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-6">
                <SheetClose asChild>
                  <Button
                    asChild
                    className="h-11 w-full rounded-full bg-[#2F2624] text-sm font-medium text-[#F6F1EC] shadow-[0_14px_34px_-20px_rgba(47,38,36,0.56)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-[#251E1D] hover:shadow-[0_18px_40px_-22px_rgba(47,38,36,0.66)]"
                  >
                    <Link
                      href={whatsappBaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() =>
                        posthog.capture("whatsapp_order_clicked", {
                          source: "mobile_navbar",
                        })
                      }
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
