import type { Metadata } from "next";
import { AreaPlaceholder } from "@/components/area-placeholder";
import { PageHeader } from "@/components/page-header";
import { getArea } from "@/lib/areas";

const area = getArea("/minhas-atividades");
export const metadata: Metadata = { title: area.label };

export default function Page() {
  return (
    <>
      <PageHeader title={area.label} description={area.description} />
      <AreaPlaceholder phase="Fase 2" />
    </>
  );
}
