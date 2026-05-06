"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const contactSchema = z.object({
  name: z.string().min(2, "Please enter your name."),
  phone: z.string().min(10, "Please enter a valid phone number."),
  message: z.string().min(10, "Please add a short message."),
});

type ContactInput = z.infer<typeof contactSchema>;

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (values: ContactInput) => {
    setError(null);
    setSubmitted(false);

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      setError("Could not submit your message. Please try again.");
      return;
    }

    posthog.capture("contact_form_submitted", {
      source: "contact_page",
    });

    setSubmitted(true);
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
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
          className="min-h-28 w-full rounded-2xl border border-[#2E2323]/12 bg-white/80 px-3 py-2 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-[#2E2323]/20"
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
        <p className="text-sm text-[#3B2F2F]/75">
          Thank you. We will contact you shortly.
        </p>
      ) : null}
      {error ? <p className="text-sm text-[#9A4C5A]">{error}</p> : null}
    </form>
  );
}
