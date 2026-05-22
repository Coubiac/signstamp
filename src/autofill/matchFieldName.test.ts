import { describe, expect, it } from "vitest";
import { matchFieldName } from "./matchFieldName";

describe("matchFieldName", () => {
  it("matches exact camelCase canonical names", () => {
    expect(matchFieldName("firstName")).toBe("firstName");
    expect(matchFieldName("lastName")).toBe("lastName");
    expect(matchFieldName("email")).toBe("email");
  });

  it("matches separator variants of the same name", () => {
    expect(matchFieldName("first_name")).toBe("firstName");
    expect(matchFieldName("first-name")).toBe("firstName");
    expect(matchFieldName("first name")).toBe("firstName");
    expect(matchFieldName("First.Name")).toBe("firstName");
    expect(matchFieldName("FIRSTNAME")).toBe("firstName");
  });

  it("matches French aliases (including accented variants)", () => {
    expect(matchFieldName("prenom")).toBe("firstName");
    expect(matchFieldName("Prénom")).toBe("firstName");
    expect(matchFieldName("PRÉNOM")).toBe("firstName");
    expect(matchFieldName("téléphone")).toBe("phone");
    expect(matchFieldName("Code postal")).toBe("zip");
    expect(matchFieldName("Date de naissance")).toBe("dateOfBirth");
  });

  it("matches German aliases", () => {
    expect(matchFieldName("Vorname")).toBe("firstName");
    expect(matchFieldName("Nachname")).toBe("lastName");
    expect(matchFieldName("PLZ")).toBe("zip");
    expect(matchFieldName("Geburtsdatum")).toBe("dateOfBirth");
  });

  it("matches Spanish aliases", () => {
    expect(matchFieldName("Nombre")).toBe("firstName");
    expect(matchFieldName("Apellido")).toBe("lastName");
    expect(matchFieldName("Correo")).toBe("email");
    expect(matchFieldName("Teléfono")).toBe("phone");
  });

  it("matches CJK and Cyrillic aliases", () => {
    expect(matchFieldName("名前")).toBe("firstName");
    expect(matchFieldName("姓")).toBe("lastName");
    expect(matchFieldName("电话")).toBe("phone");
    expect(matchFieldName("ім'я")).toBe("firstName");
    expect(matchFieldName("прізвище")).toBe("lastName");
  });

  it("falls back to alternativeText when fieldName is cryptic", () => {
    expect(matchFieldName("Text12", "Email")).toBe("email");
    expect(matchFieldName("field_5", "Date de naissance")).toBe("dateOfBirth");
  });

  it("returns null when neither input matches the dictionary", () => {
    expect(matchFieldName("Text12")).toBeNull();
    expect(matchFieldName("untitled_3", "Some random label")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(matchFieldName("")).toBeNull();
    expect(matchFieldName("", "")).toBeNull();
  });

  it("does not match the bare English word 'name' (would be ambiguous)", () => {
    // Storing just "name" in the dictionary would cause it to map to
    // either first or last name depending on declaration order — we
    // intentionally require a more specific alias.
    expect(matchFieldName("name")).toBeNull();
    expect(matchFieldName("Name")).toBeNull();
  });
});
