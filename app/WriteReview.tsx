"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ReviewForm from "./confirmation/ReviewForm";
import { formatTripDate } from "@/lib/dates";
import { banglaCity } from "@/lib/routes";
import { REVIEW_SAVED_EVENT } from "@/lib/reviews";

interface FoundTicket {
  bookingCode: string;
  companyName: string;
  from: string;
  to: string;
  travelDate: string;
}

/**
 * "Write a review" without opening the ticket: the passenger types their ticket number and the
 * phone it was booked with, and the same review form as on the ticket page opens for that ticket.
 */
export default function WriteReview() {
  const [open, setOpen] = useState(false);
  const [ticket, setTicket] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [found, setFound] = useState<FoundTicket | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    setFound(null);
    setError("");
  };

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!ticket.trim() || !phone.trim()) {
      setError("Please type your ticket number and phone");
      return;
    }
    setChecking(true);
    try {
      const res = await fetch("/api/reviews/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket, phone }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          data?.error || "Ticket number and phone don't match a paid ticket",
        );
        return;
      }
      setFound(data);
    } catch {
      setError("No internet connection. Try again in a moment.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass-btn btn-orange h-12 grow text-[14px]"
      >
        Write a review · মতামত দিন
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-[#111111]/40 p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Write a review"
            onClick={close}
          >
            <div
              className="flex max-h-[92vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <span className="display text-[17px] font-bold">
                    Write a review
                  </span>
                  <span className="text-[12.5px] font-semibold text-[#3f3f3f]">
                    মতামত দিন
                  </span>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111111]/[0.06] text-[#111111]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              {found ? (
                <>
                  <div className="flex flex-col rounded-2xl bg-[#111111]/[0.04] px-3.5 py-2.5">
                    <span className="text-[14px] font-bold">
                      {banglaCity(found.from) || found.from} →{" "}
                      {banglaCity(found.to) || found.to}
                    </span>
                    <span className="text-[12px] text-[#3f3f3f]">
                      {found.companyName}
                      {found.travelDate
                        ? ` · ${formatTripDate(found.travelDate)}`
                        : ""}
                    </span>
                  </div>
                  <div className="-mt-5">
                    <ReviewForm
                      bookingCode={found.bookingCode}
                      passengerName=""
                      companyName={found.companyName}
                      onSaved={() =>
                        window.dispatchEvent(new Event(REVIEW_SAVED_EVENT))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="glass-btn glass-btn-plain h-11 text-[13.5px]"
                  >
                    Done
                  </button>
                </>
              ) : (
                <form onSubmit={find} className="flex flex-col gap-3">
                  <span className="text-[12.5px] leading-relaxed text-[#3f3f3f]">
                    Type the ticket number (like BH-20261008-…) and the phone
                    you booked with. Only paid BusHub tickets can be reviewed.
                  </span>
                  <label className="flex flex-col gap-1">
                    <span className="label-xs">
                      Ticket number · টিকেট নম্বর
                    </span>
                    <input
                      value={ticket}
                      onChange={(e) => setTicket(e.target.value.slice(0, 40))}
                      className="input-dark uppercase"
                      placeholder="BH-20261008-…"
                      autoComplete="off"
                      autoCapitalize="characters"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="label-xs">Phone · মোবাইল নম্বর</span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.slice(0, 20))}
                      className="input-dark"
                      placeholder="01XXXXXXXXX"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </label>
                  {error && (
                    <p
                      role="alert"
                      className="rounded-xl bg-[#fde8e8] px-3 py-2 text-[12.5px] font-semibold text-[#9b1c1c]"
                    >
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={checking}
                    className="glass-btn btn-orange h-12 text-[14px]"
                  >
                    {checking ? "Checking..." : "Continue"}
                  </button>
                </form>
              )}
            </div>
          </div>,
          // On the page itself: a blurred card around the button would trap a fixed pop-up inside it.
          document.body,
        )}
    </>
  );
}
