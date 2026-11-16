import type { ProductPricingInput, ServicePricingInput } from "@asex/pricing";

export const SIMULATION_MODEL_VERSION = "2026-11-16";
export const SIMULATION_BACKUP_VERSION = 1;

export type SimulationKind = "product" | "service";
export type SavedScenario = {
  customPrice?: number;
  discountRate?: number;
  costVariationRate?: number;
};
export type SimulationInput = ProductPricingInput | ServicePricingInput;

export type PricingSimulation = {
  id: string;
  name: string;
  kind: SimulationKind;
  input: SimulationInput;
  scenarios?: SavedScenario;
  calculationVersion: typeof SIMULATION_MODEL_VERSION;
  createdAt: string;
  updatedAt: string;
};

export type CreateSimulationInput = Omit<
  PricingSimulation,
  "id" | "createdAt" | "updatedAt" | "calculationVersion"
>;
export type UpdateSimulationInput = Pick<
  PricingSimulation,
  "name" | "kind" | "input" | "scenarios"
>;
export type SimulationBackup = {
  schemaVersion: typeof SIMULATION_BACKUP_VERSION;
  exportedAt: string;
  simulations: PricingSimulation[];
};

export interface SimulationRepository {
  list(): Promise<PricingSimulation[]>;
  getById(id: string): Promise<PricingSimulation | null>;
  create(input: CreateSimulationInput): Promise<PricingSimulation>;
  update(id: string, input: UpdateSimulationInput): Promise<PricingSimulation>;
  delete(id: string): Promise<void>;
  duplicate(id: string): Promise<PricingSimulation>;
  exportBackup(): Promise<SimulationBackup>;
  importBackup(serialized: string): Promise<number>;
}

export class SimulationStorageError extends Error {}
const STORAGE_KEY = "asex.precifica.simulations.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isRate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}
function isDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
function hasKeys(value: Record<string, unknown>, keys: string[]) {
  return keys.every((key) => {
    const candidate = value[key];
    return isNumber(candidate) && candidate >= 0;
  });
}

function isSimulationInput(
  kind: SimulationKind,
  input: unknown,
): input is SimulationInput {
  if (!isRecord(input) || typeof input.name !== "string") return false;
  const rateKeys = [
    "commissionRate",
    "taxRate",
    "paymentFeeRate",
    "desiredMarginRate",
  ];
  if (!rateKeys.every((key) => isRate(input[key]))) return false;
  if (kind === "product")
    return hasKeys(input, [
      "acquisitionCost",
      "packagingCost",
      "freightPerUnit",
      "otherDirectCosts",
      "fixedExpensePerUnit",
    ]);
  return hasKeys(input, [
    "estimatedHours",
    "hourlyCost",
    "professionalCount",
    "materialsCost",
    "travelCost",
    "outsourcingCost",
    "otherDirectCosts",
    "fixedExpenseAllocated",
  ]);
}

export function isPricingSimulation(
  value: unknown,
): value is PricingSimulation {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !["product", "service"].includes(String(value.kind))
  )
    return false;
  if (
    value.calculationVersion !== SIMULATION_MODEL_VERSION ||
    !isDate(value.createdAt) ||
    !isDate(value.updatedAt)
  )
    return false;
  if (!isSimulationInput(value.kind as SimulationKind, value.input))
    return false;
  if (value.scenarios !== undefined) {
    if (!isRecord(value.scenarios)) return false;
    const { customPrice, discountRate, costVariationRate } = value.scenarios;
    if (
      (customPrice !== undefined &&
        (!isNumber(customPrice) || customPrice < 0)) ||
      (discountRate !== undefined && !isRate(discountRate)) ||
      (costVariationRate !== undefined &&
        (!isNumber(costVariationRate) || costVariationRate < -1))
    )
      return false;
  }
  return true;
}

function safeStorage(): Storage {
  if (typeof window === "undefined" || !window.localStorage)
    throw new SimulationStorageError(
      "O armazenamento local não está disponível neste navegador.",
    );
  return window.localStorage;
}

function readAll(): PricingSimulation[] {
  let raw: string | null;
  try {
    raw = safeStorage().getItem(STORAGE_KEY);
  } catch {
    throw new SimulationStorageError(
      "Não foi possível ler as simulações deste navegador.",
    );
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error();
    const invalid = parsed.filter((item) => !isPricingSimulation(item));
    if (invalid.length)
      throw new SimulationStorageError(
        "Foram encontrados dados locais incompatíveis. Eles foram preservados; importe um backup válido para recuperá-los.",
      );
    return parsed.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    if (error instanceof SimulationStorageError) throw error;
    throw new SimulationStorageError(
      "Não foi possível ler as simulações deste navegador. Os dados existentes não foram alterados.",
    );
  }
}

function writeAll(items: PricingSimulation[]) {
  try {
    safeStorage().setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    throw new SimulationStorageError(
      "Não foi possível salvar neste navegador. Verifique o espaço disponível e tente novamente.",
    );
  }
}

function id() {
  return crypto.randomUUID();
}

export class LocalSimulationRepository implements SimulationRepository {
  async list() {
    return readAll();
  }
  async getById(idValue: string) {
    return (await this.list()).find((item) => item.id === idValue) ?? null;
  }
  async create(input: CreateSimulationInput) {
    const timestamp = new Date().toISOString();
    const item: PricingSimulation = {
      ...input,
      id: id(),
      createdAt: timestamp,
      updatedAt: timestamp,
      calculationVersion: SIMULATION_MODEL_VERSION,
    };
    if (!isPricingSimulation(item))
      throw new SimulationStorageError(
        "A simulação contém dados inválidos e não pode ser salva.",
      );
    const items = await this.list();
    writeAll([item, ...items]);
    return item;
  }
  async update(idValue: string, input: UpdateSimulationInput) {
    const items = await this.list();
    const index = items.findIndex((item) => item.id === idValue);
    if (index < 0)
      throw new SimulationStorageError(
        "A simulação não foi encontrada neste navegador.",
      );
    const item: PricingSimulation = {
      ...items[index],
      ...input,
      updatedAt: new Date().toISOString(),
      calculationVersion: SIMULATION_MODEL_VERSION,
    };
    if (!isPricingSimulation(item))
      throw new SimulationStorageError(
        "A simulação contém dados inválidos e não pode ser salva.",
      );
    items[index] = item;
    writeAll(items);
    return item;
  }
  async delete(idValue: string) {
    const items = await this.list();
    if (!items.some((item) => item.id === idValue))
      throw new SimulationStorageError(
        "A simulação não foi encontrada neste navegador.",
      );
    writeAll(items.filter((item) => item.id !== idValue));
  }
  async duplicate(idValue: string) {
    const source = await this.getById(idValue);
    if (!source)
      throw new SimulationStorageError(
        "A simulação não foi encontrada neste navegador.",
      );
    return this.create({
      name: `${source.name} (cópia)`,
      kind: source.kind,
      input: source.input,
      scenarios: source.scenarios,
    });
  }
  async exportBackup(): Promise<SimulationBackup> {
    return {
      schemaVersion: SIMULATION_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      simulations: await this.list(),
    };
  }
  async importBackup(serialized: string) {
    let backup: unknown;
    try {
      backup = JSON.parse(serialized);
    } catch {
      throw new SimulationStorageError(
        "O arquivo selecionado não é um JSON válido.",
      );
    }
    if (
      !isRecord(backup) ||
      backup.schemaVersion !== SIMULATION_BACKUP_VERSION ||
      !isDate(backup.exportedAt) ||
      !Array.isArray(backup.simulations) ||
      !backup.simulations.every(isPricingSimulation)
    )
      throw new SimulationStorageError(
        "O backup não segue a estrutura ou versão esperada.",
      );
    const current = await this.list();
    const records = new Map(current.map((item) => [item.id, item]));
    for (const item of backup.simulations) records.set(item.id, item);
    writeAll([...records.values()]);
    return backup.simulations.length;
  }
}

export const simulationRepository = new LocalSimulationRepository();
