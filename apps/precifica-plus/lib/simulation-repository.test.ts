import { beforeEach, describe, expect, it } from "vitest";
import {
  LocalSimulationRepository,
  SimulationStorageError,
} from "./simulation-repository";

const product = {
  name: "Café",
  acquisitionCost: 40,
  packagingCost: 2,
  freightPerUnit: 3,
  otherDirectCosts: 5,
  fixedExpensePerUnit: 10,
  commissionRate: 0.05,
  taxRate: 0.08,
  paymentFeeRate: 0.02,
  desiredMarginRate: 0.2,
};

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    clear: () => values.clear(),
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: memoryStorage() },
  });
});

describe("LocalSimulationRepository", () => {
  it("creates, updates, duplicates and deletes a simulation", async () => {
    const repository = new LocalSimulationRepository();
    const created = await repository.create({
      name: "Preço de varejo",
      kind: "product",
      input: product,
      scenarios: { discountRate: 0.1 },
    });
    const updated = await repository.update(created.id, {
      name: "Preço revisado",
      kind: "product",
      input: { ...product, taxRate: 0.1 },
      scenarios: {},
    });
    const duplicated = await repository.duplicate(updated.id);
    expect((await repository.list()).map((item) => item.name)).toContain(
      "Preço revisado (cópia)",
    );
    expect(duplicated.id).not.toBe(updated.id);
    await repository.delete(updated.id);
    expect(await repository.getById(updated.id)).toBeNull();
  });

  it("exports and restores a versioned backup", async () => {
    const source = new LocalSimulationRepository();
    await source.create({ name: "Backup", kind: "product", input: product });
    const backup = await source.exportBackup();
    const target = new LocalSimulationRepository();
    expect(await target.importBackup(JSON.stringify(backup))).toBe(1);
    expect((await target.list())[0]?.name).toBe("Backup");
  });

  it("rejects incompatible backups without overwriting local records", async () => {
    const repository = new LocalSimulationRepository();
    await repository.create({
      name: "Preservada",
      kind: "product",
      input: product,
    });
    await expect(
      repository.importBackup(
        JSON.stringify({ schemaVersion: 99, simulations: [] }),
      ),
    ).rejects.toBeInstanceOf(SimulationStorageError);
    expect((await repository.list())[0]?.name).toBe("Preservada");
  });

  it("reports corrupted local records without deleting them", async () => {
    window.localStorage.setItem(
      "asex.precifica.simulations.v1",
      JSON.stringify([{ id: "bad" }]),
    );
    await expect(new LocalSimulationRepository().list()).rejects.toThrow(
      "dados locais incompatíveis",
    );
    expect(
      window.localStorage.getItem("asex.precifica.simulations.v1"),
    ).toContain("bad");
  });
});
