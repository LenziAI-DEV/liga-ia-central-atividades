import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { AREAS, gotoReady, switchPersonaByKeyboard, syncAndWaitSuggestions } from "./helpers";
import { startServer } from "./server";

test.describe.configure({ mode: "serial" });

test("a primeira tela mostra as 6 áreas e a navegação funciona pelo teclado (CA-F12.1)", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Áreas principais" });
  for (const area of AREAS) await expect(nav.getByRole("link", { name: area })).toBeVisible();
  await nav.getByRole("link", { name: AREAS[0] }).focus();
  await page.keyboard.press("Tab");
  await expect(nav.getByRole("link", { name: AREAS[1] })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/minhas-atividades/);
});

test("troca de persona só pelo teclado e a persona ativa aparece em texto", async ({ page }) => {
  await page.goto("/");
  await switchPersonaByKeyboard(page, "Bruno");
  await expect(page.getByText("revisor(a) de sugestões")).toBeVisible();
});

test("aceitar uma sugestão só pelo teclado registra a decisão (CA-F5.6)", async ({ page }) => {
  await syncAndWaitSuggestions(page);
  await switchPersonaByKeyboard(page, "Bruno");
  await page.goto("/sugestoes");
  const first = page.getByRole("list").filter({ has: page.getByRole("link") }).locator("li a[href^='/sugestoes/']").first();
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sugestoes\/\d+|\/sugestoes\/[\w-]+/);
  await page.getByRole("button", { name: "Aceitar como proposto" }).focus();
  await page.keyboard.press("Enter");
  // aceitar aplica a mudança e leva à atividade alterada, com o histórico da decisão
  await expect(page).toHaveURL(/\/atividades\/[^/?]+\?aviso=salva/);
  await expect(page.getByText(/Bruno/).first()).toBeVisible();
});

test("páginas principais não têm violações do axe (WCAG 2.x A/AA)", async ({ page }) => {
  await page.goto("/");
  await switchPersonaByKeyboard(page, "Ana");
  for (const path of ["/", "/comece-aqui", "/minhas-atividades", "/atividades", "/atividades/nova", "/sugestoes", "/novidades", "/sincronizacao", "/como-decidimos"]) {
    await gotoReady(page, path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${path}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.html.slice(0, 160)}`), path).toEqual([]);
  }
});

test("sem rede, a tela avisa em texto e volta ao normal quando a conexão volta (CA-F12.5)", async ({ page, context }) => {
  await page.goto("/");
  await context.setOffline(true);
  await expect(page.getByRole("status").filter({ hasText: "Sem conexão" })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Sem conexão")).toBeHidden();
});

test("em escala de cinza, cada estado continua identificável por texto (CA-F12.4)", async ({ page }) => {
  await gotoReady(page, "/atividades");
  await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
  // todo selo de estado tem texto visível (não depende de cor)
  const badges = page.locator("main span.inline-flex");
  const count = await badges.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    expect(((await badges.nth(i).innerText()).replace(/[✓!✕↻•]/g, "")).trim().length, `selo ${i}`).toBeGreaterThan(0);
  }
});

test.describe("celular (375 px)", () => {
  test.use({ viewport: { width: 375, height: 800 } });
  test("nenhuma tela rola na horizontal e a navegação segue utilizável", async ({ page }) => {
    for (const path of ["/", "/comece-aqui", "/minhas-atividades", "/atividades", "/atividades/nova", "/sugestoes", "/novidades", "/sincronizacao"]) {
      await gotoReady(page, path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} estoura a largura`).toBeLessThanOrEqual(0);
    }
    await page.goto("/");
    await page.getByRole("navigation", { name: "Áreas principais" }).getByRole("link", { name: AREAS[2] }).click();
    await expect(page).toHaveURL(/\/atividades$/);
    // dono, prazo e estado seguem visíveis na tela estreita
    const card = page.locator("main li").filter({ hasText: "Responsável" }).first();
    await expect(card.getByText("Responsável")).toBeVisible();
    await expect(card.getByText("Prazo")).toBeVisible();
    await expect(card.locator("span.inline-flex").first()).toBeVisible();
  });
});

test("criar atividade: erro em texto, salvar, reiniciar o servidor e continuar lá (CA-F5.5)", async ({ browser }) => {
  let server = await startServer(3101, "restart");
  const context = await browser.newContext({ baseURL: server.url, locale: "pt-BR" });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await switchPersonaByKeyboard(page, "Bruno");
    await page.goto("/atividades/nova");
    await page.getByRole("button", { name: "Criar atividade" }).click();
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/t[ií]tulo/i);

    const title = "Atividade E2E persistente";
    await page.getByLabel(/^Título/).fill(title);
    await page.getByLabel("Bruno").check();
    await page.getByRole("button", { name: "Criar atividade" }).click();
    await expect(page).toHaveURL(/\/atividades\/[^/]+$/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const detailPath = new URL(page.url()).pathname;

    await server.stop();
    server = await startServer(3101, "restart");
    await page.goto(detailPath);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.goto("/atividades");
    await expect(page.getByText(title)).toBeVisible();
  } finally {
    await context.close();
    await server.stop();
  }
});
