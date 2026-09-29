"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AREAS } from "@/lib/areas";

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Áreas principais" className="mt-3">
      <ul className="flex flex-wrap gap-x-1 gap-y-1">
        {AREAS.map((area) => {
          const active = pathname === area.href || pathname.startsWith(`${area.href}/`);
          return (
            <li key={area.href}>
              <Link
                href={area.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "block rounded px-3 py-2 text-sm font-semibold text-[var(--paper)] bg-[var(--lia-blue)]"
                    : "block rounded px-3 py-2 text-sm text-[var(--ink)] underline-offset-4 hover:underline hover:text-[var(--lia-blue)]"
                }
              >
                {area.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
