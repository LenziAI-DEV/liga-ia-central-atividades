import { expect, type Page } from "@playwright/test";

export const AREAS = [
  "Comece aqui",
  "Minhas atividades",
  "Todas as atividades",
  "Sugestões para revisar",
  "Novidades dos documentos",
  "Estado da sincronização",
];

/** Escolhe a persona só com o teclado: foca o seletor, digita o nome, vai ao botão com Tab e envia com Enter (Enter no seletor não envia o formulário). */
export async function switchPersonaByKeyboard(page: Page, name: string) {
  await page.getByLabel("Trocar para").focus();
  await page.keyboard.type(name);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Trocar" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText(`Persona ativa: ${name}`, { exact: false })).toBeVisible();
}

/** Dispara a sincronização e espera a leitura do Drive falso terminar (registro importado e ata analisada). */
export async function syncAndWaitSuggestions(page: Page) {
  await page.goto("/sincronizacao");
  await page.getByRole("button", { name: "Sincronizar agora" }).click();
  await expect
    .poll(
      async () => {
        await page.goto("/sugestoes");
        return page.getByRole("heading", { name: /Aguardando revisão \((\d+)\)/ }).textContent();
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] },
    )
    .toMatch(/\(([1-9]\d*)\)/);
}
