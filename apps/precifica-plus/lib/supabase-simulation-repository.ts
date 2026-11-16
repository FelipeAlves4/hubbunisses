import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateProductPrice,
  calculateServicePrice,
  type ProductPricingInput,
  type ServicePricingInput,
} from "@asex/pricing";
import {
  SIMULATION_BACKUP_VERSION,
  SIMULATION_MODEL_VERSION,
  SimulationStorageError,
  isPricingSimulation,
  isRecord,
  isSimulationBackup,
  type CreateSimulationInput,
  type PricingSimulation,
  type SimulationBackup,
  type SimulationRepository,
  type UpdateSimulationInput,
} from "./simulation-repository";

type SimulationRow = {
  id: string;
  kind: PricingSimulation["kind"];
  name: string;
  assumptions: unknown;
  scenario_inputs: unknown;
  calculation_version: string;
  created_at: string;
  updated_at: string;
};

function resultFor(simulation: Pick<PricingSimulation, "kind" | "input">) {
  return simulation.kind === "product"
    ? calculateProductPrice(simulation.input as ProductPricingInput)
    : calculateServicePrice(simulation.input as ServicePricingInput);
}

function fromRow(row: SimulationRow): PricingSimulation {
  const simulation = {
    id: row.id,
    name: row.name,
    kind: row.kind,
    input: row.assumptions,
    scenarios: row.scenario_inputs,
    calculationVersion: row.calculation_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (!isPricingSimulation(simulation)) {
    throw new SimulationStorageError(
      "Uma simulação remota não é compatível com a versão atual do PRECIFICA+.",
    );
  }
  return simulation;
}

function databaseError(error: { message: string } | null) {
  if (!error) return null;
  return new SimulationStorageError(
    `Não foi possível sincronizar a simulação: ${error.message}`,
  );
}

/** Persiste somente em linhas liberadas pelas políticas RLS da organização ativa. */
export class SupabaseSimulationRepository implements SimulationRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly organizationId: string,
  ) {}

  async list(): Promise<PricingSimulation[]> {
    const { data, error } = await this.supabase
      .from("pricing_simulations")
      .select(
        "id, kind, name, assumptions, scenario_inputs, calculation_version, created_at, updated_at",
      )
      .eq("organization_id", this.organizationId)
      .order("updated_at", { ascending: false });
    if (error) throw databaseError(error);
    return (data ?? []).map((row) => fromRow(row as SimulationRow));
  }

  async getById(id: string): Promise<PricingSimulation | null> {
    const { data, error } = await this.supabase
      .from("pricing_simulations")
      .select(
        "id, kind, name, assumptions, scenario_inputs, calculation_version, created_at, updated_at",
      )
      .eq("organization_id", this.organizationId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw databaseError(error);
    return data ? fromRow(data as SimulationRow) : null;
  }

  async create(input: CreateSimulationInput): Promise<PricingSimulation> {
    const id = input.id ?? crypto.randomUUID();
    const candidate: PricingSimulation = {
      ...input,
      id,
      calculationVersion: SIMULATION_MODEL_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!isPricingSimulation(candidate)) {
      throw new SimulationStorageError(
        "A simulação contém dados inválidos e não pode ser enviada.",
      );
    }
    const { data, error } = await this.supabase
      .from("pricing_simulations")
      .insert({
        id,
        organization_id: this.organizationId,
        kind: candidate.kind,
        name: candidate.name,
        assumptions: candidate.input,
        scenario_inputs: candidate.scenarios ?? {},
        calculation_version: SIMULATION_MODEL_VERSION,
        result: resultFor(candidate),
      })
      .select(
        "id, kind, name, assumptions, scenario_inputs, calculation_version, created_at, updated_at",
      )
      .single();
    if (error) throw databaseError(error);
    return fromRow(data as SimulationRow);
  }

  async update(
    id: string,
    input: UpdateSimulationInput,
  ): Promise<PricingSimulation> {
    const candidate = { id, ...input } as Pick<
      PricingSimulation,
      "id" | "kind" | "name" | "input" | "scenarios"
    >;
    const { data, error } = await this.supabase
      .from("pricing_simulations")
      .update({
        kind: input.kind,
        name: input.name,
        assumptions: input.input,
        scenario_inputs: input.scenarios ?? {},
        calculation_version: SIMULATION_MODEL_VERSION,
        result: resultFor(candidate as PricingSimulation),
      })
      .eq("organization_id", this.organizationId)
      .eq("id", id)
      .select(
        "id, kind, name, assumptions, scenario_inputs, calculation_version, created_at, updated_at",
      )
      .single();
    if (error) throw databaseError(error);
    return fromRow(data as SimulationRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("pricing_simulations")
      .delete()
      .eq("organization_id", this.organizationId)
      .eq("id", id);
    if (error) throw databaseError(error);
  }

  async duplicate(id: string): Promise<PricingSimulation> {
    const source = await this.getById(id);
    if (!source)
      throw new SimulationStorageError(
        "A simulação não foi encontrada na organização atual.",
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

  async importBackup(serialized: string): Promise<number> {
    let backup: unknown;
    try {
      backup = JSON.parse(serialized);
    } catch {
      throw new SimulationStorageError(
        "O arquivo selecionado não é um JSON válido.",
      );
    }
    if (!isSimulationBackup(backup)) {
      throw new SimulationStorageError(
        "O backup não segue a estrutura ou versão esperada.",
      );
    }
    const existingIds = new Set(
      (await this.list()).map((simulation) => simulation.id),
    );
    let imported = 0;
    const failures: string[] = [];
    for (const simulation of backup.simulations) {
      if (existingIds.has(simulation.id)) continue;
      try {
        await this.create({ ...simulation, id: simulation.id });
        imported += 1;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : simulation.name);
      }
    }
    if (failures.length) {
      throw new SimulationStorageError(
        `${imported} simulação(ões) foram importadas; ${failures.length} falharam. O histórico local não foi apagado.`,
      );
    }
    return imported;
  }
}
