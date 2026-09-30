import { describe, expect, it } from "vitest";
import { findMember, loadMembers, matchMemberByName, parseMembers } from "./members";

const base = { id: "ana", name: "Ana", aliases: [], front: "Growth", role: "member", canReview: false };
const reviewer = { id: "bruno", name: "Bruno", aliases: [], front: "Growth", role: "leader", canReview: true };

describe("parseMembers", () => {
  it("lê o arquivo do projeto: 4 membros, com revisores", () => {
    const members = loadMembers();
    expect(members.map((m) => m.id)).toEqual(["ana", "bruno", "carla", "davi"]);
    expect(members.filter((m) => m.canReview).map((m) => m.id)).toEqual(["bruno", "carla"]);
  });

  it("exige ao menos dois membros e um revisor (F11.1)", () => {
    expect(() => parseMembers({ members: [reviewer] })).toThrow(/dois/);
    expect(() => parseMembers({ members: [base, { ...base, id: "davi", name: "Davi" }] })).toThrow(/revisor/);
  });

  it("recusa id repetido e nome ou apelido ambíguo, sem diferenciar maiúsculas e acentos", () => {
    expect(() => parseMembers({ members: [base, { ...reviewer, id: "ana" }] })).toThrow(/id/);
    expect(() => parseMembers({ members: [base, { ...reviewer, name: "ANA" }] })).toThrow(/ambíguo/);
    expect(() => parseMembers({ members: [base, { ...reviewer, aliases: ["Aná"] }] })).toThrow(/ambíguo/);
  });

  it("recusa id fora do padrão e papel desconhecido", () => {
    expect(() => parseMembers({ members: [{ ...base, id: "A na" }, reviewer] })).toThrow();
    expect(() => parseMembers({ members: [{ ...base, role: "admin" }, reviewer] })).toThrow();
    expect(() => parseMembers("nada")).toThrow();
  });
});

describe("findMember e matchMemberByName", () => {
  const members = parseMembers({ members: [base, { ...reviewer, aliases: ["Bruninho", "B. Souza"] }] });

  it("acha por id exato e ignora valor desconhecido ou de protótipo", () => {
    expect(findMember(members, "ana")?.name).toBe("Ana");
    expect(findMember(members, "ninguem")).toBeNull();
    expect(findMember(members, "__proto__")).toBeNull();
    expect(findMember(members, undefined)).toBeNull();
  });

  it("casa nome ou apelido sem diferenciar maiúsculas, acentos e espaços extras", () => {
    expect(matchMemberByName(members, "  ANA ")?.id).toBe("ana");
    expect(matchMemberByName(members, "bruninho")?.id).toBe("bruno");
    expect(matchMemberByName(members, "b.  souza")?.id).toBe("bruno");
    expect(matchMemberByName(members, "Fulano")).toBeNull();
    expect(matchMemberByName(members, "")).toBeNull();
  });
});
