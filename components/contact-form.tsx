"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { capturePostHogEvent } from "@/lib/posthog-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const contactSchema = z
  .object({
    name: z.string().min(2, "Please enter your name."),
    phone: z.string().min(10, "Please enter a valid phone number."),
    message: z.string().min(10, "Please add a short message."),
    /** Leave empty — spam bots often fill this hidden field. */
    website: z.string().optional(),
  })
  .refine((d) => d.website == null || d.website.length === 0, {
    path: ["website"],
    message: "Something went wrong. Please try again.",
  });

type ContactInput = z.infer<typeof contactSchema>;

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [deliveredToInbox, setDeliveredToInbox] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { website: "" },
  });

  const onSubmit = async (values: ContactInput) => {
    setError(null);
    setSubmitted(false);
    setDeliveredToInbox(null);

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        phone: values.phone,
        message: values.message,
        website: values.website ?? "",
      }),
    });

    if (!response.ok) {
      setError("Could not submit your message. Please try again.");
      return;
    }

    const data = (await response.json().catch(() => null)) as {
      delivered?: boolean;
    } | null;
    const delivered = data?.delivered === true;

    capturePostHogEvent("contact_form_submitted", {
      source: "contact_page",
      delivered,
    });

    setDeliveredToInbox(delivered);
    setSubmitted(true);
    reset();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="relative mt-8 space-y-4"
    >
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        {...register("website")}
      />
      <div>
        <Input
          placeholder="Your Name"
          className="h-11 rounded-2xl border-[#2E2323]/12 bg-white/80"
          {...register("name")}
        />
        {errors.name ? (
          <p className="mt-1 text-xs text-[#9A4C5A]">{errors.name.message}</p>
        ) : null}
      </div>
      <div>
        <Input
          placeholder="Phone Number"
          className="h-11 rounded-2xl border-[#2E2323]/12 bg-white/80"
          {...register("phone")}
        />
        {errors.phone ? (
          <p className="mt-1 text-xs text-[#9A4C5A]">{errors.phone.message}</p>
        ) : null}
      </div>
      <div>
        <textarea
          placeholder="How can we help?"
          className="min-h-28 w-full rounded-2xl border border-[#2E2323]/12 bg-white/80 px-3 py-2 text-base leading-relaxed outline-none ring-0 placeholder:text-muted-foreground focus:border-[#2E2323]/20 lg:text-sm"
          {...register("message")}
        />
        {errors.message ? (
          <p className="mt-1 text-xs text-[#9A4C5A]">{errors.message.message}</p>
        ) : null}
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-11 rounded-full bg-[#E8B4B8] px-7 text-sm font-medium text-[#2E2323] shadow-[0_14px_32px_-20px_rgba(110,83,86,0.52)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-[#E3A9AE]"
      >
        {isSubmitting ? "Sending..." : "Send Message"}
      </Button>
      {submitted ? (
        <div className="space-y-1 text-sm text-[#3B2F2F]/75">
          <p>Thank you — we received your message.</p>
          {deliveredToInbox === false ? (
            <p className="text-[#3B2F2F]/62">
              If you don&apos;t hear back within a day, message us on WhatsApp so we can help you
              directly.
            </p>
          ) : (
            <p>We&apos;ll get back to you as soon as we can.</p>
          )}
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#9A4C5A]">{error}</p> : null}
    </form>
  );
}
