import { describe, expect, it } from "vitest";
import { normalize } from "./normalize";

describe("normalize", () => {
  it("lowercases", () => {
    expect(normalize("Hello")).toBe("hello");
    expect(normalize("FIRSTNAME")).toBe("firstname");
  });

  it("strips diacritics", () => {
    expect(normalize("Prénom")).toBe("prenom");
    expect(normalize("Téléphone")).toBe("telephone");
    expect(normalize("São")).toBe("sao");
    expect(normalize("naïve")).toBe("naive");
  });

  it("collapses every separator to nothing", () => {
    expect(normalize("first name")).toBe("firstname");
    expect(normalize("first_name")).toBe("firstname");
    expect(normalize("first-name")).toBe("firstname");
    expect(normalize("first.name")).toBe("firstname");
    expect(normalize("first  name")).toBe("firstname");
    expect(normalize("First-Name_Here")).toBe("firstnamehere");
  });

  it("preserves non-latin scripts", () => {
    // Cyrillic, CJK and Arabic stay as-is — case folding only affects
    // scripts that have a case distinction.
    expect(normalize("Имя")).toBe("имя");
    expect(normalize("名前")).toBe("名前");
    expect(normalize("البريد")).toBe("البريد");
  });

  it("returns empty string for empty input", () => {
    expect(normalize("")).toBe("");
  });
});
