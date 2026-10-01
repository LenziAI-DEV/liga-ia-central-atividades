"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AREAS } from "@/lib/areas";

/**
 * Abas no topo. Em telas estreitas viram um botão "Menu"; o menu fecha sozinho ao navegar
 * (guardamos em que rota ele foi aberto, sem efeito colateral).
 */
export function MainNav() {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const current = AREAS.find((a) => pathname === a.href || pathname.startsWith(`${a.href}/`));
  return (
    <div className="border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="areas-principais"
          onClick={() => setOpenAt(open ? null : pathname)}
          className="flex min-h-11 w-full items-center justify-between py-2 text-sm font-medium md:hidden"
        >
          <span>Menu{current ? <span className="font-normal text-[var(--text-muted)]"> · {current.label}</span> : null}</span>
          <span aria-hidden="true" className="text-[var(--text-muted)]">
            {open ? "▴" : "▾"}
          </span>
        </button>
        <nav aria-label="Áreas principais" id="areas-principais" className={`${open ? "block" : "hidden"} pb-2 md:block md:pb-0`}>
          <ul className="flex flex-col md:flex-row md:gap-1">
            {AREAS.map((area) => {
              const active = area === current;
              return (
                <li key={area.href}>
                  <Link
                    href={area.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpenAt(null)}
                    className={`block border-[var(--primary)] px-3 py-2.5 text-sm md:border-b-2 md:py-2 ${
                      active
                        ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary)] md:bg-transparent"
                        : "border-transparent text-[var(--text-muted)] hover:text-[var(--primary)] md:hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {area.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
