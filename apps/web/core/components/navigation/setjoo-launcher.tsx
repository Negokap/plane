/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Setjoo app launcher, matching Core's NetworkLauncher (Negokap/setjoo client/src/components/NetworkLauncher.tsx).
import { useEffect, useRef, useState } from "react";
import { Grip } from "lucide-react";
import { cn } from "@plane/utils";
// Written by deploy/build.sh from https://auth.setjoo.com/api/v1/applications; the checked-in copy is the fallback.
import registry from "./setjoo-applications.json";

const CURRENT_APP = "projects";
const GROUPS = [
  { id: "operating", label: "Operating" },
  { id: "commercial", label: "Commercial" },
  { id: "intelligence", label: "Intelligence" },
];

type TSetjooApp = { id: string; slug: string; name: string; publicHost: string; status: string; group: string };
const applications: TSetjooApp[] = registry.applications;

const label = (name: string) => name.replace(/^Setjoo\s+/, "");

export function SetjooLauncher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="grid size-8 place-items-center rounded-md text-tertiary hover:bg-layer-1-hover hover:text-primary"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Setjoo apps"
        onClick={() => setOpen((value) => !value)}
      >
        <Grip className="size-5" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Setjoo apps"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-subtle bg-surface-1 text-primary shadow-xl"
        >
          <div className="max-h-[min(80vh,36rem)] overflow-y-auto p-3">
            <p className="px-1 text-11 font-semibold tracking-[0.16em] text-tertiary uppercase">Setjoo network</p>
            {GROUPS.map((group) => (
              <section key={group.id} className="mt-3">
                <h3 className="mb-1.5 px-1 text-10 font-semibold tracking-[0.16em] text-tertiary uppercase">
                  {group.label}
                </h3>
                <div className="grid grid-cols-3 gap-1">
                  {applications
                    .filter((app) => app.group === group.id)
                    .map((app) => {
                      const current = app.slug === CURRENT_APP;
                      const ready = current || app.status === "available";
                      const inner = (
                        <>
                          <span
                            className={cn(
                              "flex size-9 items-center justify-center rounded-full text-10 font-bold",
                              ready ? "bg-accent-primary text-on-color" : "bg-layer-1 text-tertiary"
                            )}
                          >
                            {label(app.name).slice(0, 2).toUpperCase()}
                          </span>
                          <span className="text-11 leading-4 font-medium">{label(app.name)}</span>
                          {!ready && <span className="text-9 tracking-[0.12em] text-tertiary uppercase">Coming</span>}
                        </>
                      );
                      const className = cn(
                        "flex flex-col items-center gap-1.5 rounded-lg px-2 py-2.5 text-center transition-colors",
                        current ? "bg-layer-1 ring ring-[var(--txt-primary)]" : ready && "hover:bg-layer-1-hover",
                        !ready && "opacity-70"
                      );
                      // The registry's href/origin fields are local dev addresses; publicHost is the live one.
                      return ready ? (
                        <a
                          key={app.id}
                          href={current ? "/" : `https://${app.publicHost}/`}
                          className={className}
                          aria-current={current ? "page" : undefined}
                          onClick={() => setOpen(false)}
                        >
                          {inner}
                        </a>
                      ) : (
                        <span key={app.id} className={className} aria-disabled="true">
                          {inner}
                        </span>
                      );
                    })}
                </div>
              </section>
            ))}
          </div>
          <div className="flex gap-3 border-t border-subtle px-3 py-2 text-12 text-tertiary">
            <a href="https://auth.setjoo.com/" className="hover:text-primary">
              Setjoo account
            </a>
            <a href="https://business.setjoo.com/" className="hover:text-primary">
              Business
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
