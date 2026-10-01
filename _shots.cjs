const { chromium } = require("@playwright/test");
const out = process.argv[2];
const list = (process.argv[3] || "home:/,comece:/comece-aqui,minhas:/minhas-atividades,atividades:/atividades,nova:/atividades/nova,sugestoes:/sugestoes,novidades:/novidades,sync:/sincronizacao,como:/como-decidimos").split(",").map((x) => x.split(/:(.*)/s));
const persona = process.argv[4] || "Ana";
(async () => {
  const b = await chromium.launch();
  for (const [tag, vp] of [["d", { width: 1280, height: 800 }], ["m", { width: 375, height: 800 }]]) {
    const ctx = await b.newContext({ viewport: vp, locale: "pt-BR", baseURL: "http://localhost:3200" });
    const p = await ctx.newPage();
    p.on("console", (m) => m.type() === "error" && console.log("CONSOLE", tag, m.text().slice(0, 200)));
    await p.goto("/sincronizacao");
    await p.getByRole("button", { name: "Sincronizar agora" }).click();
    await p.waitForTimeout(2500);
    const sel = p.getByLabel("Trocar para");
    const label = await sel.locator("option").evaluateAll((os, n) => os.find((o) => o.textContent.startsWith(n))?.textContent, persona);
    await sel.selectOption({ label });
    await p.getByRole("button", { name: "Trocar" }).click();
    await p.waitForTimeout(500);
    for (const [name, path] of list) {
      await p.goto(path);
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${out}/${name}-${tag}.png`, fullPage: true });
    }
    await ctx.close();
  }
  await b.close();
})();
